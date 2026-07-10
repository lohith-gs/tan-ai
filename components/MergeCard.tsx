"use client";

import { useState } from "react";
import { GitMerge, ChevronDown, ChevronRight } from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import type { MergeMeta } from "@/lib/merge";

interface Props {
  meta: MergeMeta;
  compact?: boolean;
}

// Distinct rendering for messages merged back from a branch: a violet card with
// the source branch name and an expandable synthesis body.
export default function MergeCard({ meta, compact }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
      className="rounded-xl border border-violet-500/30 bg-violet-600/[0.06] hover:border-violet-400/40 transition-colors cursor-pointer overflow-hidden"
    >
      <div className={`flex items-center gap-2 ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
        <GitMerge size={compact ? 10 : 12} className="text-violet-400 shrink-0" />
        <span className={`${compact ? "text-[10px]" : "text-[11px]"} text-violet-300 font-medium truncate flex-1`}>
          merged from "{meta.threadName}"
        </span>
        {expanded
          ? <ChevronDown size={compact ? 10 : 12} className="text-violet-400/60 shrink-0" />
          : <ChevronRight size={compact ? 10 : 12} className="text-violet-400/60 shrink-0" />}
      </div>
      <div className={`${compact ? "px-2.5 pb-2" : "px-3 pb-2.5"} text-zinc-300 ${expanded ? "" : "line-clamp-2"}`}>
        <MarkdownContent content={meta.body} compact={compact} />
      </div>
    </div>
  );
}
