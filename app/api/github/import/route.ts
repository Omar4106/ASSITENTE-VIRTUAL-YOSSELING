import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_FILES = 120;
const MAX_FILE_BYTES = 48_000;
const MAX_TOTAL_BYTES = 2_500_000;
const TEXT_EXTENSIONS = new Set([
  'c', 'cc', 'cpp', 'css', 'csv', 'go', 'html', 'java', 'js', 'json', 'jsx',
  'md', 'mjs', 'py', 'rs', 'sh', 'sql', 'svg', 'toml', 'ts', 'tsx', 'txt',
  'xml', 'yaml', 'yml',
]);
const SKIP_PATH = /(^|\/)(\.git|node_modules|vendor|dist|build|coverage|\.next)(\/|$)/i;
const SECRET_PATH = /(^|\/)\.env(?:\.|$)|(^|\/)(?:id_rsa|id_ed25519|credentials|secrets?)(?:\.|$)|\.(?:pem|p12|pfx|key)$/i;

type GitTreeItem = {
  path: string;
  type: string;
  sha: string;
  size?: number;
};

async function githubFetch(path: string, token?: string) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Yosseling-Workspace',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`https://api.github.com${path}`, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
}

function isSafeTextFile(file: GitTreeItem) {
  const path = file.path.replace(/\\/g, '/');
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const basename = path.split('/').pop()?.toLowerCase() ?? '';
  return file.type === 'blob'
    && !path.startsWith('/')
    && !path.split('/').some((part) => part === '.' || part === '..')
    && !SKIP_PATH.test(path)
    && !SECRET_PATH.test(path)
    && (TEXT_EXTENSIONS.has(extension) || ['dockerfile', 'makefile', 'requirements.txt', 'readme', 'license', 'contributing', 'changelog'].includes(basename))
    && (file.size ?? 0) <= MAX_FILE_BYTES;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: unknown; token?: unknown };
    if (typeof body.url !== 'string' || body.url.length > 500) {
      return NextResponse.json({ error: 'Introduce una URL válida de un repositorio público de GitHub.' }, { status: 400 });
    }

    let url: URL;
    try {
      url = new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'La URL del repositorio no es válida.' }, { status: 400 });
    }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password) {
      return NextResponse.json({ error: 'Solo se permiten URLs HTTPS de github.com.' }, { status: 400 });
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) {
      return NextResponse.json({ error: 'Usa una URL con el formato https://github.com/propietario/repositorio.' }, { status: 400 });
    }
    const [owner, repositoryWithSuffix] = parts;
    const repository = repositoryWithSuffix.replace(/\.git$/i, '');
    if (!/^[\w.-]{1,100}$/.test(owner) || !/^[\w.-]{1,100}$/.test(repository)) {
      return NextResponse.json({ error: 'El propietario o nombre del repositorio no es válido.' }, { status: 400 });
    }

    const token = typeof body.token === 'string' && body.token.length <= 4096 ? body.token : undefined;
    const repoResponse = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`, token);
    if (!repoResponse.ok) {
      return NextResponse.json(
        { error: repoResponse.status === 404 ? 'Repositorio inexistente, privado o sin acceso.' : `GitHub respondió ${repoResponse.status}.` },
        { status: repoResponse.status === 404 ? 404 : 502 },
      );
    }
    const repo = await repoResponse.json() as { default_branch: string; full_name: string };
    const treeResponse = await githubFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
      token,
    );
    if (!treeResponse.ok) {
      return NextResponse.json({ error: `No se pudo leer el árbol del repositorio (${treeResponse.status}).` }, { status: 502 });
    }

    const tree = await treeResponse.json() as { truncated?: boolean; tree?: GitTreeItem[] };
    if (tree.truncated) {
      return NextResponse.json({ error: 'El repositorio es demasiado grande para importarlo de una sola vez. Reduce su tamaño o importa archivos específicos.' }, { status: 413 });
    }
    const refResponse = await githubFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`,
      token,
    );
    if (!refResponse.ok) {
      return NextResponse.json({ error: `No se pudo obtener la referencia de la rama (${refResponse.status}).` }, { status: 502 });
    }
    const ref = await refResponse.json() as { object?: { sha?: string } };
    const files = (tree.tree ?? []).filter(isSafeTextFile);
    if (!files.length) {
      return NextResponse.json({ error: 'No se encontraron archivos de texto compatibles para importar.' }, { status: 422 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `El repositorio contiene más de ${MAX_FILES} archivos de texto. Limita la importación antes de continuar.` }, { status: 413 });
    }

    const selected = [...files].sort((a, b) => {
      const priority = (path: string) => /^(README\.md|package\.json|requirements\.txt|index\.html|src\/)/i.test(path) ? 0 : 1;
      return priority(a.path) - priority(b.path) || a.path.localeCompare(b.path);
    });
    let totalBytes = 0;
    const importedFiles: Array<{ path: string; content: string; sha: string }> = [];
    for (let index = 0; index < selected.length; index += 8) {
      const batch = selected.slice(index, index + 8);
      const decoded = await Promise.all(batch.map(async (file) => {
        const response = await githubFetch(
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/blobs/${encodeURIComponent(file.sha)}`,
          token,
        );
        if (!response.ok) throw new Error(`No se pudo leer ${file.path} desde GitHub (${response.status}).`);
        const blob = await response.json() as { encoding?: string; content?: string };
        if (blob.encoding !== 'base64' || typeof blob.content !== 'string') {
          throw new Error(`GitHub devolvió un formato inesperado para ${file.path}.`);
        }
        const content = Buffer.from(blob.content.replace(/\s/g, ''), 'base64').toString('utf8');
        if (content.includes('\u0000')) return null;
        return { path: file.path, content, sha: file.sha };
      }));

      for (const file of decoded) {
        if (!file) continue;
        totalBytes += Buffer.byteLength(file.content, 'utf8');
        if (totalBytes > MAX_TOTAL_BYTES) {
          return NextResponse.json({ error: 'El contenido del repositorio supera el límite seguro de 2.5 MB.' }, { status: 413 });
        }
        importedFiles.push(file);
      }
    }

    return NextResponse.json({
      repository: repo.full_name,
      branch: repo.default_branch,
      headSha: ref.object?.sha,
      files: importedFiles,
      manifests: importedFiles.filter((file) => /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|Cargo\.toml|go\.mod)$/i.test(file.path)).map((file) => file.path),
      dependencyExecution: 'disabled',
    });
  } catch (error) {
    console.error('[GitHub import] Repository import failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo importar el repositorio.' }, { status: 500 });
  }
}
