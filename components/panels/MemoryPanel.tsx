'use client';

import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CreditCard as Edit2, X, Check, Brain, Tag, Search, Download, Upload, Copy } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { MemoryItem, MemoryCategory, MemoryImportance, MemoryType } from '@/types';
import { cn } from '@/lib/utils';

const CATS: MemoryCategory[] = ['personal','trabajo','estudios','familia','mascotas','preferencias','proyectos','objetivos','hobbies','otros'];
const CAT_LABELS: Record<MemoryCategory, string> = { personal:'Personal', trabajo:'Trabajo', estudios:'Estudios', familia:'Familia', mascotas:'Mascotas', preferencias:'Preferencias', proyectos:'Proyectos', objetivos:'Objetivos', hobbies:'Hobbies', otros:'Otros' };
const CAT_COLORS: Record<MemoryCategory, string> = { personal:'#4F9DFF', trabajo:'#10B981', estudios:'#F59E0B', familia:'#EC4899', mascotas:'#F97316', preferencias:'#A855F7', proyectos:'#06B6D4', objetivos:'#8B5CF6', hobbies:'#EAB308', otros:'#B3B3B3' };
const IMP_LABELS: Record<MemoryImportance, string> = { low:'Baja', medium:'Media', high:'Alta' };
const IMP_COLORS: Record<MemoryImportance, string> = { low:'#B3B3B3', medium:'#F59E0B', high:'#EF4444' };
const TYPE_LABELS: Record<MemoryType, string> = { temporal:'Temporal', persistent:'Persistente', preference:'Preferencia' };

