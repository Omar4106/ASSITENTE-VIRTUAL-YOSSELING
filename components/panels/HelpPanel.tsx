'use client';

import { HelpCircle, Keyboard, Zap } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['Enter'], desc: 'Enviar mensaje' },
  { keys: ['Shift', 'Enter'], desc: 'Nueva línea' },
  { keys: ['Ctrl', 'K'], desc: 'Nueva conversación' },
  { keys: ['Ctrl', '/'], desc: 'Buscar conversaciones' },
  { keys: ['Ctrl', 'Shift', 'C'], desc: 'Copiar última respuesta' },
  { keys: ['Esc'], desc: 'Cancelar / cerrar' },
];

const TIPS = [
  'Arrastra imágenes o documentos directamente al chat',
  'Usa el botón de micrófono para hablar',
  'Puedes editar o eliminar cualquier mensaje',
  'Exporta tus conversaciones desde Configuración',
  'Guarda información importante en Memoria',
];

export function HelpPanel() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <HelpCircle size={16} className="text-purple-400" />
        <span className="text-sm font-semibold text-white">Ayuda</span>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Keyboard size={14} className="text-purple-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Atajos de teclado</span>
          </div>
          <div className="space-y-2">
            {SHORTCUTS.map(({ keys, desc }) => (
              <div key={desc} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
                <span className="text-xs text-[#B3B3B3]">{desc}</span>
                <div className="flex gap-1">
                  {keys.map(k => (
                    <kbd key={k} className="text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded border border-white/10 font-mono">{k}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-purple-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Consejos</span>
          </div>
          <ul className="space-y-2">
            {TIPS.map(tip => (
              <li key={tip} className="flex items-start gap-2 text-xs text-[#B3B3B3]">
                <span className="text-purple-400 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
