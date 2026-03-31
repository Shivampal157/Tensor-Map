import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  MiniMap,
  Node,
  ReactFlowInstance,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';

import type { LayerDefinition, LayerNodeData } from '../types';

import { peekPaletteDragLayerKey, setPaletteDragLayerKey } from '../paletteDnD';
import { DRAG_MIME } from './LayerPalette';
import { LayerNode } from './LayerNode';

import 'reactflow/dist/style.css';

export type GraphExport = {
  nodes: unknown[];
  edges: unknown[];
};

export type CanvasHandle = {
  getGraphData: () => GraphExport;
};

/** Internal: Flow instance API (drop handling on outer wrapper for WebKit / event bubbling). */
export type FlowCanvasApi = CanvasHandle & {
  dropLayerFromEvent: (e: React.DragEvent) => void;
};

function defaultsFromDefinition(
  def: LayerDefinition,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [k, spec] of Object.entries(def.params)) {
    params[k] = spec.default as string | number | boolean;
  }
  return params;
}

type FlowProps = {
  registry: Record<string, LayerDefinition>;
};

const Flow = forwardRef<FlowCanvasApi, FlowProps>(function Flow(
  { registry },
  ref,
) {
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const nodeTypes = useMemo(() => ({ layer: LayerNode }), []);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const dropLayerFromEvent = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const inst = rfRef.current;
      if (!inst) return;
      const fromPayload =
        e.dataTransfer.getData(DRAG_MIME).trim() ||
        e.dataTransfer.getData('text/plain').trim();
      const layerType = fromPayload || peekPaletteDragLayerKey();
      if (!layerType || !registry[layerType]) return;
      setPaletteDragLayerKey(null);
      const def = registry[layerType];
      const position = inst.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const data: LayerNodeData = {
        layerType,
        params: defaultsFromDefinition(def),
        definition: def,
      };
      const node: Node<LayerNodeData> = {
        id: crypto.randomUUID(),
        type: 'layer',
        position,
        data,
      };
      setNodes((nds) => nds.concat(node));
    },
    [registry, setNodes],
  );

  useImperativeHandle(
    ref,
    () => ({
      getGraphData: () => ({
        nodes: nodes.map((n) => ({
          id: n.id,
          type: 'layer',
          data: n.data,
          position: n.position,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
      }),
      dropLayerFromEvent,
    }),
    [nodes, edges, dropLayerFromEvent],
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="react-flow-root">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onInit={(i) => {
          rfRef.current = i;
        }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Backspace"
        connectionRadius={28}
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
});

export const Canvas = forwardRef<
  CanvasHandle,
  { registry: Record<string, LayerDefinition> }
>(function Canvas({ registry }, ref) {
  const flowApiRef = useRef<FlowCanvasApi | null>(null);

  useImperativeHandle(ref, () => ({
    getGraphData: () =>
      flowApiRef.current?.getGraphData() ?? { nodes: [], edges: [] },
  }));

  const allowDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDropCapture = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    flowApiRef.current?.dropLayerFromEvent(e);
  }, []);

  return (
    <div
      className="canvas-wrap"
      onDragEnter={allowDrop}
      onDragOver={allowDrop}
      onDragOverCapture={allowDrop}
      onDropCapture={onDropCapture}
    >
      <ReactFlowProvider>
        <Flow ref={flowApiRef} registry={registry} />
      </ReactFlowProvider>
    </div>
  );
});
