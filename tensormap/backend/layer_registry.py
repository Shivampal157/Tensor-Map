"""Single source of truth for Keras layer types exposed by TensorMap."""

LAYER_REGISTRY = {
    "Input": {
        "keras_class": "Input",
        "category": "core",
        "params": {
            "shape": {
                "type": "string",
                "default": "28,28,1",
            }
        },
        "description": "Model input (comma-separated dims, e.g. 28,28,1)",
    },
    "Dense": {
        "keras_class": "Dense",
        "category": "core",
        "params": {
            "units": {"type": "int", "default": 64, "min": 1, "max": 2048},
            "activation": {
                "type": "select",
                "default": "relu",
                "options": ["relu", "sigmoid", "tanh", "softmax", "linear"],
            },
            "use_bias": {"type": "bool", "default": True},
        },
        "description": "Fully connected layer",
    },
    "Conv2D": {
        "keras_class": "Conv2D",
        "category": "convolutional",
        "params": {
            "filters": {"type": "int", "default": 32, "min": 1, "max": 512},
            "kernel_size": {"type": "int", "default": 3, "min": 1, "max": 11},
            "activation": {
                "type": "select",
                "default": "relu",
                "options": ["relu", "sigmoid", "tanh", "linear"],
            },
            "padding": {"type": "select", "default": "same", "options": ["same", "valid"]},
        },
        "description": "2D convolution layer",
    },
    "LSTM": {
        "keras_class": "LSTM",
        "category": "recurrent",
        "params": {
            "units": {"type": "int", "default": 64, "min": 1, "max": 512},
            "return_sequences": {"type": "bool", "default": False},
        },
        "description": "Long Short-Term Memory layer",
    },
    "Dropout": {
        "keras_class": "Dropout",
        "category": "regularization",
        "params": {"rate": {"type": "float", "default": 0.5, "min": 0.0, "max": 0.9}},
        "description": "Randomly sets inputs to zero during training",
    },
    "BatchNormalization": {
        "keras_class": "BatchNormalization",
        "category": "normalization",
        "params": {},
        "description": "Normalizes activations of the previous layer",
    },
    "MaxPooling2D": {
        "keras_class": "MaxPooling2D",
        "category": "pooling",
        "params": {"pool_size": {"type": "int", "default": 2, "min": 1, "max": 8}},
        "description": "Max pooling for 2D spatial data",
    },
    "Flatten": {
        "keras_class": "Flatten",
        "category": "core",
        "params": {},
        "description": "Flattens input to 1D",
    },
    "Embedding": {
        "keras_class": "Embedding",
        "category": "core",
        "params": {
            "input_dim": {"type": "int", "default": 1000, "min": 1, "max": 100000},
            "output_dim": {"type": "int", "default": 64, "min": 1, "max": 1024},
        },
        "description": "Turns positive integers into dense vectors",
    },
    "GRU": {
        "keras_class": "GRU",
        "category": "recurrent",
        "params": {
            "units": {"type": "int", "default": 64, "min": 1, "max": 512},
            "return_sequences": {"type": "bool", "default": False},
        },
        "description": "Gated Recurrent Unit layer",
    },
    "Conv1D": {
        "keras_class": "Conv1D",
        "category": "convolutional",
        "params": {
            "filters": {"type": "int", "default": 32, "min": 1, "max": 512},
            "kernel_size": {"type": "int", "default": 3, "min": 1, "max": 11},
            "activation": {
                "type": "select",
                "default": "relu",
                "options": ["relu", "sigmoid", "tanh", "linear"],
            },
        },
        "description": "1D convolution layer",
    },
    "GlobalAveragePooling2D": {
        "keras_class": "GlobalAveragePooling2D",
        "category": "pooling",
        "params": {},
        "description": "Global average pooling for spatial data",
    },
}
