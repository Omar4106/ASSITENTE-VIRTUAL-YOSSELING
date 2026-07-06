'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAppStore, useActiveChat } from '@/lib/store';
import { MessageBubble } from './MessageBubble';
import { InputBar } from './InputBar';
import { useVoice } from '@/hooks/useVoice';

const QUICK_ACTIONS = [
  { label: 'Generar imagen', prompt: 'Genera una imagen de ' },
  { label: 'Leer en voz alta', prompt: '' },
  { label: 'Analizar documento', prompt: 'Analiza este documento: ' },
  { label: 'Imprimir documento', prompt: 'Prepara el siguiente texto para imprimir: ' },
  { label: 'Resumir texto', prompt: 'Resume el siguiente texto: ' },
  { label: 'Código', prompt: 'Escribe el código para: ' },
  { label: 'OCR', prompt: 'Extrae el texto de esta imagen: ' },
  { label: 'Traducir', prompt: 'Traduce al español: ' },
];

export function ChatArea() {
  const { activeChatId, isStreaming, sendMessage } = useAppStore();
  const activeChat = useActiveChat();
  const { speak } = useVoice();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages?.length, isStreaming]);

  const hasMessages = (activeChat?.messages?.length ?? 0) > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {!hasMessages ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center h-full px-6 py-12 text-center"
            >
              {/* Avatar */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="relative mb-6"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-purple-500/40 shadow-2xl shadow-purple-500/20">
                  <Image
                    src="/assets/images/logo_de_yosseling_sin_fondo_.png"
                    alt="Yosseling"
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                  />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full border border-purple-500/20"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-2xl font-bold text-white mb-2">
                  ¡Hola! Soy <span className="gradient-text">Yosseling</span> <Sparkles className="inline w-5 h-5 text-yellow-400" />
                </h2>
                <p className="text-[#B3B3B3] text-sm mb-8 max-w-md">
                  Tu asistente inteligente, creada para ayudarte en todo lo que necesites. 💜
                </p>
              </motion.div>

              {/* Quick actions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl w-full"
              >
                {QUICK_ACTIONS.map((action, i) => (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => action.prompt && sendMessage(action.prompt)}
                    className="px-3 py-2.5 rounded-xl bg-[#171923] border border-white/[0.06] text-xs text-[#B3B3B3] hover:text-white hover:border-purple-500/30 hover:bg-purple-500/10 transition-all text-center"
                  >
                    {action.label}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-4"
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
                    className="flex items-center gap-3 px-4 py-2"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/30">
                      <Image
                        src="/assets/images/logo_de_yosseling_sin_fondo_.png"
                        alt="Yosseling"
                        width={32}
                        height={32}
                        className="object-cover"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#171923] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-purple-400"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
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
