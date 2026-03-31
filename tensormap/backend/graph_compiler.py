from typing import Any

from layer_registry import LAYER_REGISTRY
from ml_runtime import import_tensorflow


def _parse_input_shape(params: dict) -> tuple:
    shape = params.get("shape", "28,28,1")
    if isinstance(shape, str):
        parts = [int(x.strip()) for x in shape.split(",") if x.strip()]
    elif isinstance(shape, (list, tuple)):
        parts = [int(x) for x in shape]
    else:
        raise ValueError(
            "Input.shape must be a comma-separated string or a list of integers"
        )
    if len(parts) < 1:
        raise ValueError("Input.shape must have at least one dimension")
    return tuple(parts)


def _normalize_layer_kwargs(keras_class: str, params: dict) -> dict:
    kwargs = dict(params)
    if keras_class == "Conv2D":
        ks = kwargs.get("kernel_size")
        if isinstance(ks, int):
            kwargs["kernel_size"] = (ks, ks)
    if keras_class == "MaxPooling2D":
        ps = kwargs.get("pool_size")
        if isinstance(ps, int):
            kwargs["pool_size"] = (ps, ps)
    for key in ("activation",):
        if kwargs.get(key) == "linear":
            kwargs[key] = None
    return kwargs


def _merge_tensors(tf: Any, tensors: list):
    if len(tensors) == 1:
        return tensors[0]
    if len(tensors) == 0:
        raise ValueError("Internal error: no predecessor tensors")
    try:
        shapes = [tuple(t.shape.as_list()) for t in tensors]
    except Exception as e:
        raise ValueError(f"Cannot read tensor shapes for merge: {e}") from e
    if all(s == shapes[0] for s in shapes):
        return tf.keras.layers.Add()(tensors)
    try:
        return tf.keras.layers.Concatenate(axis=-1)(tensors)
    except Exception as e:
        raise ValueError(
            f"Incompatible layer connections: cannot merge shapes {shapes}. "
            f"Add() requires identical shapes; Concatenate failed: {e}"
        ) from e


def _layer_type(node: dict) -> str:
    t = node.get("type")
    data = node.get("data") or {}
    if t and t not in ("layer", "default"):
        return t
    return data.get("layerType") or ""


def _node_params(node: dict) -> dict:
    data = node.get("data") or {}
    return dict(data.get("params") or {})


def compile_graph(nodes: list, edges: list) -> Any:
    """
    nodes: [{"id": "1", "type": "Dense", "data": {"params": {...}, "layerType": "Dense"}}]
    edges: [{"source": "1", "target": "2"}]
    """
    tf = import_tensorflow()

    if not nodes:
        raise ValueError("Graph has no nodes")

    node_map = {str(n["id"]): n for n in nodes}
    ids = set(node_map.keys())

    preds: dict[str, list[str]] = {nid: [] for nid in ids}
    succs: dict[str, list[str]] = {nid: [] for nid in ids}
    for e in edges:
        s, t = str(e["source"]), str(e["target"])
        if s not in ids or t not in ids:
            raise ValueError(f"Edge references unknown node: {s} -> {t}")
        preds[t].append(s)
        succs[s].append(t)

    input_nodes = [nid for nid, n in node_map.items() if _layer_type(n) == "Input"]
    if len(input_nodes) == 0:
        raise ValueError("Graph is missing a required Input node")
    if len(input_nodes) > 1:
        raise ValueError("Graph must have exactly one Input node")

    input_id = input_nodes[0]
    if preds[input_id]:
        raise ValueError("Input node must not have incoming edges")

    out_candidates = [nid for nid in ids if not succs[nid]]
    if len(out_candidates) != 1:
        raise ValueError(
            "Graph must have exactly one output node (no outgoing edges); "
            f"found {len(out_candidates)}: {out_candidates}"
        )
    output_id = out_candidates[0]
    if output_id == input_id:
        raise ValueError("Input cannot be the only output; add at least one layer after Input")

    reachable: set[str] = set()
    stack = [input_id]
    while stack:
        cur = stack.pop()
        if cur in reachable:
            continue
        reachable.add(cur)
        for nx in succs[cur]:
            stack.append(nx)
    if len(reachable) != len(ids):
        missing = sorted(ids - reachable)
        raise ValueError(f"Disconnected nodes (not reachable from Input): {missing}")

    rev: set[str] = set()
    stack = [output_id]
    while stack:
        cur = stack.pop()
        if cur in rev:
            continue
        rev.add(cur)
        for pr in preds[cur]:
            stack.append(pr)
    if len(rev) != len(ids):
        missing = sorted(ids - rev)
        raise ValueError(f"Disconnected nodes (not on path to output): {missing}")

    in_degree = {nid: len(preds[nid]) for nid in ids}
    queue = sorted([nid for nid in ids if in_degree[nid] == 0])
    order: list[str] = []
    while queue:
        u = queue.pop(0)
        order.append(u)
        for v in sorted(succs[u]):
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.append(v)
        queue.sort()

    if len(order) != len(ids):
        raise ValueError("Graph contains a cycle (topological sort incomplete)")

    tensor_map: dict[str, Any] = {}

    for nid in order:
        node = node_map[nid]
        ltype = _layer_type(node)
        params = _node_params(node)

        if ltype == "Input":
            shape = _parse_input_shape(params)
            tensor_map[nid] = tf.keras.Input(shape=shape)
            continue

        if ltype not in LAYER_REGISTRY:
            raise ValueError(f"Unknown layer type: {ltype}")

        pred_ids = preds[nid]
        if not pred_ids:
            raise ValueError(f"Layer node {nid} ({ltype}) has no incoming edges")

        if len(pred_ids) == 1:
            x = tensor_map[pred_ids[0]]
        else:
            x = _merge_tensors(tf, [tensor_map[pid] for pid in pred_ids])

        entry = LAYER_REGISTRY[ltype]
        keras_class = entry["keras_class"]
        if keras_class == "Input":
            raise ValueError("Invalid registry entry: Input must only be used as graph Input node")

        kwargs = _normalize_layer_kwargs(keras_class, params)
        try:
            LayerCls = getattr(tf.keras.layers, keras_class)
            layer = LayerCls(**kwargs)
            out = layer(x)
        except Exception as e:
            raise ValueError(
                f"Failed to build layer {ltype} (id={nid}) with params {kwargs}: {e}"
            ) from e

        tensor_map[nid] = out

    input_tensor = tensor_map[input_id]
    output_tensor = tensor_map[output_id]
    return tf.keras.Model(inputs=input_tensor, outputs=output_tensor)
