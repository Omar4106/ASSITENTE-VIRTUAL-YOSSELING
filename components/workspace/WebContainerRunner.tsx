'use client';

import { useEffect, useRef, useState } from 'react';
import type { FileSystemTree, WebContainer, WebContainerProcess } from '@webcontainer/api';
import type { WorkspaceFile } from '@/types';

let webContainerPromise: Promise<WebContainer> | null = null;

function buildFileSystemTree(files: WorkspaceFile[]): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const file of files) {
    const path = file.path.replace(/\\/g, '/');
    if (
      path.startsWith('/')
      || path.split('/').some((part) => !part || part === '.' || part === '..')
      || /(^|\/)(?:\.git|node_modules|\.env(?:\.|$)|credentials|secrets?)(?:\/|$)/i.test(path)
      || /\.(?:pem|p12|pfx|key)$/i.test(path)
    ) {
      continue;
    }

    const parts = path.split('/');
    let node = tree;
    for (const directory of parts.slice(0, -1)) {
      const current = node[directory];
      if (!current || !('directory' in current)) node[directory] = { directory: {} };
      node = (node[directory] as { directory: FileSystemTree }).directory;
    }
    node[parts[parts.length - 1]] = { file: { contents: file.content } };
  }
  return tree;
}

function appendOutput(setLogs: (update: (current: string) => string) => void, process: WebContainerProcess) {
  void (async () => {
    const reader = process.output.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) setLogs((current) => `${current}${value}`.slice(-16_000));
      }
    } finally {
      reader.releaseLock();
    }
  })();
}

export function WebContainerRunner({ files, projectName }: { files: WorkspaceFile[]; projectName: string }) {
  const containerRef = useRef<WebContainer | null>(null);
  const serverProcessRef = useRef<WebContainerProcess | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [logs, setLogs] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => {
    serverProcessRef.current?.kill();
    containerRef.current?.teardown();
    serverProcessRef.current = null;
    containerRef.current = null;
    webContainerPromise = null;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !previewUrl) return;

    let cancelled = false;
    void (async () => {
      try {
        for (const file of files) {
          const path = file.path.replace(/\\/g, '/');
          if (
            path.startsWith('/')
            || path.split('/').some((part) => !part || part === '.' || part === '..')
            || /(^|\/)(?:\.git|node_modules|\.env(?:\.|$)|credentials|secrets?)(?:\/|$)/i.test(path)
            || /\.(?:pem|p12|pfx|key)$/i.test(path)
          ) continue;

          const directories = path.split('/').slice(0, -1);
          let currentPath = '';
          for (const directory of directories) {
            currentPath = currentPath ? `${currentPath}/${directory}` : directory;
            await container.fs.mkdir(currentPath, { recursive: true });
          }
          await container.fs.writeFile(path, file.content);
        }
      } catch (reason) {
        if (cancelled) return;
        console.error('[WebContainer] Could not sync workspace edits:', reason);
        setError(reason instanceof Error ? reason.message : 'No se pudieron sincronizar los archivos editados.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [files, previewUrl]);

  const start = async () => {
    if (!consent) {
      setError('Confirma que aceptas instalar y ejecutar los scripts de este repositorio en el sandbox del navegador.');
      return;
    }
    if (!window.crossOriginIsolated) {
      setError('Este navegador o servidor no habilitó el aislamiento requerido para WebContainers.');
      return;
    }

    setBusy(true);
    setError('');
    setLogs('');
    setPreviewUrl('');
    try {
      const packageFile = files.find((file) => file.path === 'package.json');
      if (!packageFile) throw new Error('El proyecto no tiene package.json; la ejecución automática requiere un proyecto Node.js.');
      let manifest: { scripts?: Record<string, string> };
      try {
        manifest = JSON.parse(packageFile.content) as { scripts?: Record<string, string> };
      } catch {
        throw new Error('package.json no contiene JSON válido.');
      }
      const runScript = manifest.scripts?.dev ? 'dev' : manifest.scripts?.start ? 'start' : null;
      if (!runScript) throw new Error('package.json debe definir un script "dev" o "start".');

      const { WebContainer } = await import('@webcontainer/api');
      if (!webContainerPromise) {
        webContainerPromise = WebContainer.boot({ coep: 'credentialless', forwardPreviewErrors: true });
      }
      const container = await webContainerPromise;
      containerRef.current = container;
      await container.mount(buildFileSystemTree(files));

      const lockFile = files.some((file) => /(^|\/)(package-lock\.json|npm-shrinkwrap\.json)$/i.test(file.path));
      const install = await container.spawn('npm', lockFile ? ['ci'] : ['install'], { env: { CI: true } });
      appendOutput(setLogs, install);
      const installCode = await install.exit;
      if (installCode !== 0) throw new Error(`La instalación terminó con código ${installCode}. Revisa la consola antes de reintentar.`);

      let resolveReady: (url: string) => void;
      let rejectReady: (error: Error) => void;
      const ready = new Promise<string>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      const unsubscribe = container.on('server-ready', (_port, url) => resolveReady(url));
      const serverProcess = await container.spawn('npm', ['run', runScript, '--', '--host', '0.0.0.0'], { env: { CI: true } });
      serverProcessRef.current = serverProcess;
      appendOutput(setLogs, serverProcess);
      void serverProcess.exit.then((code) => {
        if (code !== 0) rejectReady(new Error(`El servidor terminó con código ${code}.`));
      });
      try {
        setPreviewUrl(await ready);
      } finally {
        unsubscribe();
      }
    } catch (reason) {
      console.error('[WebContainer] Project execution failed:', reason);
      setError(reason instanceof Error ? reason.message : 'No se pudo ejecutar el proyecto en el navegador.');
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    serverProcessRef.current?.kill();
    serverProcessRef.current = null;
    setPreviewUrl('');
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#0a0a0c]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-[#0d0d12] px-3 py-2">
        <div>
          <p className="text-[11px] font-medium text-slate-100">Entorno aislado · {projectName}</p>
          <p className="mt-0.5 text-[9px] text-slate-500">Las dependencias solo se instalan tras tu confirmación y dentro del navegador.</p>
        </div>
        <div className="flex items-center gap-2">
          {previewUrl && <button type="button" onClick={stop} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300 hover:bg-white/5">Detener</button>}
          <button type="button" onClick={() => void start()} disabled={busy || Boolean(previewUrl)} className="rounded-lg bg-purple-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-purple-500 disabled:opacity-50">
            {busy ? 'Preparando entorno…' : 'Instalar y ejecutar'}
          </button>
        </div>
      </div>

      {!previewUrl && (
        <label className="flex items-start gap-2 border-b border-white/5 px-3 py-2 text-[10px] leading-5 text-amber-100/80">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-purple-500" />
          <span>
            Acepto ejecutar <code>npm ci</code> o <code>npm install</code> y el script del proyecto. Los paquetes y scripts de instalación son código de terceros; el sandbox no debe tratarse como una garantía frente a todos los riesgos.
          </span>
        </label>
      )}

      {error && <p role="alert" className="border-b border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] text-red-200">{error}</p>}
      {previewUrl && <iframe title={`Preview de ${projectName}`} src={previewUrl} sandbox="allow-scripts allow-same-origin allow-forms" referrerPolicy="no-referrer" className="min-h-0 flex-1 border-0 bg-white" />}
      <pre aria-label="Salida del entorno" className="max-h-32 shrink-0 overflow-auto border-t border-white/5 bg-black/40 p-3 font-mono text-[9px] leading-4 text-slate-300">{logs || 'La salida de instalación y ejecución aparecerá aquí.'}</pre>
    </section>
  );
}
