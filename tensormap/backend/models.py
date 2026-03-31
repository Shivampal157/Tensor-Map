from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class ModelGraph(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = "Untitled"
    nodes: list[Any] = Field(sa_column=Column(JSON))
    edges: list[Any] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TrainingRun(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    graph_id: int = Field(foreign_key="modelgraph.id")
    status: str = Field(default="pending")
    config: dict[str, Any] = Field(sa_column=Column(JSON))
    metrics_history: list[Any] = Field(default_factory=list, sa_column=Column(JSON))
    error_message: Optional[str] = Field(default=None)
    weights_path: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExportedModel(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="trainingrun.id")
    format: str
    file_path: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
