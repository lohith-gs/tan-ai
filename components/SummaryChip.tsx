"use client";

import { useState } from "react";
import { Layers, ChevronDown, ChevronRight } from "lucide-react";
import MarkdownContent from "./MarkdownContent";

interface Props {
  summary: string;
  compact?: boolean;
}

// Rendered at the boundary between summarized and verbatim messages: everything
// above this line is sent to the model as the distilled summary below.
export default function SummaryChip({ summary, compact }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={compact ? "py-0.5" : "py-1"}>
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        className={`w-full flex items-center gap-2 ${compact ? "text-[9px]" : "text-[10px]"} text-zinc-500 hover:text-zinc-300 transition-colors group`}
      >
        <span className="flex-1 border-t border-dashed border-[#252d42] group-hover:border-[#2a3050]" />
        <span className="flex items-center gap-1.5 shrink-0">
          <Layers size={compact ? 9 : 10} />
          context compressed above this line
          {expanded ? <ChevronDown size={compact ? 9 : 10} /> : <ChevronRight size={compact ? 9 : 10} />}
        </span>
        <span className="flex-1 border-t border-dashed border-[#252d42] group-hover:border-[#2a3050]" />
      </button>
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`mt-2 rounded-xl border border-[#1c2035] bg-[#0a0d16] text-zinc-400 ${compact ? "px-2.5 py-2" : "px-3.5 py-2.5"}`}
        >
          <p className={`${compact ? "text-[9px]" : "text-[10px]"} text-zinc-600 font-mono uppercase tracking-widest mb-1.5`}>
            what the AI remembers from above
          </p>
          <MarkdownContent content={summary} compact />
        </div>
      )}
    </div>
  );
}
