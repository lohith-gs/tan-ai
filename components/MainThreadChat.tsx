"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { Thread } from "@/types";
import { useChatStore } from "@/store/useChatStore";
import {
  Bot, User, GitBranch, GitMerge, ArrowRight, Check, Send, AlertCircle,
  RotateCcw, RefreshCw, Copy, Square, AlertTriangle, ChevronDown,
} from "lucide-react";
import BranchPopup, { type CompareSelection } from "./canvas/BranchPopup";
import MarkdownContent from "./MarkdownContent";
import MergeCard from "./MergeCard";
import SummaryChip from "./SummaryChip";
import { parseMergeMessage, toModelContent } from "@/lib/merge";
import { anchorIndex, summarySystemContent } from "@/lib/context";
import { triggerSummarizeIfNeeded } from "@/lib/summarize-client";
import { PROVIDER_CONFIGS, PROVIDER_ORDER, getModelName, getContextWindow } from "@/lib/providers";
import type { Provider } from "@/lib/providers";

const PROVIDER_DOT: Record<string, string> = {
  groq: "bg-orange-400",
  openai: "bg-green-400",
  anthropic: "bg-purple-400",
};

const CHECKPOINT_SENTINEL = "\n[CHECKPOINTS]";
const STREAM_ERROR_SENTINEL = "\n[STREAM_ERROR]";

const STARTER_PROMPTS = [
  "Explain a concept in simple terms",
  "Help me brainstorm ideas for a project",
  "Review and improve this text",
  "Write code for a specific task",
];

interface StreamErrorState {
  message: string;
  isKeyError: boolean;
}

interface Props {
  thread: Thread;
  onMessageRef: (id: string, el: HTMLDivElement | null) => void;
  onLayout: () => void;
  // When set (a branch thread id), the parent is about to position both panels at
  // the branch point — skip our own scroll-to-bottom so the two don't fight.
  skipAutoScrollRef?: React.MutableRefObject<string | null>;
}

