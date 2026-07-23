'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Chrome as Home, MessageSquare, Brain, Cpu, Wrench, Settings, ChevronRight, Search, MoveHorizontal as MoreHorizontal, CreditCard as Edit2, Trash2, Pin, PinOff, Star, Clock, Hash, DollarSign, Wifi } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { PROVIDERS } from '@/lib/ai-providers';
import type { Chat, SidebarView } from '@/types';
import { cn } from '@/lib/utils';

const NAV_ITEMS: { id: SidebarView; icon: React.ReactNode; label: string }[] = [
  { id: 'chats',      icon: <Home size={17} />,          label: 'Inicio' },
  { id: 'chats',      icon: <MessageSquare size={17} />, label: 'Chats' },
  { id: 'memory',     icon: <Brain size={17} />,         label: 'Memoria' },
  { id: 'pinned',     icon: <Cpu size={17} />,           label: 'Centro IA' },
  { id: 'images',     icon: <Wrench size={17} />,        label: 'Herramientas' },
  { id: 'settings',   icon: <Settings size={17} />,      label: 'Configuración' },
];

function ChatItem({ chat, isActive }: { chat: Chat; isActive: boolean }) {
  const { setActiveChat, deleteChat, renameChat, pinChat, favoriteChat } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(chat.title);

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200',
        isActive
          ? 'glass-card text-white'
          : 'hover:bg-white/[0.04] text-[#BDB7CC]'
      )}
      onClick={() => !isRenaming && setActiveChat(chat.id)}
    >
      <MessageSquare size={14} className={cn('shrink-0', isActive && 'text-purple-400')} />
      {isRenaming ? (
        <input
          autoFocus
          className="flex-1 bg-transparent text-sm outline-none text-white"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onBlur={() => { renameChat(chat.id, newTitle); setIsRenaming(false); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { renameChat(chat.id, newTitle); setIsRenaming(false); }
            if (e.key === 'Escape') { setIsRenaming(false); setNewTitle(chat.title); }
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-sm truncate">{chat.title}</span>
      )}

      {(chat.isPinned || chat.isFavorite) && (
        <div className="flex gap-1">
          {chat.isPinned && <Pin size={10} className="text-blue-400" />}
          {chat.isFavorite && <Star size={10} className="text-yellow-400" />}
        </div>
      )}

      <div
        className={cn('opacity-0 group-hover:opacity-100 transition-opacity', showMenu && 'opacity-100')}
        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
      >
        <MoreHorizontal size={14} className="text-[#BDB7CC] hover:text-white" />
      </div>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-9 z-50 glass-strong rounded-xl shadow-2xl py-1 min-w-[160px]"
            onClick={e => e.stopPropagation()}
          >
            {[
              { icon: <Edit2 size={13} />, label: 'Renombrar', action: () => { setIsRenaming(true); setShowMenu(false); } },
              { icon: chat.isPinned ? <PinOff size={13} /> : <Pin size={13} />, label: chat.isPinned ? 'Desfijar' : 'Fijar', action: () => { pinChat(chat.id); setShowMenu(false); } },
              { icon: <Star size={13} />, label: chat.isFavorite ? 'Quitar favorito' : 'Favorito', action: () => { favoriteChat(chat.id); setShowMenu(false); } },
              { icon: <Trash2 size={13} />, label: 'Eliminar', action: () => { deleteChat(chat.id); setShowMenu(false); }, danger: true },
            ].map(item => (
              <button
                key={item.label}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors',
                  (item as { danger?: boolean }).danger ? 'text-red-400' : 'text-[#BDB7CC]'
                )}
                onClick={item.action}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <div className="flex items-center gap-1.5 text-[#BDB7CC]/70">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium truncate max-w-[55%]" style={{ color: color ?? '#E9D5FF' }}>
        {value}
      </span>
    </div>
  );
}

export function Sidebar() {
  const {
    chats, activeChatId, sidebarView, setSidebarView,
    createNewChat, selectedModel, selectedProvider,
    settings, searchQuery, setSearchQuery,
    aiCenterData,
  } = useAppStore();

  const [collapsed, setCollapsed] = useState(false);
  const provider = PROVIDERS[selectedProvider];

  const filteredChats = chats.filter(c => {
    const view = sidebarView;
    if (view === 'favorites') return c.isFavorite;
    if (view === 'pinned') return c.isPinned;
    if (view === 'shared') return c.isShared;
    return true;
  }).filter(c =>
    searchQuery ? c.title.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const activeNav = sidebarView === 'pinned' ? 'pinned' : sidebarView === 'memory' ? 'memory' : sidebarView === 'settings' ? 'settings' : sidebarView === 'images' ? 'images' : 'chats';

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 280 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col h-full relative overflow-hidden"
      style={{
        background: 'rgba(18, 9, 31, 0.72)',
        backdropFilter: 'blur(28px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* ── Logo ── */}
      <div className={cn('flex items-center gap-3 px-5 py-5', collapsed && 'px-3 justify-center')}>
        <div className="relative w-9 h-9 shrink-0">
          <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-md" />
          <Image
            src="/assets/images/logo_de_yosseling_sin_fondo_.png"
            alt="Yosseling"
            fill
            className="object-contain relative z-10"
          />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 overflow-hidden"
            >
              <div className="flex items-center gap-1.5">
                <span className="gradient-text font-bold text-base tracking-wide">YOSSELING</span>
                <span className="text-[10px] font-bold text-purple-400/80 bg-purple-500/10 px-1.5 py-0.5 rounded-md">2.0</span>
              </div>
              <p className="text-[10px] text-[#BDB7CC]/60 mt-0.5">Tu asistente inteligente</p>
            </motion.div>
          )}
        </AnimatePresence>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[#BDB7CC] hover:text-white transition-colors"
          >
            <motion.div animate={{ rotate: collapsed ? 0 : 180 }}>
              <ChevronRight size={16} />
            </motion.div>
          </button>
        )}
      </div>

      {/* ── New Chat ── */}
      <div className={cn('px-4 py-2', collapsed && 'px-2')}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={createNewChat}
          className={cn(
            'w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all',
            'text-white glow-soft',
            collapsed && 'justify-center px-2'
          )}
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.9) 0%, rgba(255, 95, 215, 0.8) 100%)',
            boxShadow: '0 4px 20px rgba(168, 85, 247, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          }}
        >
          <Plus size={18} className="shrink-0" />
          {!collapsed && <span>Nuevo Chat</span>}
        </motion.button>
      </div>

      {/* ── Search ── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-2"
          >
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BDB7CC]/50" />
              <input
                type="text"
                placeholder="Buscar chats..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full glass-card rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-[#BDB7CC]/40 outline-none focus:border-purple-500/30 transition-all"
                style={{ background: 'rgba(255, 255, 255, 0.04)' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1 pb-2">
        {NAV_ITEMS.map((item, idx) => {
          const isActive = idx === 0 ? sidebarView === 'chats' && !searchQuery : activeNav === item.id;
          return (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => setSidebarView(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                isActive
                  ? 'glass-card text-white'
                  : 'text-[#BDB7CC] hover:bg-white/[0.04] hover:text-white',
                collapsed && 'justify-center px-2'
              )}
            >
              <span className={cn(isActive && 'text-purple-400')}>{item.icon}</span>
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </button>
          );
        })}

        {/* Chat list */}
        <AnimatePresence>
          {!collapsed && (sidebarView === 'chats' || sidebarView === 'favorites' || sidebarView === 'pinned' || sidebarView === 'shared') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 space-y-1 max-h-48 overflow-y-auto"
            >
              {filteredChats.length === 0 ? (
                <p className="text-xs text-[#BDB7CC]/40 px-3 py-2">Sin conversaciones</p>
              ) : (
                filteredChats.map(chat => (
                  <ChatItem key={chat.id} chat={chat} isActive={chat.id === activeChatId} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── System Status Widget ── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-3 pb-2"
          >
            <div
              className="rounded-2xl p-3.5 space-y-2.5"
              style={{
                background: 'linear-gradient(135deg, rgba(35, 19, 60, 0.5) 0%, rgba(26, 16, 48, 0.5) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#BDB7CC]/60">Estado del sistema</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] text-green-400 font-medium">Todo OK</span>
                </div>
              </div>

              <StatusRow icon={<Wifi size={11} />} label="Proveedor" value={provider?.name ?? selectedProvider} color={provider?.color} />
              <StatusRow icon={<Cpu size={11} />} label="Modelo" value={aiCenterData?.activeModel ?? selectedModel} />
              <StatusRow icon={<Clock size={11} />} label="Latencia" value={aiCenterData ? `${aiCenterData.latency}ms` : '—'} />
              <StatusRow icon={<Hash size={11} />} label="Tokens" value={aiCenterData ? String(aiCenterData.tokens) : '0'} />
              <StatusRow icon={<DollarSign size={11} />} label="Costo" value={aiCenterData ? `$${aiCenterData.costEstimate.toFixed(6)}` : '$0'} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Yosseling Profile Card ── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-3 pb-3"
          >
            <div
              className="rounded-2xl p-3 flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(255, 95, 215, 0.08) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.15)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-purple-400/30">
                  <Image
                    src="/assets/images/logo_de_yosseling_sin_fondo_.png"
                    alt="Yosseling"
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#1A1030]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Yosseling</p>
                <p className="text-[10px] text-green-400 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                  En línea
                </p>
                <p className="text-[10px] text-[#BDB7CC]/60 mt-0.5 italic">Siempre aquí para ti.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
