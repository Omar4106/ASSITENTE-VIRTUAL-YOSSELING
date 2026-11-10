import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_FILES = 120;
const MAX_FILE_BYTES = 48_000;
const MAX_TOTAL_BYTES = 2_500_000;
const SECRET_PATH = /(^|\/)\.env(?:\.|$)|(^|\/)(?:id_rsa|id_ed25519|credentials|secrets?)(?:\.|$)|\.(?:pem|p12|pfx|key)$/i;

type CommitFile = { path: string; content: string };

async function githubRequest(path: string, token: string, method = 'GET', body?: object) {
  return fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Yosseling-Workspace',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      token?: unknown;
      owner?: unknown;
      repository?: unknown;
      branch?: unknown;
      expectedHead?: unknown;
      message?: unknown;
      files?: unknown;
    };
    if (
      typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 4096
      || typeof body.owner !== 'string' || !/^[\w.-]{1,100}$/.test(body.owner)
      || typeof body.repository !== 'string' || !/^[\w.-]{1,100}$/.test(body.repository)
      || typeof body.branch !== 'string' || body.branch.length > 250 || body.branch.startsWith('-')
      || typeof body.expectedHead !== 'string' || !/^[0-9a-f]{40}$/i.test(body.expectedHead)
      || typeof body.message !== 'string' || body.message.trim().length < 1 || body.message.length > 200
      || !Array.isArray(body.files) || body.files.length < 1 || body.files.length > MAX_FILES
    ) {
      return NextResponse.json({ error: 'Los datos del commit no son válidos o exceden los límites.' }, { status: 400 });
    }

    const token = body.token;
    const owner = body.owner;
    const repository = body.repository;
    const branch = body.branch;
    const expectedHead = body.expectedHead;
    const whoami = await githubRequest('/user', token);
    if (!whoami.ok) return NextResponse.json({ error: 'La autorización de GitHub expiró. Vuelve a conectar tu cuenta.' }, { status: 401 });

    const repoResponse = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`, token);
    if (!repoResponse.ok) return NextResponse.json({ error: 'No se pudo acceder al repositorio autorizado.' }, { status: 403 });
    const repo = await repoResponse.json() as { permissions?: { push?: boolean } };
    if (repo.permissions?.push !== true) {
      return NextResponse.json({ error: 'La cuenta conectada no tiene permiso de escritura en este repositorio.' }, { status: 403 });
    }

    const refPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/ref/heads/${encodeURIComponent(branch)}`;
    const refResponse = await githubRequest(refPath, token);
    if (!refResponse.ok) return NextResponse.json({ error: `No se pudo leer la rama (${refResponse.status}).` }, { status: 502 });
    const ref = await refResponse.json() as { object?: { sha?: string } };
    if (ref.object?.sha !== expectedHead) {
      return NextResponse.json({ error: 'La rama cambió desde que se importó el proyecto. Vuelve a importar para evitar sobrescribir cambios remotos.' }, { status: 409 });
    }

    const files = body.files as CommitFile[];
    let totalBytes = 0;
    const normalizedFiles = files.map((file) => {
      if (
        !file || typeof file.path !== 'string' || typeof file.content !== 'string'
        || file.path.length > 500 || file.path.startsWith('/')
        || file.path.split(/[\\/]/).some((part) => part === '.' || part === '..')
        || file.path.split(/[\\/]/).includes('.git')
        || SECRET_PATH.test(file.path)
      ) {
        throw new Error('El commit contiene una ruta no permitida.');
      }
      const size = Buffer.byteLength(file.content, 'utf8');
      if (size > MAX_FILE_BYTES) throw new Error(`El archivo ${file.path} supera el límite de tamaño.`);
      totalBytes += size;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error('El contenido supera el límite total de 2.5 MB.');
      return { path: file.path.replace(/\\/g, '/'), content: file.content };
    });
    if (new Set(normalizedFiles.map((file) => file.path)).size !== normalizedFiles.length) {
      return NextResponse.json({ error: 'Hay rutas duplicadas en los archivos del commit.' }, { status: 400 });
    }

    const headCommitResponse = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/commits/${encodeURIComponent(expectedHead)}`,
      token,
    );
    if (!headCommitResponse.ok) return NextResponse.json({ error: 'No se pudo obtener el commit base.' }, { status: 502 });
    const headCommit = await headCommitResponse.json() as { tree?: { sha?: string } };
    if (!headCommit.tree?.sha) return NextResponse.json({ error: 'La rama no tiene un árbol Git válido.' }, { status: 502 });

    const treeEntries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
    for (const file of normalizedFiles) {
      const blobResponse = await githubRequest(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/blobs`,
        token,
        'POST',
        { content: file.content, encoding: 'utf-8' },
      );
      if (!blobResponse.ok) {
        return NextResponse.json({ error: `GitHub no aceptó ${file.path} (${blobResponse.status}).` }, { status: 502 });
      }
      const blob = await blobResponse.json() as { sha?: string };
      if (!blob.sha) return NextResponse.json({ error: `GitHub no devolvió el hash de ${file.path}.` }, { status: 502 });
      treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const treeResponse = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/trees`,
      token,
      'POST',
      { base_tree: headCommit.tree.sha, tree: treeEntries },
    );
    if (!treeResponse.ok) return NextResponse.json({ error: `No se pudo crear el árbol del commit (${treeResponse.status}).` }, { status: 502 });
    const tree = await treeResponse.json() as { sha?: string };
    if (!tree.sha) return NextResponse.json({ error: 'GitHub no devolvió el árbol creado.' }, { status: 502 });

    const commitResponse = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/commits`,
      token,
      'POST',
      { message: body.message.trim(), tree: tree.sha, parents: [expectedHead] },
    );
    if (!commitResponse.ok) return NextResponse.json({ error: `No se pudo crear el commit (${commitResponse.status}).` }, { status: 502 });
    const commit = await commitResponse.json() as { sha?: string; html_url?: string };
    if (!commit.sha) return NextResponse.json({ error: 'GitHub no devolvió el commit creado.' }, { status: 502 });

    const updateResponse = await githubRequest(refPath, token, 'PATCH', { sha: commit.sha, force: false });
    if (!updateResponse.ok) {
      return NextResponse.json({ error: 'El commit fue creado, pero no se pudo actualizar la rama. Revisa el historial antes de reintentar.' }, { status: 409 });
    }
    return NextResponse.json({ sha: commit.sha, url: commit.html_url });
  } catch (error) {
    console.error('[GitHub commit] Push failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo hacer el push.' }, { status: 500 });
  }
}
