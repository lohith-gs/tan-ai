// app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChatStore } from "@/store/useChatStore";
import HybridCanvas from "@/components/HybridCanvas";
import ConversationSidebar from "@/components/ConversationSidebar";
import { Key, AlertTriangle, X } from "lucide-react";

export default function Home() {
  const { initialize, hasApiKey, keyInvalid, setKeyInvalid, trialNotice, setTrialNotice } = useChatStore();
  const [isReady, setIsReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initialize().then(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07090f]">
        <p className="text-zinc-600 text-sm font-mono">initializing tan(AI)...</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#07090f] flex relative flex-col">
      {keyInvalid && (
        <div className="flex-shrink-0 z-50 flex items-center justify-between gap-3 px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">
              {hasApiKey
                ? "Your API key is invalid or revoked."
                : "Trial is unavailable right now. Add your own API key to continue (Groq keys are free)."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/profile" className="text-xs text-red-300 hover:text-red-200 underline transition-colors">
              Update key →
            </Link>
            <button onClick={() => setKeyInvalid(false)} className="text-red-500 hover:text-red-400 transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Trial limit hit — dismissible */}
      {trialNotice && (
        <div className="flex-shrink-0 z-50 flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">{trialNotice}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/profile" className="text-xs text-amber-300 hover:text-amber-200 underline transition-colors">
              Add key →
            </Link>
            <button onClick={() => setTrialNotice(null)} className="text-amber-500 hover:text-amber-400 transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Trial mode banner */}
      {!hasApiKey && !trialNotice && (
        <div className="flex-shrink-0 z-50 flex items-center justify-between gap-3 px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
          <div className="flex items-center gap-2">
            <Key size={13} className="text-blue-400 shrink-0" />
            <p className="text-xs text-blue-300">
              You're on the free trial: 3 chats, 5 branches each. Add your own API key for unlimited use.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-300 hover:text-blue-200 underline transition-colors whitespace-nowrap"
            >
              Groq keys are free →
            </a>
            <Link href="/profile" className="text-xs text-blue-300 hover:text-blue-200 underline transition-colors whitespace-nowrap">
              Add key
            </Link>
          </div>
        </div>
      )}
      <div className="flex-1 flex overflow-hidden relative">
        <ConversationSidebar />
        <HybridCanvas />
      </div>
    </div>
  );
}
