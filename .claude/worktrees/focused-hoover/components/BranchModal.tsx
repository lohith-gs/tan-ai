'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useStore } from '@/lib/store';
import { GitBranch, X } from 'lucide-react';

export default function BranchModal() {
  const [label, setLabel] = useState('');
  const branchModal = useStore((s) => s.branchModal);
  const createBranch = useStore((s) => s.createBranch);
  const closeBranchModal = useStore((s) => s.closeBranchModal);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens and reset label
  useEffect(() => {
    if (branchModal.isOpen) {
      setLabel('');
      // Small delay so the modal is rendered before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [branchModal.isOpen]);

  if (!branchModal.isOpen) return null;

  const handleCreate = () => {
    if (!branchModal.fromMessageId) return;
    createBranch(branchModal.fromMessageId, label);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') closeBranchModal();
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={closeBranchModal}
    >
      {/* Modal panel */}
      <div
        className="relative mx-4 w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={15} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Create a branch</h2>
          </div>
          <button
            onClick={closeBranchModal}
            className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X size={15} />
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-zinc-500">
          Start a focused side-thread from this point. Your main conversation stays intact — you can always switch back.
        </p>

        {/* Label input */}
        <input
          ref={inputRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Branch name (e.g. "Server Components")'
          maxLength={60}
          className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500"
        />

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={closeBranchModal}
            className="flex-1 rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Create branch
          </button>
        </div>
      </div>
    </div>
  );
}
