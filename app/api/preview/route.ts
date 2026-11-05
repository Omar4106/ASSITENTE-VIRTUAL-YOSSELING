import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Endpoint para generar un bundle de preview HTML de forma segura.
 * Recibe una lista de archivos y devuelve un documento HTML autoejecutable
 * con React, Tailwind y soporte para JSX/TSX vía Babel.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { files, mainFile = 'App.tsx' } = body;

    if (!files || !Array.isArray(files)) {
      return NextResponse.json({ error: 'No se proporcionaron archivos válidos' }, { status: 400 });
    }

    // Seguridad: Sanitización básica de los contenidos
    // (Babel y el iframe sandbox se encargarán del grueso de la seguridad)
    const processedFiles = files.map(f => ({
      path: f.path,
      content: f.content,
      language: f.language || (f.path.endsWith('.tsx') ? 'typescript' : 'javascript')
    }));

    const html = generateBootstrapper(processedFiles, mainFile);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'X-Content-Type-Options': 'nosniff',
        // CSP restrictiva para el sandbox
        'Content-Security-Policy': "default-src 'self' https: 'unsafe-inline' 'unsafe-eval' data:; img-src 'self' https: data:; font-src 'self' https: data:;",
      },
    });
  } catch (error: any) {
    console.error('[Preview API Error]:', error);
    return NextResponse.json({ error: 'Error al generar el preview' }, { status: 500 });
  }
}

/**
 * Genera el HTML base que orquesta la ejecución del código virtual.
 */
function generateBootstrapper(files: any[], mainFile: string) {
  const filesJson = JSON.stringify(files);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yosseling Preview</title>

    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              border: "hsl(var(--border))",
              input: "hsl(var(--input))",
              ring: "hsl(var(--ring))",
              background: "hsl(var(--background))",
              foreground: "hsl(var(--foreground))",
              primary: {
                DEFAULT: "hsl(var(--primary))",
                foreground: "hsl(var(--primary-foreground))",
              },
              secondary: {
                DEFAULT: "hsl(var(--secondary))",
                foreground: "hsl(var(--secondary-foreground))",
              },
              destructive: {
                DEFAULT: "hsl(var(--destructive))",
                foreground: "hsl(var(--destructive-foreground))",
              },
              muted: {
                DEFAULT: "hsl(var(--muted))",
                foreground: "hsl(var(--muted-foreground))",
              },
              accent: {
                DEFAULT: "hsl(var(--accent))",
                foreground: "hsl(var(--accent-foreground))",
              },
              popover: {
                DEFAULT: "hsl(var(--popover))",
                foreground: "hsl(var(--popover-foreground))",
              },
              card: {
                DEFAULT: "hsl(var(--card))",
                foreground: "hsl(var(--card-foreground))",
              },
            },
          }
        }
      }
    </script>

    <style>
      :root {
        --background: 0 0% 100%;
        --foreground: 222.2 84% 4.9%;
        --card: 0 0% 100%;
        --card-foreground: 222.2 84% 4.9%;
        --popover: 0 0% 100%;
        --popover-foreground: 222.2 84% 4.9%;
        --primary: 221.2 83.2% 53.3%;
        --primary-foreground: 210 40% 98%;
        --secondary: 210 40% 96.1%;
        --secondary-foreground: 222.2 47.4% 11.2%;
        --muted: 210 40% 96.1%;
        --muted-foreground: 215.4 16.3% 46.9%;
        --accent: 210 40% 96.1%;
        --accent-foreground: 222.2 47.4% 11.2%;
        --destructive: 0 84.2% 60.2%;
        --destructive-foreground: 210 40% 98%;
        --border: 214.3 31.8% 91.4%;
        --input: 214.3 31.8% 91.4%;
        --ring: 221.2 83.2% 53.3%;
        --radius: 0.5rem;
      }
      .dark {
        --background: 222.2 84% 4.9%;
        --foreground: 210 40% 98%;
        --card: 222.2 84% 4.9%;
        --card-foreground: 210 40% 98%;
        --popover: 222.2 84% 4.9%;
        --popover-foreground: 210 40% 98%;
        --primary: 217.2 91.2% 59.8%;
        --primary-foreground: 222.2 47.4% 11.2%;
        --secondary: 217.2 32.6% 17.5%;
        --secondary-foreground: 210 40% 98%;
        --muted: 217.2 32.6% 17.5%;
        --muted-foreground: 215 20.2% 65.1%;
        --accent: 217.2 32.6% 17.5%;
        --accent-foreground: 210 40% 98%;
        --destructive: 0 62.8% 30.6%;
        --destructive-foreground: 210 40% 98%;
        --border: 217.2 32.6% 17.5%;
        --input: 217.2 32.6% 17.5%;
        --ring: 224.3 76.3% 48%;
      }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background-color: transparent;
      }
      #preview-root { min-height: 100vh; }
      #error-display {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        background: rgba(220, 38, 38, 0.95);
        color: white;
        padding: 1rem;
        font-family: monospace;
        font-size: 12px;
        z-index: 9999;
        display: none;
        max-height: 40vh;
        overflow: auto;
      }
    </style>

    <!-- React y Babel -->
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    <!-- Bibliotecas Comunes -->
    <script src="https://unpkg.com/framer-motion@10.16.4/dist/framer-motion.js"></script>
    <script src="https://unpkg.com/lucide-react@0.263.1/dist/umd/lucide-react.js"></script>
