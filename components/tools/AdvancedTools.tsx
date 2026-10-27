'use client';

import dynamic from 'next/dynamic';
import { memo, useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { BriefcaseBusiness, Camera, HardDrive, Headphones, ListVideo } from 'lucide-react';

const ToolLoading = () => <div className="p-6 text-zinc-400">Cargando herramienta...</div>;
const JobRadar = memo(dynamic(() => import('./JobRadar').then((module) => module.JobRadar), { loading: ToolLoading }));
const DeviceDoctor = memo(dynamic(() => import('./DeviceDoctor').then((module) => module.DeviceDoctor), { loading: ToolLoading }));
const VoiceMode = memo(dynamic(() => import('./VoiceMode').then((module) => module.VoiceMode), { loading: ToolLoading }));
const LiveVision = memo(dynamic(() => import('./LiveVision').then((module) => module.LiveVision), { loading: ToolLoading }));
const BatchDownloadQueue = memo(dynamic(() => import('./BatchDownloadQueue').then((module) => module.BatchDownloadQueue), { loading: ToolLoading }));

const TOOL_TABS = [
  { id: 'job', label: 'Empleo', icon: BriefcaseBusiness },
  { id: 'doctor', label: 'Dispositivos', icon: HardDrive },
  { id: 'voice', label: 'Voz', icon: Headphones },
  { id: 'vision', label: 'Visión', icon: Camera },
  { id: 'downloads', label: 'Descargas', icon: ListVideo },
] as const;

type ToolTab = (typeof TOOL_TABS)[number]['id'];
type ConversationSection = 'general' | 'vision' | 'employment' | 'voice';

function getSectionForTab(tab: ToolTab): ConversationSection {
  if (tab === 'job') return 'employment';
  if (tab === 'vision') return 'vision';
  if (tab === 'voice') return 'voice';
  return 'general';
}

export function AdvancedTools({ isActive = true }: { isActive?: boolean }) {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ToolTab>('job');
  const [visitedTabs, setVisitedTabs] = useState<Set<ToolTab>>(() => new Set<ToolTab>(['job']));
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const setSidebarView = useAppStore((state) => state.setSidebarView);
  const setConversationSection = useAppStore((state) => state.setConversationSection);
  const activeConversationSection = useAppStore((state) => state.activeConversationSection);

  const selectTab = useCallback((tab: ToolTab) => {
    setActiveTab(tab);
    if (isActive) setConversationSection(getSectionForTab(tab));
    setVisitedTabs((visited) => {
      if (visited.has(tab)) return visited;
      const next = new Set(visited);
      next.add(tab);
      return next;
    });
  }, [isActive, setConversationSection]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const navigateToTool = (event: Event) => {
      const target = (event as CustomEvent<ToolTab | 'settings'>).detail;
      if (target === 'settings') {
        setSidebarView('settings');
        setSidebarOpen(true);
      } else if (TOOL_TABS.some((tab) => tab.id === target)) {
        selectTab(target);
      }
    };

    window.addEventListener('yosseling:navigate-tool', navigateToTool);
    return () => window.removeEventListener('yosseling:navigate-tool', navigateToTool);
  }, [isActive, selectTab, setSidebarOpen, setSidebarView]);

  useEffect(() => {
    const section = isActive ? getSectionForTab(activeTab) : 'general';
    if (activeConversationSection !== section) setConversationSection(section);
  }, [activeConversationSection, activeTab, isActive, setConversationSection]);

  if (!isMounted) {
    return <div className="p-6 text-zinc-400">Cargando herramienta...</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <nav aria-label="Herramientas avanzadas" className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2 sm:px-6">
        {TOOL_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`tool-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls="active-tool-panel"
            onClick={() => selectTab(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
              activeTab === id
                ? 'bg-purple-400/15 text-purple-100'
                : 'text-white/55 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </nav>
      <div id="active-tool-panel" role="tabpanel" aria-labelledby={`tool-tab-${activeTab}`} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {visitedTabs.has('job') && <div hidden={activeTab !== 'job'} className={activeTab === 'job' ? 'tool-panel-enter' : undefined}><JobRadar /></div>}
          {visitedTabs.has('doctor') && <div hidden={activeTab !== 'doctor'} className={activeTab === 'doctor' ? 'tool-panel-enter' : undefined}><DeviceDoctor /></div>}
          {visitedTabs.has('voice') && <div hidden={activeTab !== 'voice'} className={activeTab === 'voice' ? 'tool-panel-enter' : undefined}><VoiceMode /></div>}
          {visitedTabs.has('vision') && <div hidden={activeTab !== 'vision'} className={activeTab === 'vision' ? 'tool-panel-enter' : undefined}><LiveVision /></div>}
          {visitedTabs.has('downloads') && <div hidden={activeTab !== 'downloads'} className={activeTab === 'downloads' ? 'tool-panel-enter' : undefined}><BatchDownloadQueue /></div>}
        </div>
      </div>
    </div>
  );
}