export function MemoryPanel() {
  const { memory, addMemoryItem, updateMemoryItem, deleteMemoryItem, clearMemory, duplicateMemoryItem, exportMemoryData, importMemoryData, memoryIndicator } = useAppStore();

  const [adding, setAdding] = useState(false);
  const [nTitle, setNTitle] = useState(''); const [nContent, setNContent] = useState('');
  const [nCat, setNCat] = useState<MemoryCategory>('otros'); const [nImp, setNImp] = useState<MemoryImportance>('medium');
  const [nType, setNType] = useState<MemoryType>('persistent'); const [nTags, setNTags] = useState('');

  const [editId, setEditId] = useState<string|null>(null);
  const [eTitle, setETitle] = useState(''); const [eContent, setEContent] = useState('');
  const [eCat, setECat] = useState<MemoryCategory>('otros'); const [eImp, setEImp] = useState<MemoryImportance>('medium');
  const [eType, setEType] = useState<MemoryType>('persistent'); const [eTags, setETags] = useState('');

  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState<MemoryCategory|'all'>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => memory.filter(m => {
    if (filterCat !== 'all' && m.category !== filterCat) return false;
    if (query) { const q = query.toLowerCase(); return m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q) || m.tags.some(t => t.toLowerCase().includes(q)); }
    return true;
  }), [memory, query, filterCat]);

  const handleAdd = async () => {
    if (!nTitle.trim() || !nContent.trim()) return;
    await addMemoryItem({ title: nTitle.trim(), content: nContent.trim(), category: nCat, importance: nImp, type: nType, tags: nTags.split(',').map(t=>t.trim()).filter(Boolean), source:'manual' });
    setNTitle(''); setNContent(''); setNTags(''); setNCat('otros'); setNImp('medium'); setNType('persistent'); setAdding(false);
  };

  const handleEdit = async (id: string) => {
    if (!eTitle.trim() || !eContent.trim()) return;
    await updateMemoryItem(id, { title: eTitle.trim(), content: eContent.trim(), category: eCat, importance: eImp, type: eType, tags: eTags.split(',').map(t=>t.trim()).filter(Boolean) });
    setEditId(null);
  };

  const startEdit = (m: MemoryItem) => { setEditId(m.id); setETitle(m.title); setEContent(m.content); setECat(m.category); setEImp(m.importance); setEType(m.type); setETags(m.tags.join(', ')); };

  const handleExport = (fmt: 'json'|'txt'|'md') => {
    const d = exportMemoryData(fmt); const b = new Blob([d],{type:'text/plain'});
    const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download=`memorias.${fmt}`; a.click(); URL.revokeObjectURL(u);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if(!f) return;
    await importMemoryData(await f.text());
    if(fileRef.current) fileRef.current.value='';
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
          <button onClick={() => setAdding(!adding)} className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-500/10 transition-colors"><Plus size={15}/></button>
          <button onClick={() => handleExport('json')} className="p-1.5 rounded-lg text-[#B3B3B3] hover:text-white hover:bg-white/5 transition-colors" title="Exportar JSON"><Download size={15}/></button>
          <button onClick={() => fileRef.current?.click()} className="p-1.5 rounded-lg text-[#B3B3B3] hover:text-white hover:bg-white/5 transition-colors" title="Importar"><Upload size={15}/></button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden"/>
          <button onClick={() => window.confirm('¿Vaciar toda la memoria?') && clearMemory()} className="p-1.5 rounded-lg text-[#B3B3B3] hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={15}/></button>
        </div>
      </div>

      <AnimatePresence>
        {memoryIndicator && (
          <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}
            className={cn('mx-3 mt-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2',
              memoryIndicator.type==='save' && 'bg-green-500/10 text-green-400 border border-green-500/20',
              memoryIndicator.type==='update' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
              memoryIndicator.type==='delete' && 'bg-red-500/10 text-red-400 border border-red-500/20',
            )}>
            <Brain size={12}/><span>{memoryIndicator.title}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {memory.length > 0 && (
        <div className="px-3 py-2 border-b border-white/[0.06] space-y-2">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5">
            <Search size={13} className="text-[#B3B3B3] shrink-0"/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar..." className="flex-1 bg-transparent text-xs text-white placeholder-[#B3B3B3]/50 outline-none"/>
            {query && <button onClick={()=>setQuery('')} className="text-[#B3B3B3] hover:text-white"><X size={12}/></button>}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            <button onClick={()=>setFilterCat('all')} className={cn('text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors shrink-0', filterCat==='all'?'bg-white/15 text-white':'bg-white/5 text-[#B3B3B3] hover:bg-white/10')}>Todos</button>
            {CATS.map(c=><button key={c} onClick={()=>setFilterCat(c)} className={cn('text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors shrink-0', filterCat===c?'text-white':'bg-white/5 text-[#B3B3B3] hover:bg-white/10')} style={filterCat===c?{background:CAT_COLORS[c]+'40'}:undefined}>{CAT_LABELS[c]}</button>)}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence>
          {adding && (
            <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="bg-[#171923] border border-purple-500/30 rounded-xl p-3 space-y-2">
              <input autoFocus placeholder="Título" value={nTitle} onChange={e=>setNTitle(e.target.value)} className="w-full bg-transparent text-sm text-white placeholder-[#B3B3B3]/50 outline-none border-b border-white/10 pb-1"/>
              <textarea placeholder="Contenido" value={nContent} onChange={e=>setNContent(e.target.value)} rows={2} className="w-full bg-transparent text-sm text-white placeholder-[#B3B3B3]/50 outline-none border-b border-white/10 pb-1 resize-none"/>
              <div className="flex flex-wrap gap-1.5">
                <select value={nCat} onChange={e=>setNCat(e.target.value as MemoryCategory)} className="text-xs bg-white/5 text-[#B3B3B3] rounded px-2 py-1 border border-white/[0.06] outline-none">{CATS.map(c=><option key={c} value={c}>{CAT_LABELS[c]}</option>)}</select>
                <select value={nImp} onChange={e=>setNImp(e.target.value as MemoryImportance)} className="text-xs bg-white/5 text-[#B3B3B3] rounded px-2 py-1 border border-white/[0.06] outline-none">{(['low','medium','high'] as MemoryImportance[]).map(i=><option key={i} value={i}>{IMP_LABELS[i]}</option>)}</select>
                <select value={nType} onChange={e=>setNType(e.target.value as MemoryType)} className="text-xs bg-white/5 text-[#B3B3B3] rounded px-2 py-1 border border-white/[0.06] outline-none">{(['temporal','persistent','preference'] as MemoryType[]).map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>
              </div>
              <input placeholder="Etiquetas (coma separadas)" value={nTags} onChange={e=>setNTags(e.target.value)} className="w-full bg-transparent text-xs text-white placeholder-[#B3B3B3]/50 outline-none border-b border-white/10 pb-1"/>
              <div className="flex justify-end gap-1">
                <button onClick={()=>setAdding(false)} className="p-1.5 rounded-lg text-[#B3B3B3] hover:text-white hover:bg-white/5"><X size={13}/></button>
                <button onClick={handleAdd} className="p-1.5 rounded-lg text-white bg-purple-500 hover:bg-purple-400"><Check size={13}/></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Brain size={32} className="text-purple-500/30 mb-3"/>
            <p className="text-sm text-[#B3B3B3]/50">{memory.length===0?'Sin memorias guardadas':'Sin resultados'}</p>
            <p className="text-xs text-[#B3B3B3]/30 mt-1">{memory.length===0?'Conversa con Yosseling para detectar memorias automáticamente':'Prueba con otra búsqueda'}</p>
          </div>
        ) : filtered.map(item => (
          <motion.div key={item.id} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} className="group bg-[#171923] border border-white/[0.06] rounded-xl p-3">
            {editId===item.id ? (
              <div className="space-y-2">
                <input autoFocus value={eTitle} onChange={e=>setETitle(e.target.value)} className="w-full bg-transparent text-sm text-white outline-none border-b border-white/10 pb-1"/>
                <textarea value={eContent} onChange={e=>setEContent(e.target.value)} rows={2} className="w-full bg-transparent text-sm text-[#B3B3B3] outline-none border-b border-white/10 pb-1 resize-none"/>
                <div className="flex flex-wrap gap-1.5">
                  <select value={eCat} onChange={e=>setECat(e.target.value as MemoryCategory)} className="text-xs bg-white/5 text-[#B3B3B3] rounded px-2 py-1 border border-white/[0.06] outline-none">{CATS.map(c=><option key={c} value={c}>{CAT_LABELS[c]}</option>)}</select>
                  <select value={eImp} onChange={e=>setEImp(e.target.value as MemoryImportance)} className="text-xs bg-white/5 text-[#B3B3B3] rounded px-2 py-1 border border-white/[0.06] outline-none">{(['low','medium','high'] as MemoryImportance[]).map(i=><option key={i} value={i}>{IMP_LABELS[i]}</option>)}</select>
                  <select value={eType} onChange={e=>setEType(e.target.value as MemoryType)} className="text-xs bg-white/5 text-[#B3B3B3] rounded px-2 py-1 border border-white/[0.06] outline-none">{(['temporal','persistent','preference'] as MemoryType[]).map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select>
                </div>
                <input value={eTags} onChange={e=>setETags(e.target.value)} placeholder="Etiquetas" className="w-full bg-transparent text-xs text-white placeholder-[#B3B3B3]/50 outline-none border-b border-white/10 pb-1"/>
                <div className="flex justify-end gap-1">
                  <button onClick={()=>setEditId(null)} className="p-1 rounded text-[#B3B3B3] hover:text-white"><X size={12}/></button>
                  <button onClick={()=>handleEdit(item.id)} className="p-1 rounded text-white bg-purple-500 hover:bg-purple-400"><Check size={12}/></button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{background:CAT_COLORS[item.category]+'20',color:CAT_COLORS[item.category]}}>{CAT_LABELS[item.category]}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{background:IMP_COLORS[item.importance]+'20',color:IMP_COLORS[item.importance]}}>{IMP_LABELS[item.importance]}</span>
                    <span className="text-[10px] text-[#B3B3B3]/60 px-1 py-0.5 rounded-full bg-white/5">{TYPE_LABELS[item.type]}</span>
                    {item.source==='auto' && <span className="text-[10px] text-purple-400/70 px-1 py-0.5 rounded-full bg-purple-500/10">auto</span>}
                  </div>
                  <span className="text-xs font-medium text-white block truncate">{item.title}</span>
                  <p className="text-xs text-[#B3B3B3] line-clamp-2 mt-0.5">{item.content}</p>
                  {item.tags.length>0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <Tag size={9} className="text-[#B3B3B3]/40"/>
                      {item.tags.map(t=><span key={t} className="text-[9px] text-[#B3B3B3]/60 bg-white/5 px-1 py-0.5 rounded">{t}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={()=>startEdit(item)} className="p-1 rounded text-[#B3B3B3] hover:text-white hover:bg-white/5" title="Editar"><Edit2 size={11}/></button>
                  <button onClick={()=>duplicateMemoryItem(item.id)} className="p-1 rounded text-[#B3B3B3] hover:text-white hover:bg-white/5" title="Duplicar"><Copy size={11}/></button>
                  <button onClick={()=>deleteMemoryItem(item.id)} className="p-1 rounded text-[#B3B3B3] hover:text-red-400 hover:bg-red-500/10" title="Eliminar"><Trash2 size={11}/></button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
