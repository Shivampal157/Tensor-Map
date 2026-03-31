import asyncio
import logging
from pathlib import Path
from typing import Any

import socketio
from sqlmodel import Session

from database import engine
from graph_compiler import compile_graph
from ml_runtime import import_tensorflow

from models import TrainingRun

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)


def _make_training_callback(tf: Any, socket_server, run_id: int, loop: asyncio.AbstractEventLoop):
    class TrainingCallback(tf.keras.callbacks.Callback):
        def __init__(self):
            self.sio = socket_server
            self.run_id = run_id
            self.loop = loop

        def on_epoch_end(self, epoch, logs=None):
            logs = logs or {}
            payload = {
                "run_id": self.run_id,
                "epoch": epoch + 1,
                "loss": logs.get("loss"),
                "accuracy": logs.get("accuracy"),
                "val_loss": logs.get("val_loss"),
                "val_accuracy": logs.get("val_accuracy"),
                "val_mae": logs.get("val_mae"),
                "mae": logs.get("mae"),
            }

            async def _emit():
                # Broadcast (no room): clients filter by run_id; avoids missing events
                # if the browser joins the room after the first epoch.
                await self.sio.emit("training_update", payload)

            asyncio.run_coroutine_threadsafe(_emit(), self.loop).result(timeout=120)

        def on_train_end(self, logs=None):
            async def _emit():
                await self.sio.emit("training_complete", {"run_id": self.run_id})

            asyncio.run_coroutine_threadsafe(_emit(), self.loop).result(timeout=120)

    return TrainingCallback()


def _emit_training_error(sio_server, loop: asyncio.AbstractEventLoop, run_id: int, message: str):
    async def _emit():
        await sio_server.emit(
            "training_error",
            {"run_id": run_id, "message": message},
        )

    asyncio.run_coroutine_threadsafe(_emit(), loop).result(timeout=120)


def _build_optimizer(tf: Any, config: dict) -> Any:
    name = str(config.get("optimizer", "adam")).lower()
    lr = float(config.get("learning_rate", 0.001))
    if name == "adam":
        return tf.keras.optimizers.Adam(learning_rate=lr)
    if name == "sgd":
        return tf.keras.optimizers.SGD(learning_rate=lr)
    if name == "rmsprop":
        return tf.keras.optimizers.RMSprop(learning_rate=lr)
    return tf.keras.optimizers.Adam(learning_rate=lr)


def _load_dataset(tf: Any, dataset_name: str) -> tuple[Any, Any]:
    name = dataset_name.lower()
    if name == "mnist":
        (x, y), _ = tf.keras.datasets.mnist.load_data()
        x = x[..., None].astype("float32") / 255.0
        y = tf.keras.utils.to_categorical(y, 10)
        return x, y
    if name == "fashion_mnist":
        (x, y), _ = tf.keras.datasets.fashion_mnist.load_data()
        x = x[..., None].astype("float32") / 255.0
        y = tf.keras.utils.to_categorical(y, 10)
        return x, y
    if name == "cifar10":
        (x, y), _ = tf.keras.datasets.cifar10.load_data()
        y = y.reshape(-1)
        x = x.astype("float32") / 255.0
        y = tf.keras.utils.to_categorical(y, 10)
        return x, y
    if name == "boston_housing":
        (x, y), _ = tf.keras.datasets.boston_housing.load_data()
        x = x.astype("float32")
        mean = x.mean(axis=0)
        std = x.std(axis=0)
        std[std == 0] = 1.0
        x = (x - mean) / std
        y = y.astype("float32")
        return x, y
    raise ValueError(f"Unknown dataset: {dataset_name}")


def _metrics_for_loss(loss: str) -> list:
    l = loss.lower()
    if l in ("categorical_crossentropy", "binary_crossentropy"):
        return ["accuracy"]
    return ["mae"]


def _assert_output_matches_labels(model: Any, y: Any, loss: str, dataset_name: str) -> None:
    """
    Fail fast with a clear message before model.fit (avoids opaque shape errors).
    """
    loss_l = str(loss).lower()
    out_shape = model.output_shape
    if not out_shape or len(out_shape) < 1:
        return
    out_dim = out_shape[-1]
    if out_dim is None:
        return

    if loss_l == "categorical_crossentropy":
        if getattr(y, "ndim", 0) != 2:
            raise ValueError(
                f"For {loss} the labels must be one-hot encoded (2D). "
                f"Dataset {dataset_name!r} produced shape {getattr(y, 'shape', '?')}."
            )
        n_classes = int(y.shape[-1])
        if int(out_dim) != n_classes:
            raise ValueError(
                f"Output size mismatch for dataset {dataset_name!r}: labels use "
                f"{n_classes} classes (one-hot width {n_classes}), but the model's "
                f"last layer outputs size {out_dim}. Set the **final Dense** layer's "
                f"**units** to **{n_classes}** (e.g. 10 for MNIST / Fashion-MNIST / CIFAR-10)."
            )
    if loss_l == "mse" and getattr(y, "ndim", 0) == 1 and int(out_dim) != 1:
        raise ValueError(
            f"For regression on {dataset_name!r}, targets are shape {y.shape}, "
            f"but the model output size is {out_dim}. End with a layer that outputs "
            f"**one value** (e.g. Dense with units=1, linear)."
        )


