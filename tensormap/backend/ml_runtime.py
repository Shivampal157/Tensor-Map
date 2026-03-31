"""Import TensorFlow only when training/export/compile run (not at server startup)."""


def import_tensorflow():
    try:
        import tensorflow as tf  # type: ignore
    except ImportError as e:
        raise RuntimeError(
            "TensorFlow is missing or not built for this Python version. "
            "Use Python 3.10–3.12 (TensorFlow does not support 3.13+ yet on PyPI). "
            "Example: conda create -n tensormap python=3.12 -y && conda activate tensormap, "
            "then: pip install -r requirements-ml.txt"
        ) from e
    return tf
