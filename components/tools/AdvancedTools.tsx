'use client';

import { useEffect, useState } from 'react';
import { BriefcaseBusiness, Camera, HardDrive, Headphones, ListVideo } from 'lucide-react';
import { BatchDownloadQueue } from './BatchDownloadQueue';
import { DeviceDoctor } from './DeviceDoctor';
import { JobRadar } from './JobRadar';
import { LiveVision } from './LiveVision';
import { VoiceMode } from './VoiceMode';

const TOOL_TABS = [
  { id: 'job', label: 'Empleo', icon: BriefcaseBusiness },
  { id: 'doctor', label: 'Dispositivos', icon: HardDrive },
  { id: 'voice', label: 'Voz', icon: Headphones },
  { id: 'vision', label: 'Visión', icon: Camera },
  { id: 'downloads', label: 'Descargas', icon: ListVideo },
] as const;

type ToolTab = (typeof TOOL_TABS)[number]['id'];

export function AdvancedTools() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ToolTab>('job');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="p-6 text-zinc-400">Cargando herramienta...</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <nav aria-label="Herramientas avanzadas" className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2 sm:px-6">
        {TOOL_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
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
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {activeTab === 'job' && <JobRadar />}
          {activeTab === 'doctor' && <DeviceDoctor />}
          {activeTab === 'voice' && <VoiceMode />}
          {activeTab === 'vision' && <LiveVision />}
          {activeTab === 'downloads' && <BatchDownloadQueue />}
        </div>
      </div>
    </div>
  );
}
