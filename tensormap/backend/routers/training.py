import copy
import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import desc
from sqlmodel import Session, select

from database import get_session
from models import ModelGraph, TrainingRun
from trainer import start_training

router = APIRouter(tags=["training"])
logger = logging.getLogger("tensormap.training")


class GraphCreate(BaseModel):
    name: Optional[str] = "Untitled"
    nodes: list[Any]
    edges: list[Any]


class TrainingStartBody(BaseModel):
    graph_id: int
    config: dict[str, Any]
    dataset: str


@router.post("/api/graphs")
def create_graph(body: GraphCreate, session: Session = Depends(get_session)):
    g = ModelGraph(name=body.name or "Untitled", nodes=body.nodes, edges=body.edges)
    session.add(g)
    session.commit()
    session.refresh(g)
    return {"id": g.id}


@router.get("/api/graphs/{graph_id}")
def get_graph(graph_id: int, session: Session = Depends(get_session)):
    g = session.get(ModelGraph, graph_id)
    if not g:
        return JSONResponse(
            status_code=404,
            content={"error": "Graph not found", "detail": str(graph_id)},
        )
    return {
        "id": g.id,
        "name": g.name,
        "nodes": g.nodes,
        "edges": g.edges,
        "created_at": g.created_at.isoformat(),
    }


async def _background_start_training(
    run_id: int,
    nodes: list,
    edges: list,
    config: dict[str, Any],
    dataset: str,
) -> None:
    """Runs after HTTP response; keeps failures visible in logs."""
    try:
        await start_training(run_id, nodes, edges, config, dataset)
    except Exception:
        logger.exception("Background training failed (run_id=%s)", run_id)


@router.post("/api/training/start")
async def training_start(
    body: TrainingStartBody,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    g = session.get(ModelGraph, body.graph_id)
    if not g:
        return JSONResponse(
            status_code=404,
            content={"error": "Graph not found", "detail": str(body.graph_id)},
        )

    cfg = dict(body.config)
    cfg["dataset"] = body.dataset

    run_m = TrainingRun(
        graph_id=body.graph_id,
        status="pending",
        config=cfg,
        metrics_history=[],
    )
    session.add(run_m)
    session.commit()
    session.refresh(run_m)
    run_id = run_m.id

    # Detach plain lists so SQLModel session teardown cannot affect training
    nodes = copy.deepcopy(g.nodes) if g.nodes is not None else []
    edges = copy.deepcopy(g.edges) if g.edges is not None else []

    background_tasks.add_task(
        _background_start_training,
        run_id,
        nodes,
        edges,
        cfg,
        body.dataset,
    )
    return {"run_id": run_id}


@router.get("/api/training/{run_id}")
def get_training(run_id: int, session: Session = Depends(get_session)):
    run = session.get(TrainingRun, run_id)
    if not run:
        return JSONResponse(
            status_code=404,
            content={"error": "Training run not found", "detail": str(run_id)},
        )
    return {
        "id": run.id,
        "graph_id": run.graph_id,
        "status": run.status,
        "config": run.config,
        "metrics_history": run.metrics_history,
        "error_message": run.error_message,
        "created_at": run.created_at.isoformat(),
    }


@router.get("/api/training")
def list_training(session: Session = Depends(get_session)):
    runs = session.exec(select(TrainingRun).order_by(desc(TrainingRun.created_at))).all()
    return [
        {
            "id": r.id,
            "graph_id": r.graph_id,
            "status": r.status,
            "config": r.config,
            "metrics_history": r.metrics_history,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat(),
        }
        for r in runs
    ]