def _run_training_sync(
    run_id: int,
    nodes: list,
    edges: list,
    config: dict,
    dataset_name: str,
    loop: asyncio.AbstractEventLoop,
):
    try:
        tf = import_tensorflow()
    except RuntimeError as e:
        _emit_training_error(sio, loop, run_id, str(e))
        with Session(engine) as session:
            run = session.get(TrainingRun, run_id)
            if run:
                run.status = "failed"
                run.error_message = str(e)
                session.add(run)
                session.commit()
        return

    try:
        model = compile_graph(nodes, edges)
    except Exception as e:
        with Session(engine) as session:
            run = session.get(TrainingRun, run_id)
            if run:
                run.status = "failed"
                run.error_message = str(e)
                session.add(run)
                session.commit()
        _emit_training_error(sio, loop, run_id, str(e))
        return

    opt = _build_optimizer(tf, config)
    loss = config.get("loss", "categorical_crossentropy")
    metrics = _metrics_for_loss(loss)

    try:
        model.compile(optimizer=opt, loss=loss, metrics=metrics)
    except Exception as e:
        with Session(engine) as session:
            run = session.get(TrainingRun, run_id)
            if run:
                run.status = "failed"
                run.error_message = str(e)
                session.add(run)
                session.commit()
        _emit_training_error(sio, loop, run_id, str(e))
        return

    try:
        x, y = _load_dataset(tf, dataset_name)
    except Exception as e:
        with Session(engine) as session:
            run = session.get(TrainingRun, run_id)
            if run:
                run.status = "failed"
                run.error_message = str(e)
                session.add(run)
                session.commit()
        _emit_training_error(sio, loop, run_id, str(e))
        return

    try:
        _assert_output_matches_labels(model, y, loss, dataset_name)
    except ValueError as e:
        with Session(engine) as session:
            run = session.get(TrainingRun, run_id)
            if run:
                run.status = "failed"
                run.error_message = str(e)
                session.add(run)
                session.commit()
        _emit_training_error(sio, loop, run_id, str(e))
        return

    cb = _make_training_callback(tf, sio, run_id, loop)
    weights_path = str(CHECKPOINT_DIR / f"run_{run_id}.weights.h5")

    with Session(engine) as session:
        run = session.get(TrainingRun, run_id)
        if run:
            run.status = "running"
            session.add(run)
            session.commit()

    async def _emit_started():
        await sio.emit("training_started", {"run_id": run_id})

    try:
        asyncio.run_coroutine_threadsafe(_emit_started(), loop).result(timeout=30)
    except Exception:
        logging.exception("Emit training_started failed (run_id=%s)", run_id)

    try:
        history = model.fit(
            x,
            y,
            epochs=int(config.get("epochs", 10)),
            batch_size=int(config.get("batch_size", 32)),
            validation_split=0.2,
            callbacks=[cb],
            verbose=0,
        )
        model.save_weights(weights_path)
    except Exception as e:
        with Session(engine) as session:
            run = session.get(TrainingRun, run_id)
            if run:
                run.status = "failed"
                run.error_message = str(e)
                session.add(run)
                session.commit()
        _emit_training_error(sio, loop, run_id, str(e))
        return

    hist = history.history
    n = len(hist.get("loss", []))
    metrics_history: list[dict[str, Any]] = []
    metric_keys = (
        "loss",
        "accuracy",
        "mae",
        "val_loss",
        "val_accuracy",
        "val_mae",
    )
    for i in range(n):
        row: dict[str, Any] = {"epoch": i + 1}
        for key in metric_keys:
            if key in hist:
                row[key] = hist[key][i]
        metrics_history.append(row)

    with Session(engine) as session:
        run = session.get(TrainingRun, run_id)
        if run:
            run.status = "complete"
            run.metrics_history = metrics_history
            run.weights_path = weights_path
            run.error_message = None
            session.add(run)
            session.commit()


async def start_training(
    run_id: int,
    nodes: list,
    edges: list,
    config: dict,
    dataset_name: str,
):
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None,
            lambda: _run_training_sync(run_id, nodes, edges, config, dataset_name, loop),
        )
    except Exception:
        logging.exception("start_training executor failed (run_id=%s)", run_id)
        try:
            _emit_training_error(sio, loop, run_id, "Training task crashed; check server logs.")
        except Exception:
            logging.exception("Could not emit training_error for run_id=%s", run_id)
        with Session(engine) as session:
            run = session.get(TrainingRun, run_id)
            if run and run.status not in ("complete",):
                run.status = "failed"
                run.error_message = run.error_message or "Training task crashed"
                session.add(run)
                session.commit()
