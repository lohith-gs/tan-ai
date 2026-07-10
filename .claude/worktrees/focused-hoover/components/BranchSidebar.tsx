'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { ChevronDown, ChevronRight, GitBranch, GripVertical, MessageSquare, PanelLeftClose, Plus, Trash2 } from 'lucide-react';

// ─── Module-level transient drag state ────────────────────────────────────────
// Not React state — we don't need re-renders for this.
let _dragId: string | null = null;
let _dragParentId: string | null = null;

// ─── Recursive thread tree node ───────────────────────────────────────────────

function ThreadNode({
  threadId,
  activeThreadId,
  depth = 0,
  onReorder,
}: {
  threadId: string;
  activeThreadId: string;
  depth?: number;
  onReorder: (parentId: string, fromId: string, toId: string, pos: 'before' | 'after') => void;
}) {
  const thread = useStore((s) => s.threads[threadId]);
  const switchThread = useStore((s) => s.switchThread);

  const [isDragging, setIsDragging] = useState(false);
  const [dropPos, setDropPos] = useState<'before' | 'after' | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  if (!thread) return null;

  const isActive = activeThreadId === threadId;
  const isRoot = depth === 0;
  const isDraggable = !isRoot;

  // ── drag source ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent) => {
    _dragId = threadId;
    _dragParentId = thread.parentThreadId;
    e.dataTransfer.effectAllowed = 'move';
    // Slight delay so the ghost renders before opacity drops
    setTimeout(() => setIsDragging(true), 0);
  };

  const handleDragEnd = () => {
    _dragId = null;
    _dragParentId = null;
    setIsDragging(false);
    setDropPos(null);
  };

  // ── drop target ──────────────────────────────────────────────────────────
  const isSameParent = () =>
    !isRoot &&
    _dragId !== null &&
    _dragId !== threadId &&
    _dragParentId === thread.parentThreadId;

  const handleDragOver = (e: React.DragEvent) => {
    if (!isSameParent()) return;
    e.preventDefault();
    e.stopPropagation();

    // Decide before/after based on cursor position within the row
    const rect = rowRef.current?.getBoundingClientRect();
    if (rect) {
      const mid = rect.top + rect.height / 2;
      setDropPos(e.clientY < mid ? 'before' : 'after');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the row (not entering a child)
    if (!rowRef.current?.contains(e.relatedTarget as Node)) {
      setDropPos(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (_dragId && isSameParent() && _dragParentId) {
      onReorder(_dragParentId, _dragId, threadId, dropPos ?? 'before');
    }
    setDropPos(null);
  };

  return (
    <div ref={rowRef}>
      {/* "insert before" drop indicator */}
      {dropPos === 'before' && (
        <div className="mx-2 h-0.5 rounded-full bg-emerald-500" />
      )}

      <div
        draggable={isDraggable}
        onDragStart={isDraggable ? handleDragStart : undefined}
        onDragEnd={isDraggable ? handleDragEnd : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'transition-opacity duration-150',
          isDragging ? 'opacity-30' : 'opacity-100',
        ].join(' ')}
      >
        <button
          onClick={() => switchThread(threadId)}
          title={thread.label}
          className={[
            'group flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-3 text-left text-sm transition-colors',
            isActive
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
          ].join(' ')}
          style={{ paddingLeft: `${10 + depth * 14}px` }}
        >
          {/* Drag grip — only on branches, only visible on hover */}
          {isDraggable && (
            <GripVertical
              size={12}
              className="flex-shrink-0 cursor-grab text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
            />
          )}

          {isRoot ? (
            <MessageSquare size={12} className="flex-shrink-0 opacity-70" />
          ) : (
            <GitBranch size={12} className="flex-shrink-0 text-emerald-500" />
          )}

          <span className="flex-1 truncate">{thread.label}</span>

          {isActive && (
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
          )}
          {!isActive && thread.childThreadIds.length > 0 && (
            <span className="flex-shrink-0 text-[10px] text-zinc-600">
              {thread.childThreadIds.length}
            </span>
          )}
        </button>
      </div>

      {/* "insert after" drop indicator */}
      {dropPos === 'after' && (
        <div className="mx-2 h-0.5 rounded-full bg-emerald-500" />
      )}

      {/* Children */}
      {thread.childThreadIds.map((childId) => (
        <ThreadNode
          key={childId}
          threadId={childId}
          activeThreadId={activeThreadId}
          depth={depth + 1}
          onReorder={onReorder}
        />
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export default function BranchSidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const conversations = useStore((s) => s.conversations);
  const threads = useStore((s) => s.threads);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const newConversation = useStore((s) => s.newConversation);
  const selectConversation = useStore((s) => s.selectConversation);
  const deleteConversation = useStore((s) => s.deleteConversation);
  const reorderChildThreads = useStore((s) => s.reorderChildThreads);

  const sortedConvs = useMemo(
    () =>
      Object.values(conversations).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [conversations]
  );

  const handleReorder = useCallback(
    (parentId: string, fromId: string, toId: string, pos: 'before' | 'after') => {
      const parent = threads[parentId];
      if (!parent) return;

      const children = [...parent.childThreadIds];
      const fromIdx = children.indexOf(fromId);
      const toIdx = children.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return;

      // Remove dragged item
      children.splice(fromIdx, 1);

      // Re-calculate toIdx after removal, then insert before or after target
      const newToIdx = children.indexOf(toId);
      const insertAt = pos === 'before' ? newToIdx : newToIdx + 1;
      children.splice(insertAt, 0, fromId);

      reorderChildThreads(parentId, children);
    },
    [threads, reorderChildThreads]
  );

  // Per-conversation expand/collapse state (branch tree)
  const [expandedConvs, setExpandedConvs] = useState<Record<string, boolean>>({});

  const toggleConvExpand = (convId: string) =>
    setExpandedConvs((prev) => ({ ...prev, [convId]: !prev[convId] }));

  // A conversation's branch tree is expanded when:
  // it's active AND either the user hasn't explicitly collapsed it
  const isBranchTreeVisible = (convId: string) => {
    if (convId !== activeConversationId) return false;
    // default open for active conv; respect explicit toggle
    return expandedConvs[convId] !== false;
  };

  return (
    <aside
      className={[
        'flex flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 transition-[width] duration-200 ease-in-out overflow-hidden',
        open ? 'w-60' : 'w-0',
      ].join(' ')}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-zinc-800 px-3">
        <div className="flex items-center gap-2">
          <GitBranch size={15} className="text-emerald-400" />
          <span className="text-sm font-semibold tracking-tight text-zinc-100">tan-ai</span>
        </div>
        <button
          onClick={onToggle}
          title="Close sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* ── New Chat ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-2">
        <button
          onClick={newConversation}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Plus size={14} />
          <span className="truncate">New chat</span>
        </button>
      </div>

      <div className="h-px bg-zinc-800" />

      {/* ── Conversation list ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sortedConvs.length === 0 && (
          <p className="px-3 py-4 text-xs text-zinc-600">No conversations yet.</p>
        )}

        {sortedConvs.map((conv) => {
          const isActive = conv.id === activeConversationId;
          const branchVisible = isBranchTreeVisible(conv.id);
          const hasBranches =
            conv.rootThreadId &&
            threads[conv.rootThreadId]?.childThreadIds.length > 0;

          return (
            <div key={conv.id} className="mb-0.5">
              {/* ── Conversation row ── */}
              <div
                className={[
                  'group flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300',
                ].join(' ')}
                onClick={() => selectConversation(conv.id)}
              >
                {/* Expand/collapse chevron for branch tree */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isActive) toggleConvExpand(conv.id);
                  }}
                  className={[
                    'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded transition-colors',
                    hasBranches ? 'opacity-60 hover:opacity-100' : 'opacity-0 pointer-events-none',
                  ].join(' ')}
                >
                  {branchVisible
                    ? <ChevronDown size={11} />
                    : <ChevronRight size={11} />}
                </button>

                <span className="flex-1 truncate">{conv.title}</span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  title="Delete conversation"
                  className="flex-shrink-0 rounded p-0.5 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* ── Branch tree ── */}
              {branchVisible && (
                <div className="ml-2 mt-0.5 mb-1 border-l border-zinc-800 pl-1">
                  <ThreadNode
                    threadId={conv.rootThreadId}
                    activeThreadId={conv.activeThreadId}
                    depth={0}
                    onReorder={handleReorder}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-zinc-800 px-4 py-3">
        <p className="text-[11px] leading-snug text-zinc-600">
          Drag branches to reorder · Hover messages to branch
        </p>
      </div>
    </aside>
  );
}
