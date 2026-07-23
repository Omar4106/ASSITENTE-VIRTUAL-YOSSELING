'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Lightbulb, FileText, Image as ImageIcon, ChartBar as BarChart3, Code, Globe, MessageSquare, Brain, Wrench, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAppStore, useActiveChat } from '@/lib/store';
import { MessageBubble } from './MessageBubble';
import { InputBar } from './InputBar';
import { useVoice } from '@/hooks/useVoice';

const QUICK_ACTIONS = [
  { label: 'Explorar ideas',     icon: <Lightbulb size={18} />,      prompt: 'Explora estas ideas conmigo: ', color: '#A855F7' },
  { label: 'Resumir documento',  icon: <FileText size={18} />,       prompt: 'Resume el siguiente documento: ', color: '#FF5FD7' },
  { label: 'Generar imagen',     icon: <ImageIcon size={18} />,      prompt: 'Genera una imagen de ', color: '#C084FC' },
  { label: 'Analizar datos',     icon: <BarChart3 size={18} />,      prompt: 'Analiza estos datos: ', color: '#34D399' },
  { label: 'Escribir código',    icon: <Code size={18} />,           prompt: 'Escribe el código para: ', color: '#60A5FA' },
  { label: 'Investigar en la web', icon: <Globe size={18} />,        prompt: 'Investiga en la web sobre: ', color: '#F472B6' },
];

const FEATURE_CARDS = [
  { icon: <MessageSquare size={20} />, title: 'Conversación Natural', desc: 'Diálogos fluidos y contextuales que se adaptan a ti.' },
  { icon: <Brain size={20} />,         title: 'Memoria Inteligente',  desc: 'Recuerda tus preferencias y conversaciones pasadas.' },
  { icon: <Wrench size={20} />,        title: 'Herramientas Poderosas', desc: 'OCR, traductor, generador de imágenes y más.' },
  { icon: <ShieldCheck size={20} />,   title: 'Privacidad Total',     desc: 'Tus datos permanecen privados y seguros.' },
  { icon: <RefreshCw size={20} />,     title: 'Actualizaciones Constantes', desc: 'Nuevas capacidades y mejoras continuamente.' },
];

export function ChatArea() {
  const { activeChatId, isStreaming, sendMessage } = useAppStore();
  const activeChat = useActiveChat();
  const { speak } = useVoice();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages?.length, isStreaming]);

  const hasMessages = (activeChat?.messages?.length ?? 0) > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {!hasMessages ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center min-h-full px-6 py-10 text-center"
            >
              {/* Avatar with glow rings */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="relative mb-8"
              >
                <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-2xl scale-150 breathe" />
                <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-purple-400/30 glow-purple">
                  <Image
                    src="/assets/images/logo_de_yosseling_sin_fondo_.png"
                    alt="Yosseling"
                    fill
                    className="object-cover"
                  />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full border border-purple-400/30"
                />
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute inset-0 rounded-full border border-pink-400/20"
                />
              </motion.div>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-2"
              >
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                  ¡Hola, soy <span className="gradient-text">Yosseling</span>!
                  <Sparkles className="inline w-6 h-6 ml-1 text-yellow-300/80" />
                </h1>
                <p className="text-[#BDB7CC] text-base">¿En qué puedo ayudarte hoy?</p>
              </motion.div>

              {/* Quick actions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl w-full mt-8"
              >
                {QUICK_ACTIONS.map((action, i) => (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    whileHover={{ scale: 1.03, y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => sendMessage(action.prompt)}
                    className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 text-center group"
                  >
                    <div
                      className="p-2.5 rounded-xl transition-transform group-hover:scale-110"
                      style={{
                        background: action.color + '20',
                        color: action.color,
                        boxShadow: `0 0 12px ${action.color}30`,
                      }}
                    >
                      {action.icon}
                    </div>
                    <span className="text-xs font-medium text-white/90">{action.label}</span>
                  </motion.button>
                ))}
              </motion.div>

              {/* Feature cards */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 max-w-4xl w-full mt-10"
              >
                {FEATURE_CARDS.map((card, i) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.08 }}
                    whileHover={{ y: -4 }}
                    className="glass-card rounded-2xl p-4 text-center group"
                  >
                    <div className="inline-flex p-2 rounded-xl bg-purple-500/10 text-purple-400 mb-2 group-hover:glow-purple transition-all">
                      {card.icon}
                    </div>
                    <h3 className="text-xs font-semibold text-white mb-1">{card.title}</h3>
                    <p className="text-[10px] text-[#BDB7CC]/70 leading-relaxed">{card.desc}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4 max-w-4xl mx-auto"
            >
              {activeChat?.messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  chatId={activeChatId!}
                  onSpeak={speak}
                />
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-3 px-4 py-2 max-w-4xl mx-auto"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-purple-400/30 glow-soft">
                      <Image
                        src="/assets/images/logo_de_yosseling_sin_fondo_.png"
                        alt="Yosseling"
                        width={36}
                        height={36}
                        className="object-cover"
                      />
                    </div>
                    <div
                      className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-5 py-4"
                      style={{
                        background: 'rgba(26, 16, 48, 0.6)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(168, 85, 247, 0.12)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
                      }}
                    >
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-purple-400"
                          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <InputBar />
    </div>
  );
}
