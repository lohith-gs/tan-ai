'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useStore } from '@/lib/store';
import { ArrowUp } from 'lucide-react';

export default function InputBar() {
  const [input, setInput] = useState('');
  const isStreaming = useStore((s) => s.isStreaming);
  const sendMessage = useStore((s) => s.sendMessage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = input.trim().length > 0 && !isStreaming;

  const submit = async () => {
    if (!canSend) return;
    const content = input;
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(content);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  return (
    <div className="flex-shrink-0 border-t border-zinc-800 px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <div
          className={[
            'flex items-end gap-3 rounded-2xl border bg-zinc-800 px-4 py-3 transition-colors',
            isStreaming ? 'border-zinc-700' : 'border-zinc-700 focus-within:border-zinc-500',
          ].join(' ')}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={isStreaming ? 'Waiting for response…' : 'Message…'}
            rows={1}
            disabled={isStreaming}
            className="max-h-[180px] flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-relaxed text-zinc-100 placeholder-zinc-500 outline-none disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={!canSend}
            title="Send (Enter)"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-600 text-zinc-200 transition-colors hover:bg-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={14} />
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-zinc-700">
          Enter to send · Shift+Enter for new line · Hover AI messages to branch
        </p>
      </div>
    </div>
  );
}
