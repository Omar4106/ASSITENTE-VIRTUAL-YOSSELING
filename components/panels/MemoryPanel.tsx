'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, X, Check, Brain, Tag } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { MemoryItem } from '@/types';
import { cn } from '@/lib/utils';

const CATEGORIES: MemoryItem['category'][] = ['preference', 'fact', 'instruction', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  preference: 'Preferencia',
  fact: 'Dato',
  instruction: 'Instrucción',
  other: 'Otro',
};
const CATEGORY_COLORS: Record<string, string> = {
  preference: '#A855F7',
  fact: '#4F9DFF',
  instruction: '#10B981',
  other: '#B3B3B3',
};

export function MemoryPanel() {
  const { memory, addMemoryItem, updateMemoryItem, deleteMemoryItem, clearMemory } = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryItem['category']>('other');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    await addMemoryItem(newKey.trim(), newValue.trim(), newCategory);
    setNewKey('');
    setNewValue('');
    setIsAdding(false);
  };

  const handleEdit = async (id: string) => {
    if (!editKey.trim() || !editValue.trim()) return;
    await updateMemoryItem(id, editKey.trim(), editValue.trim());
    setEditingId(null);
  };

  const startEdit = (item: MemoryItem) => {
    setEditingId(item.id);
    setEditKey(item.key);
    setEditValue(item.value);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">Memoria</span>
          <span className="text-xs text-[#B3B3B3] bg-white/5 px-1.5 py-0.5 rounded-full">{memory.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-500/10 transition-colors"
            title="Agregar memoria"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={() => confirm('¿Vaciar toda la memoria?') && clearMemory()}
            className="p-1.5 rounded-lg text-[#B3B3B3] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Vaciar memoria"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Add form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#171923] border border-purple-500/30 rounded-xl p-3 space-y-2"
            >
              <input
                autoFocus
                placeholder="Clave (ej: nombre, ciudad...)"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-[#B3B3B3]/50 outline-none border-b border-white/10 pb-1"
              />
              <input
                placeholder="Valor"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="w-full bg-transparent text-sm text-white placeholder-[#B3B3B3]/50 outline-none border-b border-white/10 pb-1"
              />
              <div className="flex items-center justify-between">
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as MemoryItem['category'])}
                  className="text-xs bg-white/5 text-[#B3B3B3] rounded px-2 py-1 border border-white/[0.06] outline-none"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c!]}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <button onClick={() => setIsAdding(false)} className="p-1.5 rounded-lg text-[#B3B3B3] hover:text-white hover:bg-white/5"><X size={13} /></button>
                  <button onClick={handleAdd} className="p-1.5 rounded-lg text-white bg-purple-500 hover:bg-purple-400"><Check size={13} /></button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {memory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Brain size={32} className="text-purple-500/30 mb-3" />
            <p className="text-sm text-[#B3B3B3]/50">Sin memorias guardadas</p>
            <p className="text-xs text-[#B3B3B3]/30 mt-1">Agrega información que Yosseling debe recordar</p>
          </div>
        ) : (
          memory.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-[#171923] border border-white/[0.06] rounded-xl p-3"
            >
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    value={editKey}
                    onChange={e => setEditKey(e.target.value)}
                    className="w-full bg-transparent text-sm text-white outline-none border-b border-white/10 pb-1"
                  />
                  <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEdit(item.id)}
                    className="w-full bg-transparent text-sm text-[#B3B3B3] outline-none"
                  />
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditingId(null)} className="p-1 rounded text-[#B3B3B3] hover:text-white"><X size={12} /></button>
                    <button onClick={() => handleEdit(item.id)} className="p-1 rounded text-white bg-purple-500 hover:bg-purple-400"><Check size={12} /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{
                          background: CATEGORY_COLORS[item.category ?? 'other'] + '20',
                          color: CATEGORY_COLORS[item.category ?? 'other'],
                        }}
                      >
                        {CATEGORY_LABELS[item.category ?? 'other']}
                      </span>
                      <span className="text-xs font-medium text-white truncate">{item.key}</span>
                    </div>
                    <p className="text-xs text-[#B3B3B3] line-clamp-2">{item.value}</p>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => startEdit(item)} className="p-1 rounded text-[#B3B3B3] hover:text-white hover:bg-white/5"><Edit2 size={11} /></button>
                    <button onClick={() => deleteMemoryItem(item.id)} className="p-1 rounded text-[#B3B3B3] hover:text-red-400 hover:bg-red-500/10"><Trash2 size={11} /></button>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
