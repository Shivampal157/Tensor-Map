from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from layer_registry import LAYER_REGISTRY

router = APIRouter(prefix="/api/layers", tags=["layers"])


@router.get("")
def list_layers():
    return LAYER_REGISTRY


@router.get("/{layer_type}")
def get_layer(layer_type: str):
    if layer_type not in LAYER_REGISTRY:
        return JSONResponse(
            status_code=404,
            content={"error": "Unknown layer type", "detail": layer_type},
        )
    return LAYER_REGISTRY[layer_type]