export default function MainThreadChat({ thread, onMessageRef, onLayout, skipAutoScrollRef }: Props) {
  const {
    currentConversation,
    addMessage,
    addCheckpoints,
    createBranch,
    setActiveThread,
    setKeyInvalid,
    deleteMessage,
    activeProvider,
    activeModel,
    configuredProviders,
    setProviderModel,
    setPendingAutoSend,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<StreamErrorState | null>(null);
  const [popupMessageId, setPopupMessageId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [optimisticUserContent, setOptimisticUserContent] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCtxRef = useRef<Array<{ role: string; content: string }> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (skipAutoScrollRef?.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" });
  }, [thread.messages.length, streamingContent, isLoading]);

  // Keep textarea height in sync with content on every input change (including
  // programmatic clears, where onChange never fires and stale height lingers).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    onLayout();
  }, [thread.messages.length]);

  const branchedMessageIds = new Set(
    (currentConversation?.threads ?? [])
      .filter((t) => t.parentThreadId === thread.id && t.parentMessageId)
      .map((t) => t.parentMessageId as string)
  );

  async function runStream(ctx: Array<{ role: string; content: string }>, threadId: string) {
    setStreamError(null);
    setIsLoading(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    function fail(message: string, isKeyError: boolean) {
      setStreamingContent(null);
      if (isKeyError) setKeyInvalid(true);
      setStreamError({ message, isKeyError });
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: ctx }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        const isKeyError = response.status === 400 || response.status === 401;
        fail(json.error ?? "Request failed", isKeyError);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      const onAbort = () => reader.cancel();
      controller.signal.addEventListener("abort", onAbort);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          if (accumulated.indexOf(STREAM_ERROR_SENTINEL) !== -1) break;
          const cpIdx = accumulated.indexOf(CHECKPOINT_SENTINEL);
          setStreamingContent(cpIdx === -1 ? accumulated : accumulated.slice(0, cpIdx));
        }
      } finally {
        controller.signal.removeEventListener("abort", onAbort);
      }

      if (controller.signal.aborted) {
        setStreamingContent(null);
        return;
      }

      const errIdx = accumulated.indexOf(STREAM_ERROR_SENTINEL);
      if (errIdx !== -1) {
        try {
          const errData = JSON.parse(accumulated.slice(errIdx + STREAM_ERROR_SENTINEL.length));
          fail(errData.error ?? "Stream failed", errData.isKeyError ?? false);
        } catch {
          fail("Stream failed", false);
        }
        return;
      }

      const cpIdx = accumulated.indexOf(CHECKPOINT_SENTINEL);
      const fullText = cpIdx === -1 ? accumulated : accumulated.slice(0, cpIdx);
      let checkpoints: string[] = [];
      if (cpIdx !== -1) {
        try { checkpoints = JSON.parse(accumulated.slice(cpIdx + CHECKPOINT_SENTINEL.length)); } catch {}
      }

      await addMessage(threadId, { role: "assistant", content: fullText });
      setStreamingContent(null);

      const last = useChatStore.getState().currentConversation?.threads
        .find((t) => t.id === threadId)?.messages.at(-1);
      if (last && checkpoints.length > 0) {
        await addCheckpoints(last.id, checkpoints.map((label) => ({ label })));
      }

      // Background context compression — fire and forget
      triggerSummarizeIfNeeded(threadId);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setStreamingContent(null);
        return;
      }
      fail("Something went wrong. Try again.", false);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  async function handleSend(text?: string) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || isLoading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStreamError(null);
    setOptimisticUserContent(trimmed);
    await setActiveThread(thread.id);
    await addMessage(thread.id, { role: "user", content: trimmed });
    setOptimisticUserContent(null);

    // Compressed context: rolling summary as a system message + verbatim
    // messages after the summarized anchor.
    const start = thread.summary ? anchorIndex(thread.messages, thread.summarizedUpToMessageId) : 0;
    const ctx = [
      ...(thread.summary ? [{ role: "system", content: summarySystemContent(thread.summary) }] : []),
      ...thread.messages.slice(start).map((m) => ({ role: m.role, content: toModelContent(m.content) })),
      { role: "user", content: trimmed },
    ];
    lastCtxRef.current = ctx;
    await runStream(ctx, thread.id);
  }

  async function handleRetry() {
    if (!lastCtxRef.current) return;
    await runStream(lastCtxRef.current, thread.id);
  }

  async function handleRegenerate() {
    const msgs = thread.messages;
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant || isLoading) return;

    await deleteMessage(lastAssistant.id, thread.id);

    const start = thread.summary ? anchorIndex(msgs, thread.summarizedUpToMessageId) : 0;
    const ctx = [
      ...(thread.summary ? [{ role: "system", content: summarySystemContent(thread.summary) }] : []),
      ...msgs
        .slice(start)
        .filter((m) => m.id !== lastAssistant.id)
        .map((m) => ({ role: m.role, content: toModelContent(m.content) })),
    ];
    lastCtxRef.current = ctx;
    await runStream(ctx, thread.id);
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && isLoading) {
      handleCancel();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleCopy(messageId: string, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleMessageClick(e: React.MouseEvent, messageId: string) {
    setPopupPosition({ x: e.clientX, y: e.clientY });
    setPopupMessageId(messageId);
  }

  async function handleCheckpointClick(checkpoint: any) {
    if (checkpoint.isExplored && checkpoint.branchThreadId) {
      await setActiveThread(checkpoint.branchThreadId);
      return;
    }
    const branchThreadId = await createBranch(checkpoint.id, checkpoint.label, checkpoint.messageId);
    await addMessage(branchThreadId, { role: "user", content: checkpoint.label });
    setPendingAutoSend(branchThreadId);
  }

  async function handleBranchCreate(
    messageId: string,
    question: string,
    compare?: [CompareSelection, CompareSelection]
  ) {
    setPopupMessageId(null);

    const selections: Array<CompareSelection | undefined> = compare ?? [undefined];
    for (const sel of selections) {
      const label = sel
        ? `${question} · ${getModelName(sel.provider as Provider, sel.model)}`
        : question;
      // createBranch parents off activeThread and switches it to the new branch,
      // so re-pin the intended parent before each sibling.
      await setActiveThread(thread.id);
      await addCheckpoints(messageId, [{ label }]);

      const thread_ = useChatStore.getState().currentConversation?.threads
        .find((t) => t.id === thread.id);
      const cp = thread_?.checkpoints
        .filter((c) => c.messageId === messageId && c.label === label && !c.isExplored)
        .at(-1);
      if (!cp) continue;

      const branchThreadId = await createBranch(cp.id, label, messageId, undefined, sel);
      await addMessage(branchThreadId, { role: "user", content: question });
      setPendingAutoSend(branchThreadId);
    }
  }

  // Estimate what we'd actually send: summary + messages after the anchor.
  const contextTokenEstimate = useMemo(() => {
    const start = thread.summary ? anchorIndex(thread.messages, thread.summarizedUpToMessageId) : 0;
    const messagesTokens = thread.messages.slice(start).reduce((sum, m) => sum + m.content.length, 0) / 4;
    const summaryTokens = (thread.summary?.length ?? 0) / 4;
    return messagesTokens + summaryTokens;
  }, [thread.messages, thread.summary, thread.summarizedUpToMessageId]);

  // Warn at 90% of the active model's context window; critical when the
  // estimate exceeds the window itself (requests may start failing).
  const contextWindow = getContextWindow(activeProvider, activeModel);
  const contextState =
    contextTokenEstimate > contextWindow        ? "critical" :
    contextTokenEstimate > contextWindow * 0.9  ? "warning"  : "normal";

  function handleBranchFromWarning() {
    const lastAssistant = [...thread.messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    setPopupPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setPopupMessageId(lastAssistant.id);
  }

  const lastAssistantMsgId = [...thread.messages].reverse().find((m) => m.role === "assistant")?.id;
  const showOptimistic = optimisticUserContent !== null &&
    thread.messages.at(-1)?.content !== optimisticUserContent;

  const lastMsg = thread.messages.at(-1);
  const showStreamingBubble = isLoading && streamingContent !== null &&
    !(lastMsg?.role === "assistant" && lastMsg?.content === streamingContent);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex flex-col gap-5 p-5 flex-1">
        {/* Starter prompts */}
        {thread.messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center gap-4 mt-8">
            <p className="text-xs text-zinc-600 font-mono">start a conversation…</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#1c2035] text-zinc-500 hover:border-[#252d42] hover:text-zinc-300 transition-all bg-[#0c0f1a]/60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {thread.messages.map((message) => {
          const mergeMeta = message.role === "assistant" ? parseMergeMessage(message.content) : null;
          return (
          <div key={message.id} ref={(el) => onMessageRef(message.id, el)}>
            <div
              className={`flex items-start gap-3 group ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                message.role === "user" ? "bg-blue-600" : mergeMeta ? "bg-violet-600/20" : "bg-zinc-800"
              }`}>
                {message.role === "user"
                  ? <User size={13} className="text-white" />
                  : mergeMeta
                  ? <GitMerge size={13} className="text-violet-400" />
                  : <Bot size={13} className="text-zinc-400" />}
              </div>
              <div className={`relative max-w-[85%] ${mergeMeta ? "flex-1" : ""}`}>
                {mergeMeta ? (
                  <MergeCard meta={mergeMeta} />
                ) : (
                <div className={`px-3.5 py-2.5 rounded-2xl ${
                  message.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm text-sm leading-relaxed"
                    : "bg-[#10141f] text-zinc-200 rounded-tl-sm cursor-pointer hover:bg-[#151a28] hover:ring-1 hover:ring-blue-500/20 transition-all"
                }`}
                  onClick={message.role === "assistant" ? (e) => handleMessageClick(e, message.id) : undefined}
                >
                  {message.role === "user"
                    ? message.content
                    : <MarkdownContent content={message.content} />}
                </div>
                )}

                {/* Copy + Regenerate actions on assistant messages */}
                {message.role === "assistant" && !mergeMeta && (
                  <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(message.id, message.content)}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-[#151a28]"
                    >
                      {copiedId === message.id
                        ? <><Check size={12} className="text-green-400" /><span className="text-green-400">copied</span></>
                        : <><Copy size={12} /><span>copy</span></>}
                    </button>
                    {message.id === lastAssistantMsgId && (
                      <button
                        onClick={handleRegenerate}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors px-2 py-1 rounded-md hover:bg-[#151a28]"
                      >
                        <RefreshCw size={12} />
                        <span>regenerate</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              {message.role === "assistant" && branchedMessageIds.has(message.id) && (
                <div className="flex items-center gap-1 text-[10px] text-green-500/60 self-end mb-1 shrink-0">
                  <GitBranch size={9} />
                </div>
              )}
            </div>

            {/* Checkpoints */}
            {message.role === "assistant" && (() => {
              const cps = thread.checkpoints.filter((cp) => cp.messageId === message.id);
              if (!cps.length) return null;
              return (
                <div className="mt-2.5 ml-10 flex flex-wrap gap-1.5">
                  {cps.map((cp) => (
                    <button
                      key={cp.id}
                      onClick={() => handleCheckpointClick({ ...cp, messageId: message.id })}
                      className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all ${
                        cp.isExplored
                          ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                          : "bg-[#0c0f1a] border-indigo-500/30 text-indigo-400 hover:border-indigo-400/50 hover:text-indigo-300"
                      }`}
                    >
                      {cp.isExplored ? <Check size={10} className="text-blue-400" /> : <ArrowRight size={10} />}
                      {cp.label}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Compression boundary: everything above is sent as the summary */}
            {thread.summary && message.id === thread.summarizedUpToMessageId && (
              <SummaryChip summary={thread.summary} />
            )}
          </div>
          );
        })}

        {/* Optimistic user message (appears instantly before store confirms) */}
        {showOptimistic && (
          <div className="flex items-start gap-3 flex-row-reverse">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-blue-600">
              <User size={13} className="text-white" />
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-blue-600 text-white text-sm leading-relaxed max-w-[85%]">
              {optimisticUserContent}
            </div>
          </div>
        )}

        {/* Streaming bubble — plain text to avoid markdown flicker */}
        {showStreamingBubble && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#10141f]">
              <Bot size={13} className="text-zinc-400" />
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[#10141f] text-zinc-200 max-w-[85%]">
              {streamingContent
                ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{streamingContent}</p>
                : <span className="text-sm opacity-40">thinking…</span>}
              <span className="inline-block w-0.5 h-3.5 bg-zinc-400 ml-1 animate-pulse align-middle" />
            </div>
          </div>
        )}

        {isLoading && streamingContent === null && (
          <div className="flex gap-1 ml-10">
            {[0, 150, 300].map((d) => (
              <div key={d} className="w-1.5 h-1.5 bg-zinc-700 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}

        {/* Stream error */}
        {streamError && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-red-900/30">
              <AlertCircle size={13} className="text-red-400" />
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-red-900/20 border border-red-500/20 max-w-[85%] flex flex-col gap-2">
              <p className="text-sm text-red-400">{streamError.message}</p>
              <div className="flex items-center gap-3">
                {!streamError.isKeyError && (
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 transition-colors"
                  >
                    <RotateCcw size={11} /> Retry
                  </button>
                )}
                {streamError.isKeyError && (
                  <Link
                    href="/profile"
                    className="text-xs text-red-300 hover:text-red-200 underline transition-colors"
                  >
                    Update API key →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sticky input + context warning */}
      <div className="sticky bottom-0 border-t border-[#1c2035]/60 bg-[#07090f]/85 backdrop-blur-md">
        {contextState !== "normal" && (
          <div className={`mx-3 mt-2.5 px-3 py-2 rounded-xl border flex items-center justify-between gap-3 ${
            contextState === "critical"
              ? "bg-red-900/20 border-red-500/20"
              : "bg-amber-900/20 border-amber-600/20"
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={12} className={contextState === "critical" ? "text-red-400 shrink-0" : "text-amber-400 shrink-0"} />
              <p className={`text-xs ${contextState === "critical" ? "text-red-400" : "text-amber-400"}`}>
                {contextState === "critical"
                  ? "Context exceeds the model's limit. Requests may fail."
                  : "Approaching the model's context limit."}
              </p>
            </div>
            <button
              onClick={handleBranchFromWarning}
              className="text-xs px-2.5 py-1 rounded-lg border border-[#1c2035] text-zinc-400 hover:text-zinc-200 hover:border-[#252d42] transition-all whitespace-nowrap shrink-0"
            >
              Branch from here →
            </button>
          </div>
        )}
        <div className="p-3 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message main thread…"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-[#0c0f1a] text-sm text-zinc-200 placeholder-zinc-600 resize-none outline-none rounded-xl px-3.5 py-2.5 leading-relaxed disabled:opacity-50 border border-[#1c2035] focus:border-[#252d42] transition-colors"
            style={{ maxHeight: 120, overflowY: "auto" }}
          />
          {isLoading ? (
            <button
              onClick={handleCancel}
              title="Cancel (Esc)"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#1e2540] hover:bg-[#252d52] transition-all shrink-0"
            >
              <Square size={12} className="text-white" />
            </button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
            >
              <Send size={14} className="text-white" />
            </button>
          )}
        </div>

        {/* Model selector pill */}
        {configuredProviders.length > 0 && (
          <div className="relative px-3 pb-2.5 flex justify-end">
            <button
              onClick={() => setShowModelPicker((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors rounded-full px-2.5 py-1 hover:bg-[#151a28] border border-transparent hover:border-[#252d42]"
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PROVIDER_DOT[activeProvider] ?? "bg-zinc-500"}`} />
              <span>{getModelName(activeProvider as Provider, activeModel)}</span>
              <ChevronDown size={9} />
            </button>

            {showModelPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
                <div className="absolute bottom-full right-0 mb-1.5 w-60 bg-[#0c0f1a] border border-[#1c2035] rounded-xl shadow-2xl overflow-hidden z-50">
                  {PROVIDER_ORDER.map((pid) => {
                    const config = PROVIDER_CONFIGS[pid];
                    const isConfigured = configuredProviders.includes(pid);
                    return (
                      <div key={pid}>
                        <div className="px-3 py-1.5 flex items-center gap-2 border-b border-[#1c2035] bg-[#0c0f1a]">
                          <span className={`w-1.5 h-1.5 rounded-full ${PROVIDER_DOT[pid]}`} />
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{config.name}</span>
                          {!isConfigured && (
                            <span className="ml-auto text-[10px] text-zinc-700">no key</span>
                          )}
                        </div>
                        {config.models.map((m) => {
                          const isActive = activeProvider === pid && activeModel === m.id;
                          return (
                            <button
                              key={m.id}
                              disabled={!isConfigured}
                              onClick={async () => {
                                await setProviderModel(pid, m.id);
                                setShowModelPicker(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                                isActive
                                  ? "bg-blue-600/20 text-blue-300"
                                  : isConfigured
                                  ? "text-zinc-400 hover:bg-[#151a28] hover:text-zinc-200"
                                  : "text-zinc-700 cursor-not-allowed"
                              }`}
                            >
                              <span>{m.name}</span>
                              <span className={`text-[10px] ${isActive ? "text-blue-400/70" : "text-zinc-700"}`}>{m.badge}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {popupMessageId && (
        <BranchPopup
          messageId={popupMessageId}
          position={popupPosition}
          onClose={() => setPopupMessageId(null)}
          onBranch={handleBranchCreate}
        />
      )}
    </div>
  );
}
