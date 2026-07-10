// components/canvas/BranchPopup.tsx
"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { GitBranch, X, Columns2 } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { PROVIDER_CONFIGS, PROVIDER_ORDER } from "@/lib/providers";
import type { Provider } from "@/lib/providers";

export interface CompareSelection {
  provider: string;
  model: string;
}

interface BranchPopupProps {
  messageId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onBranch: (messageId: string, question: string, compare?: [CompareSelection, CompareSelection]) => void;
}

export default function BranchPopup({
  messageId,
  position,
  onClose,
  onBranch,
}: BranchPopupProps) {
  const { configuredProviders, activeProvider, activeModel } = useChatStore();
  const [question, setQuestion] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // All models across configured providers, encoded "provider:modelId"
  const modelOptions = useMemo(
    () =>
      PROVIDER_ORDER.filter((p) => configuredProviders.includes(p)).flatMap((p) =>
        PROVIDER_CONFIGS[p].models.map((m) => ({
          value: `${p}:${m.id}`,
          label: `${m.name} (${PROVIDER_CONFIGS[p].name})`,
        }))
      ),
    [configuredProviders]
  );

  const [modelA, setModelA] = useState(`${activeProvider}:${activeModel}`);
  const [modelB, setModelB] = useState(
    () => modelOptions.find((o) => o.value !== `${activeProvider}:${activeModel}`)?.value ?? ""
  );

  const canCompare = modelOptions.length >= 2;

  // Measure the popup and clamp it into the viewport: prefer sitting just above
  // the clicked point, flip below when there's no headroom, never clip an edge.
  const popupRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    let left = position.x - rect.width * 0.1;
    let top = position.y - rect.height - 10;
    if (top < margin) top = position.y + 14; // no room above → open below the click
    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));
    setPlaced({ left, top });
  }, [position.x, position.y, compareMode]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("#branch-popup")) onClose();
    }
    // Small delay to prevent immediate close
    const timer = setTimeout(() => {
      window.addEventListener("click", handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClick);
    };
  }, [onClose]);

  function parseSelection(value: string): CompareSelection {
    const [provider, ...rest] = value.split(":");
    return { provider, model: rest.join(":") };
  }

  const compareReady = compareMode && modelA && modelB && modelA !== modelB;

  function handleSubmit() {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (compareMode) {
      if (!compareReady) return;
      onBranch(messageId, trimmed, [parseSelection(modelA), parseSelection(modelB)]);
    } else {
      onBranch(messageId, trimmed);
    }
    setQuestion("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  const selectClass =
    "flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-blue-500/50 transition-colors";

  // Portal to <body>: ancestors with backdrop-filter/overflow-hidden (the chat
  // panels) would otherwise become the containing block for position:fixed and
  // clip the popup at the panel edge.
  return createPortal(
    <div
      id="branch-popup"
      ref={popupRef}
      className="fixed z-50"
      style={{
        left: placed?.left ?? position.x,
        top: placed?.top ?? position.y,
        visibility: placed ? "visible" : "hidden",
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 p-3 w-72">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5">
          <GitBranch size={11} className="text-blue-400" />
          <span className="text-xs font-medium text-zinc-300">
            {compareMode ? "Compare models" : "Branch from here"}
          </span>
          <button
            onClick={onClose}
            className="ml-auto text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Your question..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-blue-500/50 transition-colors"
        />

        {/* Compare model pickers */}
        {compareMode && (
          <div className="flex items-center gap-2 mt-2">
            <select value={modelA} onChange={(e) => setModelA(e.target.value)} className={selectClass}>
              {modelOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="text-[10px] text-zinc-600 shrink-0">vs</span>
            <select value={modelB} onChange={(e) => setModelB(e.target.value)} className={selectClass}>
              {modelOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        {compareMode && modelA === modelB && (
          <p className="text-[10px] text-amber-500/80 mt-1.5">pick two different models</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-2.5 gap-2">
          {canCompare ? (
            <button
              onClick={() => setCompareMode((v) => !v)}
              className={`flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-lg border transition-colors ${
                compareMode
                  ? "border-blue-500/40 text-blue-300 bg-blue-600/10"
                  : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Columns2 size={10} />
              compare
            </button>
          ) : (
            <span className="text-xs text-zinc-700">Enter to branch</span>
          )}
          <button
            onClick={handleSubmit}
            disabled={!question.trim() || (compareMode && !compareReady)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {compareMode ? <Columns2 size={10} /> : <GitBranch size={10} />}
            {compareMode ? "Compare" : "Branch"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
