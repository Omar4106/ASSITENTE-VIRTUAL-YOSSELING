/**
 * YOSSELING DEVICE OPTIMIZATION SCRIPT GENERATOR
 * Generates safe, static optimization scripts for Windows, Linux, and Android.
 * Scripts are never executed — they are delivered as text for the user to review.
 */

import type { Platform } from '@/lib/image-intent';

export interface OptimizationScript {
  platform: Platform;
  language: string;
  filename: string;
  code: string;
  description: string;
  steps: string[];
}

export function generateOptimizationScript(
  platform: Platform,
  _userText: string,
): OptimizationScript {
  switch (platform) {
    case 'windows':
      return windowsScript();
    case 'linux':
      return linuxScript();
    case 'android':
      return androidScript();
    default:
      return windowsScript();
  }
}

function windowsScript(): OptimizationScript {
  const code = [
    '# ============================================',
    '# Yosseling - Optimizacion de Windows (PowerShell)',
    '# Ejecutar como Administrador',
    '# ============================================',
    '',
    'Write-Host "Iniciando optimizacion..." -ForegroundColor Cyan',
    '',
    '# 1. Limpiar carpeta Temp del usuario',
    'Write-Host "[1/6] Limpiando carpeta Temp..." -ForegroundColor Yellow',
    '$tmpPath = $env:TEMP',
    'Get-ChildItem -Path $tmpPath -Recurse -Force -ErrorAction SilentlyContinue |',
    '  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue',
    'Write-Host "  Carpeta Temp limpiada." -ForegroundColor Green',
    '',
    '# 2. Limpiar Windows Temp del sistema',
    'Write-Host "[2/6] Limpiando Windows Temp..." -ForegroundColor Yellow',
    '$winTmp = "C:\\Windows\\Temp"',
    'if (Test-Path $winTmp) {',
    '  Get-ChildItem -Path $winTmp -Recurse -Force -ErrorAction SilentlyContinue |',
    '    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue',
    '}',
    'Write-Host "  Windows Temp limpiado." -ForegroundColor Green',
    '',
    '# 3. Vaciar Papeleria de reciclaje',
    'Write-Host "[3/6] Vaciando Papeleria de reciclaje..." -ForegroundColor Yellow',
    'Clear-RecycleBin -Force -ErrorAction SilentlyContinue',
    'Write-Host "  Papeleria vaciada." -ForegroundColor Green',
    '',
    '# 4. Limpiar cache DNS',
    'Write-Host "[4/6] Limpiando cache DNS..." -ForegroundColor Yellow',
    'ipconfig /flushdns | Out-Null',
    'Write-Host "  Cache DNS limpiada." -ForegroundColor Green',
    '',
    '# 5. Desactivar servicios innecesarios (opcional)',
    'Write-Host "[5/6] Desactivando servicios innecesarios..." -ForegroundColor Yellow',
    '$servicios = @(',
    '  "DiagTrack",          # Telemetria de Windows',
    '  "SysMain",            # Superfetch (puede causar 100% disco)',
    '  "WSearch"             # Indexer (alto uso de disco)',
    ')',
    'foreach ($svc in $servicios) {',
    '  $s = Get-Service -Name $svc -ErrorAction SilentlyContinue',
    '  if ($s) {',
    '    Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue',
    '    Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue',
    "    Write-Host \"  Servicio '$svc' desactivado.\" -ForegroundColor Green",
    '  }',
    '}',
    '',
    '# 6. Mostrar espacio liberado',
    'Write-Host "[6/6] Optimizacion completada." -ForegroundColor Cyan',
    '$drive = Get-PSDrive -Name C',
    '$freeGB = [math]::Round($drive.Free / 1GB, 2)',
    'Write-Host "Espacio libre en C: $freeGB GB" -ForegroundColor Green',
    'Write-Host "Reinicia el equipo para aplicar todos los cambios." -ForegroundColor Magenta',
  ].join('\n');

  return {
    platform: 'windows',
    language: 'powershell',
    filename: 'optimizar_windows.ps1',
    code,
    description: 'Script de optimizacion para Windows que limpia archivos temporales, vacia la papeleria, flusha el DNS y desactiva servicios innecesarios.',
    steps: [
      'Limpia la carpeta Temp del usuario (%TEMP%)',
      'Limpia la carpeta Windows Temp del sistema',
      'Vacia la Papeleria de reciclaje',
      'Limpia el cache DNS para mejorar la navegacion',
      'Desactiva servicios innecesarios: telemetria (DiagTrack), Superfetch (SysMain) e indexador (WSearch)',
      'Muestra el espacio libre disponible tras la limpieza',
    ],
  };
}

