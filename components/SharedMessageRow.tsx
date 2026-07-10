"use client";

import { Bot, User, GitBranch } from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import MergeCard from "./MergeCard";
import { parseMergeMessage } from "@/lib/merge";

interface Props {
  role: string;
  content: string;
  compact?: boolean;
}

export default function SharedMessageRow({ role, content, compact }: Props) {
  const mergeMeta = role === "assistant" ? parseMergeMessage(content) : null;
  const iconSize = compact ? 9 : 13;
  const avatarSize = compact ? "w-5 h-5" : "w-7 h-7";
  return (
    <div className={`flex items-start ${compact ? "gap-2" : "gap-3"} ${role === "user" ? "flex-row-reverse" : ""}`}>
      <div className={`${avatarSize} rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        role === "user" ? "bg-blue-600" : mergeMeta ? "bg-violet-600/20" : "bg-zinc-800"
      }`}>
        {role === "user"
          ? <User size={iconSize} className="text-white" />
          : mergeMeta
          ? <GitBranch size={iconSize} className="text-violet-400" />
          : <Bot size={iconSize} className="text-zinc-400" />}
      </div>
      {mergeMeta ? (
        <div className="max-w-[85%] flex-1">
          <MergeCard meta={mergeMeta} compact={compact} />
        </div>
      ) : (
        <div className={`rounded-2xl max-w-[85%] ${compact ? "px-2.5 py-1.5" : "px-3.5 py-2.5"} ${
          role === "user"
            ? `bg-blue-600 text-white rounded-tr-sm ${compact ? "text-xs" : "text-sm"} leading-relaxed`
            : "bg-[#10141f] text-zinc-200 rounded-tl-sm"
        }`}>
          {role === "user" ? content : <MarkdownContent content={content} compact={compact} />}
        </div>
      )}
    </div>
  );
}
