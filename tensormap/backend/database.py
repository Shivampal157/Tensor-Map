import os

from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./tensormap.db",
)
_connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
engine = create_engine(DATABASE_URL, connect_args=_connect_args)


def get_session():
    with Session(engine) as session:
        yield session


def create_db():
    # Ensure model modules are imported so metadata contains all tables
    from models import ExportedModel, ModelGraph, TrainingRun  # noqa: F401

    SQLModel.metadata.create_all(engine)
