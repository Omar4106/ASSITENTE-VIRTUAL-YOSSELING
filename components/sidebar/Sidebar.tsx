'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MessageSquare, Star, Pin, Share2, Brain,
  FileText, Image as ImageIcon, Printer, Settings,
  Keyboard, HelpCircle, ChevronRight, Search,
  MoreHorizontal, Edit2, Trash2, PinOff, Heart,
  X, User, Zap, Clock
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { PROVIDERS } from '@/lib/ai-providers';
import type { Chat, SidebarView } from '@/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const NAV_ITEMS: { id: SidebarView; icon: React.ReactNode; label: string }[] = [
  { id: 'chats', icon: <MessageSquare size={16} />, label: 'Chats' },
  { id: 'favorites', icon: <Star size={16} />, label: 'Favoritos' },
  { id: 'pinned', icon: <Pin size={16} />, label: 'Chats fijados' },
  { id: 'shared', icon: <Share2 size={16} />, label: 'Compartidos' },
  { id: 'memory', icon: <Brain size={16} />, label: 'Memoria' },
  { id: 'documents', icon: <FileText size={16} />, label: 'Documentos' },
  { id: 'images', icon: <ImageIcon size={16} />, label: 'Imágenes' },
  { id: 'printers', icon: <Printer size={16} />, label: 'Impresoras' },
  { id: 'settings', icon: <Settings size={16} />, label: 'Configuración' },
  { id: 'shortcuts', icon: <Keyboard size={16} />, label: 'Atajos de teclado' },
  { id: 'help', icon: <HelpCircle size={16} />, label: 'Ayuda' },
];

function ChatItem({ chat, isActive }: { chat: Chat; isActive: boolean }) {
  const { setActiveChat, deleteChat, renameChat, pinChat, favoriteChat } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(chat.title);

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150',
        isActive
          ? 'bg-purple-500/20 text-white'
          : 'hover:bg-white/5 text-[#B3B3B3]'
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
        className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity',
          showMenu && 'opacity-100'
        )}
        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
      >
        <MoreHorizontal size={14} className="text-[#B3B3B3] hover:text-white" />
      </div>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-8 z-50 bg-[#1A1B26] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]"
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
                  (item as { danger?: boolean }).danger ? 'text-red-400' : 'text-[#B3B3B3]'
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

export function Sidebar() {
  const {
    chats, activeChatId, sidebarView, setSidebarView,
    createNewChat, selectedModel, selectedProvider,
    settings, searchQuery, setSearchQuery,
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

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 60 : 260 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col h-full bg-[#111218] border-r border-white/[0.06] relative overflow-hidden"
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-4 border-b border-white/[0.06]', collapsed && 'px-3 justify-center')}>
        <div className="relative w-8 h-8 shrink-0">
          <Image
            src="/assets/images/logo_de_yosseling_sin_fondo_.png"
            alt="Yosseling"
            fill
            className="object-contain"
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
              <span className="gradient-text font-bold text-lg tracking-wide">Yosseling</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#B3B3B3] hover:text-white transition-colors ml-auto"
        >
          <motion.div animate={{ rotate: collapsed ? 0 : 180 }}>
            <ChevronRight size={16} />
          </motion.div>
        </button>
      </div>

      {/* New Chat */}
      <div className={cn('px-3 py-3', collapsed && 'px-2')}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={createNewChat}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400',
                  'text-white shadow-lg shadow-purple-500/20',
                  collapsed && 'justify-center px-2'
                )}
              >
                <Plus size={16} className="shrink-0" />
                {!collapsed && <span>Nuevo Chat</span>}
              </motion.button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Nuevo Chat</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Search */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 pb-2"
          >
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B3B3B3]" />
              <input
                type="text"
                placeholder="Buscar chats..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#B3B3B3]/50 outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
        <TooltipProvider>
          {NAV_ITEMS.slice(0, 4).map(item => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSidebarView(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                    sidebarView === item.id
                      ? 'bg-purple-500/15 text-purple-300'
                      : 'text-[#B3B3B3] hover:bg-white/5 hover:text-white',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
            </Tooltip>
          ))}
        </TooltipProvider>

        {/* Chat list */}
        <AnimatePresence>
          {!collapsed && (sidebarView === 'chats' || sidebarView === 'favorites' || sidebarView === 'pinned' || sidebarView === 'shared') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 space-y-0.5 max-h-60 overflow-y-auto"
            >
              {filteredChats.length === 0 ? (
                <p className="text-xs text-[#B3B3B3]/50 px-3 py-2">Sin conversaciones</p>
              ) : (
                filteredChats.map(chat => (
                  <ChatItem key={chat.id} chat={chat} isActive={chat.id === activeChatId} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div className="h-px bg-white/[0.06] my-2" />

        <TooltipProvider>
          {NAV_ITEMS.slice(4).map(item => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSidebarView(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                    sidebarView === item.id
                      ? 'bg-purple-500/15 text-purple-300'
                      : 'text-[#B3B3B3] hover:bg-white/5 hover:text-white',
                    collapsed && 'justify-center px-2'
                  )}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>

      {/* User / Model footer */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-t border-white/[0.06] p-3 space-y-2"
          >
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                <User size={12} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{settings.userName}</p>
                <p className="text-[10px] text-[#B3B3B3]">Cuenta Pro</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5">
              <Zap size={11} className="text-purple-400 shrink-0" />
              <span className="text-[10px] text-[#B3B3B3] truncate flex-1">Modelo activo</span>
              <span
                className="text-[10px] font-medium shrink-0"
                style={{ color: provider?.color ?? '#A855F7' }}
              >
                {provider?.name ?? selectedProvider}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
