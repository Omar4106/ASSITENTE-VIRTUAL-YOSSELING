'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, Download, HardDrive, ShieldCheck, Wrench } from 'lucide-react';

type Device = 'windows' | 'linux' | 'laptop' | 'android' | 'tablet';
type Issue = 'slow' | 'storage' | 'network' | 'drivers' | 'battery';

const DEVICES: Array<{ value: Device; label: string }> = [
  { value: 'windows', label: 'PC Windows' },
  { value: 'linux', label: 'Equipo Linux' },
  { value: 'laptop', label: 'Laptop Windows' },
  { value: 'android', label: 'Android' },
  { value: 'tablet', label: 'Tablet Android' },
];
const ISSUES: Array<{ value: Issue; label: string }> = [
  { value: 'slow', label: 'Lentitud' },
  { value: 'storage', label: 'Almacenamiento' },
  { value: 'network', label: 'Red / Wi-Fi' },
  { value: 'drivers', label: 'Drivers / dispositivos' },
  { value: 'battery', label: 'Batería' },
];

interface GeneratedGuide {
  filename: string;
  language: string;
  contents: string;
  steps: string[];
  launcherFilename?: string;
  launcherContents?: string;
}

function createWindowsGuide(issue: Issue): GeneratedGuide {
  const steps: Record<Issue, string[]> = {
    slow: ['Revisa el uso de CPU y memoria.', 'Elimina archivos temporales solo después de confirmar.', 'Usa DISM y SFC para comprobar archivos del sistema.'],
    storage: ['Muestra el espacio disponible.', 'Lista temporales de tu perfil.', 'Pide confirmación antes de eliminarlos.'],
    network: ['Vacía la caché DNS.', 'Restablece Winsock y TCP/IP solo tras confirmación.', 'Requiere reiniciar el equipo para completar los cambios.'],
    drivers: ['Abre el Administrador de dispositivos.', 'Revisa manualmente los dispositivos con alertas.', 'Descarga drivers solo desde Windows Update o el sitio del fabricante.'],
    battery: ['Genera un informe de batería de Windows.', 'Muestra la ruta del informe para su revisión.', 'No cambia la configuración de energía automáticamente.'],
  };
  const commands: Record<Issue, string> = {
    slow: `$confirm = Read-Host "Eliminar temporales de usuario y ejecutar DISM/SFC? (S/N)"\nif ($confirm -notmatch '^(S|s)$') { Write-Host "Sin cambios."; exit }\nGet-ChildItem -LiteralPath $env:TEMP -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue\nDISM.exe /Online /Cleanup-Image /RestoreHealth\nsfc.exe /scannow`,
    storage: `$free = Get-PSDrive -Name C\nWrite-Host ("Espacio libre en C: {0:N2} GB" -f ($free.Free / 1GB))\n$confirm = Read-Host "Eliminar archivos temporales de tu perfil? (S/N)"\nif ($confirm -match '^(S|s)$') {\n  Get-ChildItem -LiteralPath $env:TEMP -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue\n}`,
    network: `$confirm = Read-Host "Restablecer Winsock y TCP/IP? Se requiere reiniciar. (S/N)"\nif ($confirm -notmatch '^(S|s)$') { Write-Host "Sin cambios."; exit }\nClear-DnsClientCache\nnetsh winsock reset\nnetsh int ip reset`,
    drivers: `Write-Host "Se abrirá el Administrador de dispositivos para revisión manual."\nStart-Process devmgmt.msc\nWrite-Host "No instales drivers desde sitios de terceros. Usa Windows Update o el fabricante."`,
    battery: `$report = Join-Path $env:USERPROFILE "battery-report.html"\npowercfg /batteryreport /output $report\nWrite-Host "Informe creado en: $report"\nStart-Process $report`,
  };
  const launcherChecks: Record<Issue, string[]> = {
    slow: [
      'echo === Comprobacion DISM (no realiza reparaciones) ===',
      'DISM.exe /Online /Cleanup-Image /CheckHealth',
      'echo === Verificacion de archivos de sistema (solo lectura) ===',
      'sfc.exe /verifyonly',
    ],
    storage: [
      'echo === Espacio libre de la unidad del sistema ===',
      'fsutil volume diskfree %SystemDrive%',
      'echo === Se abrira el Liberador de espacio para que elijas que revisar ===',
      'cleanmgr.exe',
    ],
    network: [
      'echo === Configuracion de red ===',
      'ipconfig.exe /all',
      'echo === Prueba de conectividad con 1.1.1.1 ===',
      'ping.exe -n 4 1.1.1.1',
    ],
    drivers: [
      'echo === Informacion de controladores instalados ===',
      'driverquery.exe /fo table',
      'echo === Se abrira el Administrador de dispositivos ===',
      'start "" devmgmt.msc',
    ],
    battery: [
      'echo === Generando informe de bateria ===',
      'powercfg.exe /batteryreport /output "%USERPROFILE%\\battery-report.html"',
      'if exist "%USERPROFILE%\\battery-report.html" start "" "%USERPROFILE%\\battery-report.html"',
    ],
  };
  const launcherContents = [
    '@echo off',
    'setlocal',
    'title Yosseling - Diagnostico de Windows',
    'echo Este archivo ejecutara comprobaciones de diagnostico seleccionadas.',
    'echo No elimina archivos ni instala software.',
    'echo Revisa los comandos en pantalla antes de continuar.',
    'echo.',
    'choice /C SN /N /M "Deseas iniciar el diagnostico? (S/N): "',
    'if errorlevel 2 goto cancelled',
    'echo.',
    ...launcherChecks[issue],
    'echo.',
    'echo Diagnostico finalizado. Revisa cualquier mensaje anterior.',
    'goto finish',
    ':cancelled',
    'echo Diagnostico cancelado; no se ejecutaron cambios.',
    ':finish',
    'echo.',
    'pause',
    'endlocal',
    '',
  ].join('\r\n');
  const safeIssue = issue;
  return {
    filename: 'yosseling-diagnostico.ps1',
    language: 'powershell',
    contents: `# Yosseling Device Doctor — revisión: ${safeIssue}\n# Lee los comandos antes de continuar. No se ejecuta desde la aplicación.\n${commands[issue]}\n`,
    steps: steps[issue],
    launcherFilename: 'yosseling-diagnostico.bat',
    launcherContents,
  };
}