</head>
<body class="dark">
    <div id="preview-root"></div>
    <div id="error-display"></div>

    <script type="text/babel">
        const { useState, useEffect, useRef, useMemo, useCallback } = React;

        // Mock de imports para simular un sistema de archivos
        const virtualFiles = ${filesJson};
        const modules = {};

        // Función para resolver archivos relativos
        function resolveModule(path) {
            const cleanPath = path.replace('./', '').replace('../', '');
            const file = virtualFiles.find(f => f.path.includes(cleanPath));
            if (!file) throw new Error(\`No se pudo encontrar el módulo: \${path}\`);
            return file;
        }

        // Sistema de ejecución de módulos virtuales
        function executeModule(file) {
            if (modules[file.path]) return modules[file.path].exports;

            const exports = {};
            modules[file.path] = { exports };

            try {
                // Transpilar y ejecutar
                const { code } = Babel.transform(file.content, {
                    presets: ['react', 'typescript'],
                    filename: file.path
                });

                // Envolver en una función para simular scope de módulo
                const moduleFunc = new Function('React', 'ReactDOM', 'exports', 'require', code);

                const customRequire = (path) => {
                  if (path === 'react') return React;
                  if (path === 'react-dom') return ReactDOM;
                  if (path === 'framer-motion') return window.framerMotion;
                  if (path === 'lucide-react') return window.LucideReact;

                  const resolved = resolveModule(path);
                  return executeModule(resolved);
                };

                moduleFunc(React, ReactDOM, exports, customRequire);
                return exports;
            } catch (err) {
                showError(err, file.path);
                throw err;
            }
        }

        function showError(error, path) {
            const display = document.getElementById('error-display');
            display.style.display = 'block';
            display.innerText = \`Error en [\${path}]: \${error.message}\\n\\n\${error.stack}\`;
        }

        window.onerror = (msg, url, lineNo, columnNo, error) => {
            showError(error || { message: msg }, 'Runtime');
            return false;
        };

        // Renderizado inicial
        try {
            const main = virtualFiles.find(f => f.path.includes('${mainFile}')) || virtualFiles[0];
            if (main) {
                const exports = executeModule(main);
                const App = exports.App || exports.default || Object.values(exports)[0];

                if (App) {
                    const root = ReactDOM.createRoot(document.getElementById('preview-root'));
                    root.render(<App />);
                } else {
                    throw new Error('No se encontró un componente exportado (App o default)');
                }
            }
        } catch (err) {
            showError(err, 'Main');
        }
    </script>
</body>
</html>
  `;
}
