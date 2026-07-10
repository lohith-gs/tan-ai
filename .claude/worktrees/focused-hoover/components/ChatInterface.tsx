'use client';

import { useEffect, useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { useStore } from '@/lib/store';
import BranchSidebar from './BranchSidebar';
import ThreadView from './ThreadView';
import BranchModal from './BranchModal';

export default function ChatInterface() {
  const conversations = useStore((s) => s.conversations);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const newConversation = useStore((s) => s.newConversation);
  const selectConversation = useStore((s) => s.selectConversation);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const convList = Object.values(conversations);

    if (convList.length === 0) {
      newConversation();
    } else if (!activeConversationId) {
      const latest = convList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      selectConversation(latest.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <BranchSidebar open={sidebarOpen} onToggle={() => setSidebarOpen((o) => !o)} />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Floating open-sidebar button — only visible when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <PanelLeft size={16} />
          </button>
        )}
        <ThreadView />
      </main>

      <BranchModal />
    </div>
  );
}