function createLinuxGuide(issue: Issue): GeneratedGuide {
  const steps: Record<Issue, string[]> = {
    slow: ['Muestra carga y memoria sin detener procesos.', 'Limpia caché de paquetes solo tras confirmación.', 'No termina procesos automáticamente.'],
    storage: ['Muestra espacio disponible.', 'Identifica temporales del usuario.', 'Solicita confirmación antes de borrar.'],
    network: ['Reinicia la caché DNS usando systemd-resolved si está activo.', 'No modifica reglas de firewall.'],
    drivers: ['Muestra la distribución y dispositivos PCI/USB.', 'Revisa drivers con el gestor de tu distribución.'],
    battery: ['Muestra el estado de batería si upower está instalado.', 'No altera perfiles de energía.'],
  };
  const commands: Record<Issue, string> = {
    slow: `#!/usr/bin/env bash\nset -euo pipefail\nuptime\nfree -h\nps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 11\nread -r -p "Limpiar caché de paquetes apt? (s/N) " answer\nif [[ "$answer" =~ ^[sS]$ ]] && command -v apt-get >/dev/null 2>&1; then\n  sudo apt-get clean\nfi`,
    storage: `#!/usr/bin/env bash\nset -euo pipefail\ndf -h "$HOME"\nprintf "Tamaño de temporales del usuario: "\ndu -sh "${'${TMPDIR:-/tmp}'}" 2>/dev/null || true\nread -r -p "Limpiar archivos propios de ~/.cache? (s/N) " answer\nif [[ "$answer" =~ ^[sS]$ ]]; then\n  find "$HOME/.cache" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +\nfi`,
    network: `#!/usr/bin/env bash\nset -euo pipefail\nif command -v resolvectl >/dev/null 2>&1; then\n  read -r -p "Vaciar caché DNS de systemd-resolved? (s/N) " answer\n  if [[ "$answer" =~ ^[sS]$ ]]; then sudo resolvectl flush-caches; fi\nelse\n  echo "systemd-resolved no está disponible; no se realizaron cambios."\nfi`,
    drivers: `#!/usr/bin/env bash\nset -euo pipefail\nuname -a\nif command -v lspci >/dev/null 2>&1; then lspci; else echo "Instala pciutils con el gestor oficial de tu distribución para consultar PCI."; fi\nif command -v lsusb >/dev/null 2>&1; then lsusb; fi\necho "Revisa controladores sugeridos en la documentación de tu distribución."`,
    battery: `#!/usr/bin/env bash\nset -euo pipefail\nif command -v upower >/dev/null 2>&1; then\n  upower -e | grep -i battery | while read -r device; do upower -i "$device"; done\nelse\n  echo "Instala upower desde el repositorio oficial de tu distribución para consultar batería."\nfi`,
  };
  return { filename: 'yosseling-diagnostico.sh', language: 'bash', contents: commands[issue], steps: steps[issue] };
}

