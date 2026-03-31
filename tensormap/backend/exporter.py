import os
from typing import Any

from ml_runtime import import_tensorflow


def export_savedmodel(model: Any, output_path: str) -> str:
    os.makedirs(output_path, exist_ok=True)
    model.save(output_path)
    return output_path


def export_onnx(model: Any, output_path: str) -> str:
    import onnx
    import tf2onnx

    import_tensorflow()  # ensure TF present for from_keras
    onnx_model, _ = tf2onnx.convert.from_keras(model, opset=13)
    parent = os.path.dirname(os.path.abspath(output_path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    onnx.save(onnx_model, output_path)
    return output_path


def export_tflite(model: Any, output_path: str) -> str:
    tf = import_tensorflow()
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    parent = os.path.dirname(os.path.abspath(output_path)) or "."
    os.makedirs(parent, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(tflite_model)
    return output_path
