import os
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from sqlmodel import Session

from database import get_session
from exporter import export_onnx, export_savedmodel, export_tflite
from graph_compiler import compile_graph
from models import ExportedModel, ModelGraph, TrainingRun

router = APIRouter(tags=["export"])

EXPORT_DIR = Path(__file__).resolve().parent.parent / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)


class ExportBody(BaseModel):
    run_id: int
    format: str  # savedmodel / onnx / tflite


def _rebuild_model(session: Session, run: TrainingRun) -> Any:
    g = session.get(ModelGraph, run.graph_id)
    if not g:
        raise ValueError("Graph not found for run")
    model = compile_graph(g.nodes, g.edges)
    if not run.weights_path or not os.path.isfile(run.weights_path):
        raise ValueError("No trained weights available for this run")
    model.load_weights(run.weights_path)
    return model


@router.post("/api/export")
def export_model(body: ExportBody, session: Session = Depends(get_session)):
    run = session.get(TrainingRun, body.run_id)
    if not run:
        return JSONResponse(
            status_code=404,
            content={"error": "Training run not found", "detail": str(body.run_id)},
        )
    if run.status != "complete":
        return JSONResponse(
            status_code=400,
            content={
                "error": "Training not complete",
                "detail": f"Run status is {run.status}",
            },
        )

    fmt = body.format.lower().strip()
    uid = uuid.uuid4().hex[:10]

    def _doc_deps_hint() -> str:
        return (
            "Install reporting libraries in the same Python env as uvicorn: "
            "pip install fpdf2 python-docx   (or: pip install -r requirements-core.txt)"
        )

    try:
        if fmt in ("pdf", "docx"):
            try:
                from report_export import build_docx_report, build_pdf_report
            except ImportError as e:
                return JSONResponse(
                    status_code=501,
                    content={
                        "error": "Report export dependencies missing",
                        "detail": f"{_doc_deps_hint()} — {e}",
                    },
                )
            g = session.get(ModelGraph, run.graph_id)
            if not g:
                return JSONResponse(
                    status_code=404,
                    content={"error": "Graph not found", "detail": str(run.graph_id)},
                )
            if fmt == "pdf":
                out = EXPORT_DIR / f"run_{body.run_id}_{uid}.pdf"
                file_path = build_pdf_report(
                    run_id=body.run_id,
                    graph_name=g.name,
                    nodes=g.nodes or [],
                    edges=g.edges or [],
                    config=run.config or {},
                    metrics_history=run.metrics_history or [],
                    created_at=run.created_at,
                    out_path=out,
                )
            else:
                out = EXPORT_DIR / f"run_{body.run_id}_{uid}.docx"
                file_path = build_docx_report(
                    run_id=body.run_id,
                    graph_name=g.name,
                    nodes=g.nodes or [],
                    edges=g.edges or [],
                    config=run.config or {},
                    metrics_history=run.metrics_history or [],
                    created_at=run.created_at,
                    out_path=out,
                )
            rec = ExportedModel(run_id=body.run_id, format=fmt, file_path=file_path)
            session.add(rec)
            session.commit()
            session.refresh(rec)
            return {"file_path": file_path, "export_id": rec.id}

        model = _rebuild_model(session, run)

        if fmt == "savedmodel":
            out = str(EXPORT_DIR / f"run_{body.run_id}_{uid}_savedmodel")
            file_path = export_savedmodel(model, out)
        elif fmt == "onnx":
            out = str(EXPORT_DIR / f"run_{body.run_id}_{uid}.onnx")
            file_path = export_onnx(model, out)
        elif fmt == "tflite":
            out = str(EXPORT_DIR / f"run_{body.run_id}_{uid}.tflite")
            file_path = export_tflite(model, out)
        else:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid format", "detail": body.format},
            )

        rec = ExportedModel(run_id=body.run_id, format=fmt, file_path=file_path)
        session.add(rec)
        session.commit()
        session.refresh(rec)
        return {"file_path": file_path, "export_id": rec.id}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Export failed", "detail": str(e)},
        )


@router.get("/api/export/{export_id}/download")
def download_export(export_id: int, session: Session = Depends(get_session)):
    rec = session.get(ExportedModel, export_id)
    if not rec:
        return JSONResponse(
            status_code=404,
            content={"error": "Export not found", "detail": str(export_id)},
        )
    path = rec.file_path
    if not path or not os.path.exists(path):
        return JSONResponse(
            status_code=404,
            content={"error": "File missing", "detail": path},
        )
    if os.path.isdir(path):
        return JSONResponse(
            status_code=400,
            content={"error": "Use SavedModel path export", "detail": path},
        )
    ext = os.path.splitext(path)[1].lower()
    media = "application/octet-stream"
    if ext == ".pdf":
        media = "application/pdf"
    elif ext == ".docx":
        media = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    return FileResponse(path, filename=os.path.basename(path), media_type=media)
