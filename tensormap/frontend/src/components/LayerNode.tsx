import { memo } from 'react';
import { Handle, NodeProps, Position, useReactFlow } from 'reactflow';

import type { LayerDefinition, LayerNodeData } from '../types';

const handleStyle = {
  width: 12,
  height: 12,
  zIndex: 2,
} as const;

function LayerNodeImpl({
  id,
  data,
  isConnectable = true,
}: NodeProps<LayerNodeData>) {
  const { setNodes } = useReactFlow();
  const def: LayerDefinition = data.definition;

  const setParam = (key: string, value: string | number | boolean) => {
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                params: { ...n.data.params, [key]: value },
              } as LayerNodeData,
            }
          : n,
      ),
    );
  };

  const categoryLabel = (def.category || 'other').replace(/_/g, ' ');

  return (
    <div className="layer-node">
      <header className="layer-node__head">
        <span className="layer-node__name">{data.layerType}</span>
        <span className="layer-node__cat">{categoryLabel}</span>
      </header>
      <div className="layer-node__params">
        {Object.entries(def.params).map(([pkey, spec]) => (
          <div key={pkey} className="layer-node__row">
            <label htmlFor={`${id}-${pkey}`} className="layer-node__key">
              {pkey}
            </label>
            {spec.type === 'bool' ? (
              <input
                id={`${id}-${pkey}`}
                type="checkbox"
                className="layer-node__check"
                checked={Boolean(data.params[pkey])}
                onChange={(e) => setParam(pkey, e.target.checked)}
              />
            ) : spec.type === 'select' ? (
              <select
                id={`${id}-${pkey}`}
                className="layer-node__control"
                value={String(data.params[pkey] ?? spec.default)}
                onChange={(e) => setParam(pkey, e.target.value)}
              >
                {(spec.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : spec.type === 'float' ? (
              <input
                id={`${id}-${pkey}`}
                className="layer-node__control"
                type="number"
                step={0.01}
                min={spec.min}
                max={spec.max}
                value={Number(data.params[pkey] ?? spec.default)}
                onChange={(e) => setParam(pkey, parseFloat(e.target.value))}
              />
            ) : spec.type === 'string' ? (
              <input
                id={`${id}-${pkey}`}
                className="layer-node__control"
                type="text"
                value={String(data.params[pkey] ?? spec.default ?? '')}
                onChange={(e) => setParam(pkey, e.target.value)}
              />
            ) : (
              <input
                id={`${id}-${pkey}`}
                className="layer-node__control"
                type="number"
                step={1}
                min={spec.min}
                max={spec.max}
                value={Number(data.params[pkey] ?? spec.default)}
                onChange={(e) => setParam(pkey, parseInt(e.target.value, 10))}
              />
            )}
          </div>
        ))}
      </div>
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#1a7f72', border: '2px solid #fff' }}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        style={{ ...handleStyle, background: '#c96c21', border: '2px solid #fff' }}
      />
    </div>
  );
}

export const LayerNode = memo(LayerNodeImpl);
