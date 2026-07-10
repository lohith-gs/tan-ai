"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useChatStore } from "@/store/useChatStore";
import MainThreadChat from "./MainThreadChat";
import BranchCard from "./BranchCard";
import GraphView from "./GraphView";
import { GitBranch, LayoutGrid, Share2, Check, Loader2 } from "lucide-react";

const BRANCH_LEFT = 56;
const BRANCH_WIDTH = 360;
const BRANCH_GAP = 20;
const BRANCH_COL_GAP = 40;
const MIN_LEFT_PX = 320;
const MIN_RIGHT_PX = 240;
const DEFAULT_LEFT_RATIO = 0.65;

export default function HybridCanvas() {
  const { currentConversation, activeThread, shareConversation } = useChatStore();
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied" | "error">("idle");

  async function handleShare() {
    if (shareState === "sharing") return;
    setShareState("sharing");
    const shareId = await shareConversation();
    if (!shareId) {
      setShareState("error");
      setTimeout(() => setShareState("idle"), 2500);
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${shareId}`);
      setShareState("copied");
    } catch {
      setShareState("error");
    }
    setTimeout(() => setShareState("idle"), 2500);
  }

  const containerRef    = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const branchAreaRef   = useRef<HTMLDivElement>(null);
  const messageEls      = useRef<Record<string, HTMLDivElement | null>>({});
  const isDragging      = useRef(false);

  const [viewMode, setViewMode]           = useState<"canvas" | "graph">("canvas");
  const [leftWidth, setLeftWidth]         = useState<number | null>(null);
  const [dragging, setDragging]           = useState(false);
  const pendingScrollThreadId             = useRef<string | null>(null);
  const branchTopsRef                    = useRef<Record<string, number>>({});
  const branchLeftsRef                   = useRef<Record<string, number>>({});
  const suppressBranchScrollSync         = useRef(false);
  const focusTimerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messageOffsets, setMessageOffsets]         = useState<Record<string, number>>({});
  const [branchHeights, setBranchHeights]           = useState<Record<string, number>>({});
  const [branchMessageOffsets, setBranchMessageOffsets] =
    useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (containerRef.current && leftWidth === null) {
      setLeftWidth(containerRef.current.offsetWidth * DEFAULT_LEFT_RATIO);
    }
  }, [leftWidth]);

  const mainThread = currentConversation?.threads.find(
    (t) => t.id === currentConversation.mainThreadId
  );
  const branchThreads =
    currentConversation?.threads.filter(
      (t) => t.id !== currentConversation.mainThreadId
    ) ?? [];

  const measureOffsets = useCallback(() => {
    const offsets: Record<string, number> = {};
    for (const [id, el] of Object.entries(messageEls.current)) {
      if (el) offsets[id] = el.offsetTop;
    }
    setMessageOffsets(offsets);
  }, []);

  useEffect(() => {
    const t = setTimeout(measureOffsets, 60);
    return () => clearTimeout(t);
  }, [mainThread?.messages.length, viewMode, measureOffsets]);

  // Focus the selected branch after switching back from graph view: scroll BOTH
  // panels to the branch point. This runs on a short timer after messageOffsets is
  // populated, so it fires after MainThreadChat's mount scroll-to-bottom has started
  // — assigning scrollTop then cancels that smooth animation instead of racing it.
  // No cleanup on purpose: measureOffsets fires on every scroll event and would
  // cancel the timer before it ever ran; focusTimerRef dedupes rescheduling.
  useEffect(() => {
    if (viewMode !== "canvas" || !pendingScrollThreadId.current) return;
    if (focusTimerRef.current) return;
    if (Object.keys(messageOffsets).length === 0) return;
    const threadId = pendingScrollThreadId.current;
    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      pendingScrollThreadId.current = null;
      suppressBranchScrollSync.current = false;
      const top = branchTopsRef.current[threadId];
      if (top === undefined) return;
      const target = Math.max(0, top - 40);
      messagesAreaRef.current?.scrollTo({ top: target, behavior: "auto" });
      if (branchAreaRef.current) {
        branchAreaRef.current.scrollTop = target;
        const left = branchLeftsRef.current[threadId];
        if (left !== undefined) {
          branchAreaRef.current.scrollLeft = Math.max(0, left - BRANCH_LEFT);
        }
      }
    }, 120);
  }, [viewMode, messageOffsets]);

  function handleMainScroll() {
    measureOffsets();
    if (suppressBranchScrollSync.current) return;
    if (branchAreaRef.current && messagesAreaRef.current) {
      branchAreaRef.current.scrollTop = messagesAreaRef.current.scrollTop;
    }
  }

  // ── Drag logic ───────────────────────────────────────────────────────────────
  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return;
      const containerLeft = containerRef.current.getBoundingClientRect().left;
      const containerWidth = containerRef.current.offsetWidth;
      const desired = e.clientX - containerLeft;
      const clamped = Math.max(MIN_LEFT_PX, Math.min(containerWidth - MIN_RIGHT_PX, desired));
      setLeftWidth(clamped);
    }

    function onMouseUp() {
      isDragging.current = false;
      setDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  // ── Branch message ref handler ───────────────────────────────────────────────
  const handleBranchMessageRef = useCallback(
    (branchId: string, messageId: string, el: HTMLDivElement | null) => {
      if (!el) return;
      const newOffset = el.offsetTop;
      setBranchMessageOffsets((prev) => {
        if (prev[branchId]?.[messageId] === newOffset) return prev;
        return { ...prev, [branchId]: { ...(prev[branchId] ?? {}), [messageId]: newOffset } };
      });
    },
    []
  );

  // ── Depth helpers ────────────────────────────────────────────────────────────
  const depthMap: Record<string, number> = {};
  function getBranchDepth(threadId: string): number {
    if (threadId in depthMap) return depthMap[threadId];
    const thread = branchThreads.find((t) => t.id === threadId);
    if (!thread || thread.parentThreadId === currentConversation?.mainThreadId) {
      depthMap[threadId] = 1;
    } else {
      depthMap[threadId] = 1 + getBranchDepth(thread.parentThreadId!);
    }
    return depthMap[threadId];
  }

  function getBranchX(depth: number): number {
    return BRANCH_LEFT + (depth - 1) * (BRANCH_WIDTH + BRANCH_GAP + BRANCH_COL_GAP);
  }

  // ── Branch positioning ───────────────────────────────────────────────────────
  const siblingGroups: Record<string, string[]> = {};
  for (const b of branchThreads) {
    const key = `${b.parentThreadId}::${b.parentMessageId}`;
    (siblingGroups[key] ??= []).push(b.id);
  }

  const sortedByDepth = [...branchThreads].sort(
    (a, b) => getBranchDepth(a.id) - getBranchDepth(b.id)
  );

  const branchTops: Record<string, number> = {};
  const processedGroups = new Set<string>();

  for (const branch of sortedByDepth) {
    const key = `${branch.parentThreadId}::${branch.parentMessageId}`;
    if (processedGroups.has(key)) continue;
    processedGroups.add(key);

    const siblings = siblingGroups[key];
    let baseY = 0;

    if (branch.parentThreadId === currentConversation?.mainThreadId) {
      baseY = messageOffsets[branch.parentMessageId!] ?? 0;
    } else {
      const parentTop = branchTops[branch.parentThreadId!] ?? 0;
      const msgOffsetInParent =
        branchMessageOffsets[branch.parentThreadId!]?.[branch.parentMessageId!] ?? 40;
      baseY = parentTop + msgOffsetInParent;
    }

    let cursor = baseY;
    for (const id of siblings) {
      branchTops[id] = cursor;
      cursor += (branchHeights[id] ?? 280) + BRANCH_GAP;
    }
  }

  branchTopsRef.current = branchTops;
  const branchLefts: Record<string, number> = {};
  for (const b of branchThreads) branchLefts[b.id] = getBranchX(getBranchDepth(b.id));
  branchLeftsRef.current = branchLefts;

  const leftContentHeight = messagesAreaRef.current?.scrollHeight ?? 0;
  const maxBranchBottom = branchThreads.reduce(
    (max, b) => Math.max(max, (branchTops[b.id] ?? 0) + (branchHeights[b.id] ?? 280)),
    0
  );
  const contentHeight = Math.max(leftContentHeight, maxBranchBottom + 80);

  const maxBranchRight = branchThreads.reduce((max, b) => {
    const depth = getBranchDepth(b.id);
    return Math.max(max, getBranchX(depth) + BRANCH_WIDTH);
  }, BRANCH_LEFT + BRANCH_WIDTH);

  const resolvedLeftWidth = leftWidth ?? 420;

  if (viewMode === "graph") {
    return (
      <div ref={containerRef} className="flex flex-1 h-full overflow-hidden flex-col">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#1c2035]/50 bg-[#0c0f1a]/75 backdrop-blur-md shrink-0">
          <GitBranch size={12} className="text-zinc-600" />
          <span className="text-xs text-zinc-500 font-mono tracking-wide flex-1">graph view</span>
          <button
            onClick={() => setViewMode("canvas")}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#151a28]"
          >
            <LayoutGrid size={13} />
            canvas
          </button>
        </div>
        <GraphView onSwitchToCanvas={(threadId) => {
          if (threadId) {
            pendingScrollThreadId.current = threadId;
            suppressBranchScrollSync.current = true;
          }
          setViewMode("canvas");
        }} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-1 h-full overflow-hidden">

      {/* ── Left panel: main thread ───────────────────────────── */}
      <div
        className="flex flex-col shrink-0 bg-[#0c0f1a]/75 backdrop-blur-md overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.5)]"
        style={{ width: resolvedLeftWidth }}
      >
        <div className="px-5 py-3 border-b border-[#1c2035]/50 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-xs text-zinc-500 font-mono tracking-wide flex-1">main thread</span>
          <button
            onClick={handleShare}
            disabled={shareState === "sharing"}
            title="Publish a read-only snapshot and copy the public link"
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-50 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#151a28]"
          >
            {shareState === "sharing" ? <Loader2 size={13} className="animate-spin" />
              : shareState === "copied" ? <Check size={13} className="text-green-400" />
              : <Share2 size={13} />}
            {shareState === "copied" ? "link copied" : shareState === "error" ? "failed" : "share"}
          </button>
          <button
            onClick={() => setViewMode("graph")}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#151a28]"
          >
            <GitBranch size={13} />
            graph
          </button>
        </div>

        <div
          ref={messagesAreaRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleMainScroll}
        >
          {mainThread && (
            <MainThreadChat
              thread={mainThread}
              onMessageRef={(id, el) => { messageEls.current[id] = el; }}
              onLayout={measureOffsets}
              skipAutoScrollRef={pendingScrollThreadId}
            />
          )}
        </div>
      </div>

      {/* ── Draggable divider ─────────────────────────────────── */}
      <div
        onMouseDown={handleDividerMouseDown}
        className={`
          w-[5px] shrink-0 flex flex-col items-center justify-center gap-1
          cursor-col-resize group transition-colors duration-150 relative z-10
          ${dragging ? "bg-blue-500/30" : "bg-[#1c2035]/50 hover:bg-blue-500/20"}
        `}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-0.5 h-0.5 rounded-full transition-colors ${
              dragging ? "bg-blue-400" : "bg-zinc-600 group-hover:bg-blue-400"
            }`}
          />
        ))}
      </div>

      {/* ── Right panel: branch canvas ───────────────────────── */}
      <div
        ref={branchAreaRef}
        className="relative flex-1 overflow-auto"
        style={{ minWidth: MIN_RIGHT_PX }}
      >
        <div
          className="relative"
          style={{ minHeight: contentHeight, minWidth: maxBranchRight + 80 }}
        >
          {/* SVG connection lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            style={{ minHeight: contentHeight, overflow: "visible" }}
          >
            {branchThreads.map((branch) => {
              if (!branch.parentMessageId) return null;
              const branchY = branchTops[branch.id];
              if (branchY === undefined) return null;

              const depth = getBranchDepth(branch.id);
              const isActive = activeThread?.id === branch.id;
              const x2 = getBranchX(depth);
              const y2 = branchY + 22;

              let x1: number, y1: number;

              if (branch.parentThreadId === currentConversation?.mainThreadId) {
                const msgY = messageOffsets[branch.parentMessageId];
                if (msgY === undefined) return null;
                x1 = 0;
                y1 = msgY + 14;
              } else {
                const parentDepth = depth - 1;
                const parentTop = branchTops[branch.parentThreadId!];
                if (parentTop === undefined) return null;
                const msgOffsetInParent =
                  branchMessageOffsets[branch.parentThreadId!]?.[branch.parentMessageId] ?? 40;
                x1 = getBranchX(parentDepth) + BRANCH_WIDTH;
                y1 = parentTop + msgOffsetInParent + 14;
              }

              const cx = (x1 + x2) / 2;

              return (
                <g key={branch.id}>
                  <path
                    d={`M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`}
                    stroke={isActive ? "#3b82f6" : "#1e2540"}
                    strokeWidth={isActive ? 2 : 1.5}
                    strokeDasharray={isActive ? undefined : "4 3"}
                    fill="none"
                  />
                  <circle cx={x1} cy={y1} r={3} fill={isActive ? "#3b82f6" : "#252d42"} />
                  <circle cx={x2} cy={y2} r={3} fill={isActive ? "#3b82f6" : "#252d42"} />
                </g>
              );
            })}
          </svg>

          {/* Branch cards */}
          {branchThreads.map((branch) => {
            const depth = getBranchDepth(branch.id);
            return (
              <div
                key={branch.id}
                className="absolute"
                style={{
                  left: getBranchX(depth),
                  top: branchTops[branch.id] ?? 0,
                  width: BRANCH_WIDTH,
                }}
              >
                <BranchCard
                  branch={branch}
                  isActive={activeThread?.id === branch.id}
                  onHeightChange={(h) =>
                    setBranchHeights((prev) => {
                      if (prev[branch.id] === h) return prev;
                      return { ...prev, [branch.id]: h };
                    })
                  }
                  onMessageRef={(messageId, el) =>
                    handleBranchMessageRef(branch.id, messageId, el)
                  }
                />
              </div>
            );
          })}

          {branchThreads.length === 0 && (
            <div className="flex items-start justify-start pt-20 pl-14">
              <p className="text-xs text-zinc-700 font-mono">
                click any AI response to branch →
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