function linuxScript(): OptimizationScript {
  const code = [
    '#!/bin/bash',
    '# ============================================',
    '# Yosseling - Optimizacion de Linux',
    '# Ejecutar con: chmod +x optimizar_linux.sh && ./optimizar_linux.sh',
    '# ============================================',
    '',
    'echo -e "\\033[1;36mIniciando optimizacion...\\033[0m"',
    '',
    '# 1. Limpiar cache de paquetes',
    'echo -e "\\033[1;33m[1/5] Limpiando cache de paquetes...\\033[0m"',
    'sudo apt-get clean -y 2>/dev/null || sudo yum clean all 2>/dev/null || true',
    'sudo apt-get autoremove -y 2>/dev/null || true',
    'echo -e "\\033[1;32m  Cache de paquetes limpiado.\\033[0m"',
    '',
    '# 2. Limpiar cache de journals',
    'echo -e "\\033[1;33m[2/5] Limpiando journals de systemd...\\033[0m"',
    'sudo journalctl --vacuum-time=7d 2>/dev/null || true',
    'echo -e "\\033[1;32m  Journals reducidos a 7 dias.\\033[0m"',
    '',
    '# 3. Limpiar cache de thumbnails',
    'echo -e "\\033[1;33m[3/5] Limpiando cache de thumbnails...\\033[0m"',
    'rm -rf ~/.cache/thumbnails/* 2>/dev/null || true',
    'echo -e "\\033[1;32m  Thumbnails eliminados.\\033[0m"',
    '',
    '# 4. Limpiar carpeta temporal',
    'echo -e "\\033[1;33m[4/5] Limpiando carpeta temporal...\\033[0m"',
    'rm -rf /tmp/* 2>/dev/null || true',
    'sudo rm -rf /var/tmp/* 2>/dev/null || true',
    'echo -e "\\033[1;32m  Temporales eliminados.\\033[0m"',
    '',
    '# 5. Mostrar espacio libre',
    'echo -e "\\033[1;33m[5/5] Espacio actual:\\033[0m"',
    'df -h / | tail -1',
    '',
    'echo -e "\\033[1;36mOptimizacion completada.\\033[0m"',
  ].join('\n');

  return {
    platform: 'linux',
    language: 'bash',
    filename: 'optimizar_linux.sh',
    code,
    description: 'Script de optimizacion para Linux que limpia cache de paquetes, journals de systemd, thumbnails y temporales.',
    steps: [
      'Limpia el cache de paquetes (apt/yum) y elimina dependencias huerfanas',
      'Reduce los journals de systemd a los ultimos 7 dias',
      'Elimina el cache de thumbnails del usuario',
      'Limpia las carpetas temporales /tmp y /var/tmp',
      'Muestra el espacio libre en disco tras la limpieza',
    ],
  };
}

function androidScript(): OptimizationScript {
  const code = [
    '# ============================================',
    '# Yosseling - Optimizacion de Android via ADB',
    '# Requiere: ADB instalado y depuracion USB activada',
    '# Conectar: adb devices',
    '# ============================================',
    '',
    'echo "Iniciando optimizacion de Android..."',
    '',
    '# 1. Acelerar respuesta tactil (reducir retraso de entrada)',
    'echo "[1/6] Ajustando velocidad tactil..."',
    'adb shell settings put secure pointer_speed 1.0',
    'adb shell settings put system window_animation_scale 0.5',
    'adb shell settings put system transition_animation_scale 0.5',
    'adb shell settings put system animator_duration_scale 0.5',
    'echo "  Animaciones reducidas. Respuesta tactil mejorada."',
    '',
    '# 2. Limpiar cache de aplicaciones',
    'echo "[2/6] Limpiando cache de aplicaciones..."',
    'adb shell pm trim-caches 999999999999 2>/dev/null || true',
    'echo "  Cache de aplicaciones limpiada."',
    '',
    '# 3. Congelar bloatware comun (sin desinstalar, solo desactivar)',
    'echo "[3/6] Congelando bloatware innecesario..."',
    'BLOATWARE="com.android.dreams.phototable com.google.android.apps.books com.google.android.apps.movies com.google.android.music"',
    'for pkg in $BLOATWARE; do',
    '  adb shell pm disable-user --user 0 "$pkg" 2>/dev/null && echo "  $pkg desactivado."',
    'done',
    '',
    '# 4. Limpiar carpeta de descargas obsoletas (archivos > 30 dias)',
    'echo "[4/6] Limpiando descargas antiguas..."',
    'adb shell find /sdcard/Download -type f -mtime +30 -delete 2>/dev/null || true',
    'echo "  Descargas antiguas eliminadas."',
    '',
    '# 5. Forzar recoleccion de garbage collector',
    'echo "[5/6] Optimizando memoria..."',
    'adb shell pgrep -f zygote | head -1 | xargs -I{} adb shell kill -10 {} 2>/dev/null || true',
    'echo "  GC forzado."',
    '',
    '# 6. Mostrar estado final',
    'echo "[6/6] Estado del dispositivo:"',
    'adb shell dumpsys meminfo | head -20',
    'echo ""',
    'echo "Optimizacion completada. Reinicia el dispositivo para cambios completos."',
  ].join('\n');

  return {
    platform: 'android',
    language: 'bash',
    filename: 'optimizar_android.sh',
    code,
    description: 'Script ADB para Android que mejora la velocidad tactil, reduce animaciones, limpia cache, congela bloatware y optimiza memoria.',
    steps: [
      'Ajusta la velocidad de respuesta tactil y reduce las escalas de animacion al 50%',
      'Limpia el cache de todas las aplicaciones con pm trim-caches',
      'Congela bloatware comun (fondos animados, apps de Google no esenciales) sin desinstalarlas',
      'Elimina archivos de descarga con mas de 30 dias de antiguedad',
      'Fuerza la recoleccion de garbage collector para liberar memoria',
      'Muestra un reporte de memoria del dispositivo tras la optimizacion',
    ],
  };
}
