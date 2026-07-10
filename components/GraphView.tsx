"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { useChatStore } from "@/store/useChatStore";
import { GitBranch, GitMerge, MessageSquare } from "lucide-react";
import { isBranchMerged } from "@/lib/merge";

const NODE_W = 210;
const NODE_H = 72;

// ── Custom node ────────────────────────────────────────────────────────────────

type ThreadNodeData = {
  label: string;
  messageCount: number;
  isMain: boolean;
  isActive: boolean;
  isMerged: boolean;
  onClick: () => void;
};

function ThreadNode({ data }: NodeProps) {
  const d = data as unknown as ThreadNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-zinc-600 !border-0" />
      <div
        onClick={d.onClick}
        className={`
          w-full h-full rounded-xl border px-3 py-2.5 flex flex-col justify-between
          cursor-pointer transition-all duration-150 select-none
          ${d.isMain
            ? "bg-blue-600/15 border-blue-500/40 hover:border-blue-400/60"
            : d.isActive
              ? "bg-green-600/10 border-green-500/40 hover:border-green-400/60"
              : d.isMerged
                ? "bg-violet-600/10 border-violet-500/30 hover:border-violet-400/50"
                : "bg-zinc-900/90 border-zinc-700/60 hover:border-zinc-500/60"}
        `}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {d.isMain
            ? <MessageSquare size={10} className="text-blue-400 shrink-0" />
            : d.isMerged && !d.isActive
            ? <GitMerge size={10} className="text-violet-400 shrink-0" />
            : <GitBranch size={10} className={d.isActive ? "text-green-400 shrink-0" : "text-zinc-500 shrink-0"} />}
          <span className={`text-xs font-medium truncate flex-1 ${
            d.isMain ? "text-blue-300" : d.isActive ? "text-green-300" : d.isMerged ? "text-violet-300" : "text-zinc-300"
          }`}>
            {d.label}
          </span>
          {d.isMerged && (
            <span className="text-[9px] text-violet-400 border border-violet-500/30 bg-violet-600/10 px-1 py-px rounded-full shrink-0">
              merged
            </span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600 mt-1">
          {d.messageCount} {d.messageCount === 1 ? "message" : "messages"}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-zinc-600 !border-0" />
    </>
  );
}

const nodeTypes = { thread: ThreadNode };

// ── Dagre layout ───────────────────────────────────────────────────────────────

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80, marginx: 40, marginy: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  onSwitchToCanvas: (threadId?: string) => void;
}

export default function GraphView({ onSwitchToCanvas }: Props) {
  const { currentConversation, activeThread, setActiveThread } = useChatStore();

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!currentConversation) return { initialNodes: [], initialEdges: [] };

    const mergedIds = new Set(
      currentConversation.threads
        .filter((t) => {
          const parent = currentConversation.threads.find((p) => p.id === t.parentThreadId);
          return parent ? isBranchMerged(parent.messages, t.id) : false;
        })
        .map((t) => t.id)
    );

    const rawNodes: Node[] = currentConversation.threads.map((t) => ({
      id: t.id,
      type: "thread",
      position: { x: 0, y: 0 },
      data: {
        label: t.name,
        messageCount: t.messages.length,
        isMain: t.id === currentConversation.mainThreadId,
        isActive: t.id === activeThread?.id,
        isMerged: mergedIds.has(t.id),
        onClick: async () => {
          await setActiveThread(t.id);
          onSwitchToCanvas(t.id);
        },
      } satisfies ThreadNodeData,
      style: { width: NODE_W, height: NODE_H },
    }));

    const rawEdges: Edge[] = currentConversation.threads
      .filter((t) => t.parentThreadId)
      .map((t) => ({
        id: `e-${t.parentThreadId}-${t.id}`,
        source: t.parentThreadId!,
        target: t.id,
        type: "smoothstep",
        style: mergedIds.has(t.id)
          ? { stroke: "#8b5cf6", strokeWidth: 1.5, strokeDasharray: "4 3" }
          : { stroke: "#3f3f46", strokeWidth: 1.5 },
        animated: t.id === activeThread?.id,
      }));

    return {
      initialNodes: applyDagreLayout(rawNodes, rawEdges),
      initialEdges: rawEdges,
    };
  }, [currentConversation, activeThread]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#27272a"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