function createAndroidGuide(issue: Issue): GeneratedGuide {
  const steps: Record<Issue, string[]> = {
    slow: ['Revisa el uso de batería y memoria en Ajustes.', 'Cierra aplicaciones desde el selector del sistema.', 'Reinicia si el problema persiste.'],
    storage: ['Abre Ajustes → Almacenamiento.', 'Revisa archivos grandes y aplicaciones.', 'Elimina solo datos que reconozcas; evita limpiar datos de apps del sistema.'],
    network: ['Activa y desactiva modo avión.', 'Olvida y vuelve a agregar la red Wi-Fi.', 'Restablece ajustes de red solo si conoces las contraseñas guardadas.'],
    drivers: ['Instala actualizaciones del sistema desde Ajustes.', 'Android no ofrece gestión universal de drivers vía ADB.', 'Contacta al fabricante para fallos de hardware.'],
    battery: ['Revisa consumo por aplicación en Ajustes → Batería.', 'Desactiva funciones que no uses.', 'Comprueba el estado físico de la batería con soporte técnico.'],
  };
  const adb = issue === 'storage'
    ? 'adb shell df -h /data\n# Revisa almacenamiento desde Ajustes > Almacenamiento.'
    : issue === 'network'
      ? 'adb shell dumpsys wifi\n# Para cambiar la red, usa Ajustes > Red e Internet.'
      : issue === 'battery'
        ? 'adb shell dumpsys battery\n# Consulta consumo por aplicación en Ajustes > Batería.'
        : 'adb shell dumpsys meminfo\n# Revisa aplicaciones desde Ajustes > Aplicaciones.';
  return {
    filename: 'yosseling-diagnostico-android.txt',
    language: 'text',
    contents: `Guía Android — ${issue}\n${adb}\n\nLos comandos son de consulta. No ejecutes comandos ADB de origen desconocido.`,
    steps: steps[issue],
  };
}

export function DeviceDoctor() {
  const [isMounted, setIsMounted] = useState(false);
  const [device, setDevice] = useState<Device>('windows');
  const [issue, setIssue] = useState<Issue>('slow');
  const [copied, setCopied] = useState(false);
  const guide = useMemo(
    () => device === 'linux' ? createLinuxGuide(issue) : device === 'android' || device === 'tablet' ? createAndroidGuide(issue) : createWindowsGuide(issue),
    [device, issue],
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const copy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(guide.contents);
      setCopied(true);
      if (typeof window !== 'undefined') window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const downloadFile = (contents: string, filename: string) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadLauncher = () => {
    if (!guide.launcherContents || !guide.launcherFilename) return;
    downloadFile(guide.launcherContents, guide.launcherFilename);
  };

  if (!isMounted) {
    return <div className="p-6 text-zinc-400">Cargando herramienta...</div>;
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white"><Wrench size={18} className="text-amber-300" /> Doctor de dispositivos</h2>
        <p className="mt-1 text-xs text-white/55">Descarga una guía o un diagnóstico interactivo para ejecutar y revisar en tu equipo. Yosseling nunca ejecuta archivos en tu dispositivo.</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs text-white/65">
          Dispositivo
          <select value={device} onChange={(event) => setDevice(event.target.value as Device)} className="w-full rounded-lg border border-white/10 bg-[#171923] px-3 py-2 text-sm text-white">
            {DEVICES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs text-white/65">
          Tipo de falla
          <select value={issue} onChange={(event) => setIssue(event.target.value as Issue)} className="w-full rounded-lg border border-white/10 bg-[#171923] px-3 py-2 text-sm text-white">
            {ISSUES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-white"><HardDrive size={15} className="text-amber-200" /> Pasos de diagnóstico</h3>
        <ol className="mt-3 list-inside list-decimal space-y-1.5 text-xs text-white/70">
          {guide.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-100/75">
          <ShieldCheck size={13} />
          {guide.launcherContents
            ? 'El archivo BAT solicita confirmación y ejecuta comprobaciones; no borra archivos ni instala software. Revisa su contenido antes de abrirlo.'
            : 'Revisa los comandos antes de ejecutarlos; algunas acciones requieren confirmación y permisos del sistema.'}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#090a10]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2">
          <span className="font-mono text-xs text-white/65">{guide.filename}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/65 hover:bg-white/10 hover:text-white">
              {copied ? <Check size={13} /> : <Clipboard size={13} />}{copied ? 'Copiado' : 'Copiar'}
            </button>
            <button type="button" onClick={() => downloadFile(guide.contents, guide.filename)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/65 hover:bg-white/10 hover:text-white">
              <Download size={13} /> Descargar
            </button>
          </div>
        </div>
        <pre className="max-h-80 overflow-auto p-4 text-xs leading-relaxed text-green-100/80"><code>{guide.contents}</code></pre>
      </div>
      {guide.launcherContents && guide.launcherFilename && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#090a10]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2">
            <span className="font-mono text-xs text-white/65">{guide.launcherFilename} · diagnóstico interactivo</span>
            <button
              type="button"
              onClick={downloadLauncher}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-100/80 hover:bg-white/10 hover:text-white"
            >
              <Download size={13} /> Descargar para Windows
            </button>
          </div>
          <pre className="max-h-64 overflow-auto p-4 text-xs leading-relaxed text-amber-100/75"><code>{guide.launcherContents}</code></pre>
        </div>
      )}
    </section>
  );
}
