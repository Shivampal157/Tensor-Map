import logging

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import socketio

from database import create_db
from routers import export, layers, training
from trainer import sio

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="TensorMap API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    create_db()


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    detail = exc.detail
    msg = detail if isinstance(detail, str) else "HTTP error"
    detail_str = str(detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": msg, "detail": detail_str},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "detail": exc.errors()},
    )


app.include_router(layers.router)
app.include_router(training.router)
app.include_router(export.router)


@sio.event
async def join_run(sid, data):
    if not isinstance(data, dict):
        return
    rid = data.get("run_id")
    await sio.enter_room(sid, f"run_{rid}")


socket_app = socketio.ASGIApp(sio, app)
