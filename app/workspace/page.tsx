'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { ChatArea } from '@/components/chat/ChatArea';
import { WorkspaceCanvas } from '@/components/workspace/WorkspaceCanvas';
import { useAppStore } from '@/lib/store';

export default function WorkspacePage() {
  const router = useRouter();
  const initStore = useAppStore((state) => state.initStore);
  const [isLoaded, setIsLoaded] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [isFullIdeMode, setIsFullIdeMode] = useState(false);

  useEffect(() => {
    let active = true;
    void initStore()
      .then(() => {
        if (active) setIsLoaded(true);
      })
      .catch((error: unknown) => {
        console.error('[Workspace] Failed to initialize local store:', error);
        if (active) setIsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [initStore]);

  if (!isLoaded) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[#0d0e14] text-sm text-violet-200">
        Iniciando Workspace de Yosseling…
      </main>
    );
  }

  const toggleFullIde = () => {
    if (!isFullIdeMode) setChatCollapsed(true);
    setIsFullIdeMode(!isFullIdeMode);
  };

  return (
    <main className="flex h-dvh w-full overflow-hidden bg-[#0d0e14] text-white">
      {!chatCollapsed && (
        <section className="min-w-0 w-[28%] shrink-0 border-r border-white/[0.07] max-md:absolute max-md:inset-0 max-md:z-10 max-md:w-full max-md:bg-[#0d0e14]">
          <ChatArea />
          <button
            type="button"
            onClick={() => setChatCollapsed(true)}
            aria-label="Collapse Chat"
            className="absolute right-3 top-3 z-20 rounded-lg border border-white/10 bg-[#17171e] p-2 text-slate-300 shadow-lg hover:text-white md:hidden"
          >
            <X size={16} />
          </button>
        </section>
      )}
      <section className="min-w-0 flex-1">
        <WorkspaceCanvas
          isChatCollapsed={chatCollapsed}
          isFullIdeMode={isFullIdeMode}
          onToggleChat={() => setChatCollapsed((collapsed) => !collapsed)}
          onToggleFullIde={toggleFullIde}
          onCloseWorkspace={() => router.push('/')}
        />
      </section>
    </main>
  );
}
