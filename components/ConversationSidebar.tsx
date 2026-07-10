// components/ConversationSidebar.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChatStore, TRIAL_MAX_CONVERSATIONS } from "@/store/useChatStore";
import { createClient } from "@/utils/supabase/client";
import {
  GitBranch,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Trash2,
  LogOut,
  Pencil,
  MoreVertical,
  HelpCircle,
} from "lucide-react";
import Logo from "./Logo";

export default function ConversationSidebar() {
  const [open, setOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const {
    allConversations,
    currentConversation,
    createConversation,
    loadConversation,
    deleteConversation,
    renameConversation,
    hasApiKey,
  } = useChatStore();

  // Trial users are capped; BYOK users are unlimited
  const atLimit = !hasApiKey && allConversations.length >= TRIAL_MAX_CONVERSATIONS;

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleNew() {
    await createConversation("New Conversation");
  }

  async function handleSelect(id: string) {
    if (editingId) return;
    if (id === currentConversation?.id) return;
    await loadConversation(id);
  }

  async function commitRename() {
    if (!editingId) return;
    const trimmed = editingTitle.trim();
    if (trimmed) await renameConversation(editingId, trimmed);
    setEditingId(null);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditingId(null);
  }

  function formatDate(date: Date | string) {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const userInitial = userEmail?.charAt(0).toUpperCase() ?? "?";

  return (
    <aside
      className={[
        "relative flex flex-col flex-shrink-0 border-r border-[#1c2035]/60 bg-[#0b0e1a]/80 backdrop-blur-xl transition-[width] duration-200 ease-in-out z-40 shadow-[2px_0_20px_rgba(0,0,0,0.5)]",
        open ? "w-56 overflow-hidden" : "w-12 overflow-visible",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-[#1c2035] px-3">
        {open ? (
          <>
            <Logo width={72} height={40} />
            <button
              onClick={() => setOpen(false)}
              title="Collapse sidebar"
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-[#151a28] hover:text-zinc-300"
            >
              <PanelLeftClose size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setOpen(true)}
            title="Expand sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-[#151a28] hover:text-zinc-300 mx-auto"
          >
            <PanelLeft size={15} />
          </button>
        )}
      </div>

      {/* New chat button */}
      <div className="flex-shrink-0 p-2">
        {open ? (
          <button
            onClick={handleNew}
            disabled={atLimit}
            title={atLimit ? "Conversation limit reached" : "New chat"}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-[#151a28] hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400"
          >
            <Plus size={14} />
            <span className="truncate">{atLimit ? "Limit reached" : "New chat"}</span>
          </button>
        ) : (
          <button
            onClick={handleNew}
            disabled={atLimit}
            title={atLimit ? "Conversation limit reached" : "New chat"}
            className="flex h-8 w-8 items-center justify-center rounded-lg mx-auto text-zinc-500 transition-colors hover:bg-[#151a28] hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      <div className="mx-2 h-px bg-[#1c2035]" />

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {open && allConversations.length === 0 && (
          <p className="px-3 py-3 text-xs text-zinc-600">No chats yet.</p>
        )}

        {allConversations.map((conv) => {
          const isActive = conv.id === currentConversation?.id;
          const branchCount = conv.threads.length - 1;
          const isEditing = editingId === conv.id;
          const menuOpen = openMenuId === conv.id;

          if (!open) {
            return (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                title={conv.title}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-lg mx-auto mb-0.5 transition-colors",
                  isActive
                    ? "bg-blue-600/15 text-blue-400"
                    : "text-zinc-600 hover:bg-[#151a28] hover:text-zinc-300",
                ].join(" ")}
              >
                <MessageSquare size={13} />
              </button>
            );
          }

          return (
            <div key={conv.id} className="group relative mb-0.5">
              {menuOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
              )}

              <button
                onClick={() => handleSelect(conv.id)}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "bg-blue-600/15 text-zinc-100"
                    : "text-zinc-400 hover:bg-[#151a28] hover:text-zinc-200",
                ].join(" ")}
              >
                <MessageSquare
                  size={13}
                  className={`shrink-0 self-center ${isActive ? "text-blue-400" : "text-zinc-600"}`}
                />
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={handleRenameKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-[#151a28] border border-[#252d42] rounded px-1.5 py-0.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
                    />
                  ) : (
                    <span className="block truncate text-sm leading-snug pr-6">{conv.title}</span>
                  )}
                  {!isEditing && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-zinc-600">{formatDate(conv.createdAt)}</span>
                      {branchCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[11px] text-zinc-700">
                          <GitBranch size={9} />
                          {branchCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>

              {!isEditing && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 z-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(menuOpen ? null : conv.id);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-[#1e2540] opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-36 bg-[#0c0f1a] border border-[#1c2035] rounded-lg shadow-2xl z-50 overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          setEditingId(conv.id);
                          setEditingTitle(conv.title);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-400 hover:bg-[#151a28] hover:text-zinc-200 transition-colors"
                      >
                        <Pencil size={12} /> Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          deleteConversation(conv.id);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-[#151a28] hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className={`flex-shrink-0 border-t border-[#1c2035] py-2.5 ${open ? "px-3 flex items-center gap-2" : "flex flex-col items-center gap-2 px-2"}`}>
        <button
          onClick={() => router.push("/profile")}
          title={userEmail ?? "Profile"}
          className={`flex items-center rounded-lg hover:bg-[#151a28] transition-colors ${open ? "gap-2 flex-1 min-w-0 px-1.5 py-1 group" : "h-8 w-8 justify-center"}`}
        >
          <div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-semibold text-blue-400">{userInitial}</span>
          </div>
          {open && (
            <span className="text-[11px] text-zinc-600 truncate group-hover:text-zinc-400 transition-colors">
              {userEmail ?? ""}
            </span>
          )}
        </button>
        <button
          onClick={() => router.push("/how-to")}
          title="How to use"
          className={`flex items-center justify-center flex-shrink-0 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-[#151a28] transition-all ${open ? "w-6 h-6" : "h-8 w-8"}`}
        >
          <HelpCircle size={12} />
        </button>
        <button
          onClick={handleLogout}
          title="Sign out"
          className={`flex items-center justify-center flex-shrink-0 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-[#151a28] transition-all ${open ? "w-6 h-6" : "h-8 w-8"}`}
        >
          <LogOut size={12} />
        </button>
      </div>
    </aside>
  );
}
