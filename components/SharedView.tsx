"use client";

import { useState } from "react";
import Link from "next/link";
import { GitBranch, MessageSquare, LayoutList, Waypoints } from "lucide-react";
import { SharedSnapshot, SharedThreadSnapshot } from "@/types";
import Logo from "./Logo";
import SharedGraphView from "./SharedGraphView";
import SharedMessageRow from "./SharedMessageRow";

interface Props {
  snapshot: SharedSnapshot;
  sharedAt: string;
}

// Branches in reading order: depth-first from the main thread, siblings sorted
// by fork position in their parent.
function orderBranches(snapshot: SharedSnapshot): Array<{ thread: SharedThreadSnapshot; depth: number }> {
  const byParent: Record<string, SharedThreadSnapshot[]> = {};
  for (const t of snapshot.threads) {
    if (t.id === snapshot.mainThreadId || !t.parentThreadId) continue;
    (byParent[t.parentThreadId] ??= []).push(t);
  }
  const forkIndex = (parentId: string, msgId: string | null) => {
    const parent = snapshot.threads.find((t) => t.id === parentId);
    const idx = parent?.messages.findIndex((m) => m.id === msgId) ?? -1;
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  for (const parentId of Object.keys(byParent)) {
    byParent[parentId].sort(
      (a, b) => forkIndex(parentId, a.parentMessageId) - forkIndex(parentId, b.parentMessageId)
    );
  }
  const out: Array<{ thread: SharedThreadSnapshot; depth: number }> = [];
  const walk = (id: string, depth: number) => {
    for (const branch of byParent[id] ?? []) {
      out.push({ thread: branch, depth });
      walk(branch.id, depth + 1);
    }
  };
  walk(snapshot.mainThreadId, 1);
  return out;
}

export default function SharedView({ snapshot, sharedAt }: Props) {
  const mainThread = snapshot.threads.find((t) => t.id === snapshot.mainThreadId);
  const branches = orderBranches(snapshot);
  const [mode, setMode] = useState<"map" | "read">("map");

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#07090f] flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-4 px-5 py-3 border-b border-[#1c2035]/60 bg-[#0c0f1a]/75 relative z-10">
        <Logo width={64} height={36} />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm text-zinc-200 font-medium truncate">{snapshot.title}</span>
          <span className="text-[10px] text-zinc-600 font-mono">
            read-only snapshot · shared {new Date(sharedAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center rounded-lg border border-[#1c2035] overflow-hidden shrink-0">
          {([["map", Waypoints], ["read", LayoutList]] as const).map(([m, Icon]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 transition-colors ${
                mode === m ? "bg-[#151a28] text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={12} />
              {m}
            </button>
          ))}
        </div>
        <Link
          href="/"
          className="text-xs px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shrink-0"
        >
          Try tan(AI) →
        </Link>
      </div>

      {/* Map mode: full-canvas mind map — every thread is a scrollable chat card */}
      {mode === "map" ? (
        <div className="flex-1 min-h-0">
          <SharedGraphView snapshot={snapshot} />
        </div>
      ) : (

      <div className="flex-1 flex overflow-hidden">
        {/* Main thread */}
        <div className="w-[55%] shrink-0 flex flex-col border-r border-[#1c2035]/60 bg-[#0c0f1a]/50">
          <div className="px-5 py-2.5 border-b border-[#1c2035]/50 flex items-center gap-2">
            <MessageSquare size={11} className="text-blue-400" />
            <span className="text-xs text-zinc-500 font-mono tracking-wide">main thread</span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {mainThread?.messages.map((m) => (
              <SharedMessageRow key={m.id} role={m.role} content={m.content} />
            ))}
          </div>
        </div>

        {/* Branches */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {branches.length === 0 && (
            <p className="text-xs text-zinc-700 font-mono pt-8 text-center">no branches in this conversation</p>
          )}
          {branches.map(({ thread, depth }) => {
            const parent = snapshot.threads.find((t) => t.id === thread.parentThreadId);
            const forkMessage = parent?.messages.find((m) => m.id === thread.parentMessageId);
            return (
              <div
                key={thread.id}
                style={{ marginLeft: (depth - 1) * 20 }}
                className="rounded-2xl border border-[#1c2035] bg-[#0c0f1a]/80 overflow-hidden shrink-0 max-w-2xl"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1c2035]">
                  <GitBranch size={11} className="text-zinc-500" />
                  <span className="text-xs font-medium text-zinc-400 truncate flex-1">{thread.name}</span>
                  <span className="text-[10px] text-zinc-600">{thread.messages.length} msgs</span>
                </div>
                {forkMessage && (
                  <div className="px-3 py-2 border-b border-[#1c2035]/50 bg-[#07090f]/60 flex items-start gap-2">
                    <GitBranch size={9} className="mt-0.5 shrink-0 text-zinc-700" />
                    <p className="text-[10px] text-zinc-600 leading-snug line-clamp-2 italic">
                      "{forkMessage.content}"
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-3 p-3">
                  {thread.messages.map((m) => (
                    <SharedMessageRow key={m.id} role={m.role} content={m.content} compact />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
