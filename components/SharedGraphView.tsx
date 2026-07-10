"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { GitBranch, GitMerge, MessageSquare } from "lucide-react";
import { SharedSnapshot, SharedThreadSnapshot } from "@/types";
import { isBranchMerged } from "@/lib/merge";
import SharedMessageRow from "./SharedMessageRow";

// Big chat-card nodes: the whole conversation lives on the canvas.
const NODE_W = 400;
const NODE_H = 480;

type ThreadCardData = {
  thread: SharedThreadSnapshot;
  forkQuote: string | null;
  isMain: boolean;
  isMerged: boolean;
};

function ThreadCardNode({ data }: NodeProps) {
  const d = data as unknown as ThreadCardData;
  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-zinc-600 !border-0" />
      <div
        className={`w-full h-full rounded-2xl border flex flex-col overflow-hidden bg-[#0c0f1a]/95 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.45)] ${
          d.isMain
            ? "border-blue-500/40"
            : d.isMerged
              ? "border-violet-500/30"
              : "border-[#1c2035]"
        }`}
      >
        {/* Header — the drag handle */}
        <div className={`drag-handle cursor-grab active:cursor-grabbing flex items-center gap-2 px-3.5 py-2.5 border-b shrink-0 ${
          d.isMain ? "border-blue-500/20 bg-blue-600/5" : d.isMerged ? "border-violet-500/20 bg-violet-600/5" : "border-[#1c2035]"
        }`}>
          {d.isMain
            ? <MessageSquare size={11} className="text-blue-400 shrink-0" />
            : d.isMerged
            ? <GitMerge size={11} className="text-violet-400 shrink-0" />
            : <GitBranch size={11} className="text-zinc-500 shrink-0" />}
          <span className={`text-xs font-medium truncate flex-1 ${
            d.isMain ? "text-blue-300" : d.isMerged ? "text-violet-300" : "text-zinc-300"
          }`}>
            {d.isMain ? "main thread" : d.thread.name}
          </span>
          {d.isMerged && (
            <span className="text-[9px] text-violet-400 border border-violet-500/30 bg-violet-600/10 px-1.5 py-px rounded-full shrink-0">
              merged
            </span>
          )}
          <span className="text-[10px] text-zinc-600 shrink-0">{d.thread.messages.length} msgs</span>
        </div>

        {/* Fork quote */}
        {d.forkQuote && (
          <div className="px-3.5 py-2 border-b border-[#1c2035]/50 bg-[#07090f]/60 flex items-start gap-2 shrink-0">
            <GitBranch size={9} className="mt-0.5 shrink-0 text-zinc-700" />
            <p className="text-[10px] text-zinc-600 leading-snug line-clamp-2 italic">"{d.forkQuote}"</p>
          </div>
        )}

        {/* Messages — nowheel keeps inner scroll from zooming the canvas */}
        <div className="nowheel flex-1 overflow-y-auto p-3 flex flex-col gap-3 cursor-default">
          {d.thread.messages.length === 0 && (
            <p className="text-xs text-zinc-700 font-mono text-center pt-6">empty thread</p>
          )}
          {d.thread.messages.map((m) => (
            <div key={m.id} className="shrink-0">
              <SharedMessageRow role={m.role} content={m.content} compact />
            </div>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-zinc-600 !border-0" />
    </>
  );
}

const nodeTypes = { threadCard: ThreadCardNode };

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 140, marginx: 60, marginy: 60 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

interface Props {
  snapshot: SharedSnapshot;
}

export default function SharedGraphView({ snapshot }: Props) {
  const { nodes, edges } = useMemo(() => {
    const mergedIds = new Set(
      snapshot.threads
        .filter((t) => {
          const parent = snapshot.threads.find((p) => p.id === t.parentThreadId);
          return parent ? isBranchMerged(parent.messages, t.id) : false;
        })
        .map((t) => t.id)
    );

    const rawNodes: Node[] = snapshot.threads.map((t) => {
      const parent = snapshot.threads.find((p) => p.id === t.parentThreadId);
      const forkMessage = parent?.messages.find((m) => m.id === t.parentMessageId);
      return {
        id: t.id,
        type: "threadCard",
        position: { x: 0, y: 0 },
        dragHandle: ".drag-handle",
        data: {
          thread: t,
          forkQuote: forkMessage?.content ?? null,
          isMain: t.id === snapshot.mainThreadId,
          isMerged: mergedIds.has(t.id),
        } satisfies ThreadCardData,
        style: { width: NODE_W, height: NODE_H },
      };
    });

    const rawEdges: Edge[] = snapshot.threads
      .filter((t) => t.parentThreadId)
      .map((t) => ({
        id: `e-${t.parentThreadId}-${t.id}`,
        source: t.parentThreadId!,
        target: t.id,
        type: "smoothstep",
        style: mergedIds.has(t.id)
          ? { stroke: "#8b5cf6", strokeWidth: 1.5, strokeDasharray: "4 3" }
          : { stroke: "#2a3050", strokeWidth: 1.5 },
      }));

    return { nodes: applyDagreLayout(rawNodes, rawEdges), edges: rawEdges };
  }, [snapshot]);

  return (
    <ReactFlow
      defaultNodes={nodes}
      defaultEdges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 0.9 }}
      minZoom={0.1}
      maxZoom={1.75}
      nodesDraggable
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      className="bg-[#07090f]"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1a1f30" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
