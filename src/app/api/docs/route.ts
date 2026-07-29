import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { isSwaggerEnabled } from '@/lib/swagger';

export const runtime = 'nodejs';

async function loadSwaggerAsset(filename: 'swagger-ui.css' | 'swagger-ui-bundle.js') {
  const assetPath = join(process.cwd(), 'node_modules', 'swagger-ui-react', filename);
  return readFile(assetPath, 'utf8');
}

const swaggerDarkTheme = `
  :root {
    color-scheme: dark;
    --bg: #111827;
    --panel: #111827;
    --panel-2: #1f2937;
    --border: #334155;
    --text: #e5eefb;
    --text-2: #cbd5e1;
    --accent: #7dd3fc;
    --accent-2: #38bdf8;
    --success: #86efac;
    --danger: #fca5a5;
  }

  html, body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
  }

  body, .swagger-ui, .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .opblock-description-wrapper p, .swagger-ui .opblock-external-docs-wrapper p, .swagger-ui .opblock-title_normal p, .swagger-ui table thead tr td, .swagger-ui table thead tr th, .swagger-ui .response-col_status, .swagger-ui .response-col_links, .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5, .swagger-ui .tab li button.tablinks, .swagger-ui label, .swagger-ui .parameter__name, .swagger-ui .parameter__type, .swagger-ui .parameter__deprecated, .swagger-ui .parameter__in, .swagger-ui .opblock-summary-path {
    color: var(--text);
  }

  // .swagger-ui {
  //   background:
  //     // radial-gradient(circle at top, rgba(56, 189, 248, 0.12), transparent 28%),
  //     // linear-gradient(180deg, #0f172a, var(--bg));
  // }

  .swagger-ui .wrapper {
    background: transparent !important;
  }

  .swagger-ui .information-container,
  .swagger-ui .scheme-container {
    background: var(--panel) !important;
  }

  .swagger-ui .info,
  .swagger-ui .info .title {
    background: transparent !important;
  }

  .swagger-ui .topbar {
    display: none;
  }

  .swagger-ui .scheme-container,
  .swagger-ui .information-container,
  .swagger-ui .opblock,
  .swagger-ui .responses-wrapper,
  .swagger-ui .model-box,
  .swagger-ui section.models,
  .swagger-ui .dialog-ux .modal-ux,
  .swagger-ui .auth-wrapper {
    background: var(--panel);
    box-shadow: none;
    border-color: var(--border);
  }

  .swagger-ui .info .title,
  .swagger-ui .opblock-tag,
  .swagger-ui .opblock .opblock-summary-method,
  .swagger-ui .btn,
  .swagger-ui select,
  .swagger-ui input,
  .swagger-ui textarea {
    color: var(--text);
  }

  .swagger-ui .info .title small,
  .swagger-ui .info a,
  .swagger-ui .renderedMarkdown a,
  .swagger-ui a.nostyle {
    color: var(--accent);
  }

  .swagger-ui .opblock-summary-description,
  .swagger-ui .info p,
  .swagger-ui .info li,
  .swagger-ui .parameter__deprecated,
  .swagger-ui .response-col_description,
  .swagger-ui .responses-inner p,
  .swagger-ui .renderedMarkdown p {
    color: var(--text-2) !important;
  }

  .swagger-ui .info .title small {
    background: #0f172a;
    border-color: var(--border);
    box-shadow: none !important;
    text-shadow: none !important;
  }

  .swagger-ui .info .title small pre,
  .swagger-ui .info .title small version-stamp {
    background: transparent !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }

  .swagger-ui .info .base-url {
    color: var(--accent);
  }

  .swagger-ui .scheme-container .schemes {
    background: transparent !important;
  }

  .swagger-ui .scheme-container .wrapper,
  .swagger-ui .information-container .wrapper {
    background: transparent !important;
  }

  .swagger-ui .opblock-tag {
    border-bottom-color: var(--border);
  }

  .swagger-ui .opblock {
    border-width: 1px;
  }

  .swagger-ui .opblock .opblock-section-header,
  .swagger-ui .opblock .opblock-summary,
  .swagger-ui table tbody tr td,
  .swagger-ui .responses-table tbody tr td {
    background: var(--panel);
    border-color: var(--border);
  }

  .swagger-ui .opblock.opblock-get {
    background: rgba(14, 165, 233, 0.12);
    border-color: rgba(56, 189, 248, 0.5);
  }

  .swagger-ui .opblock.opblock-post {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(134, 239, 172, 0.55);
  }

  .swagger-ui .opblock.opblock-put,
  .swagger-ui .opblock.opblock-patch {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(252, 211, 77, 0.55);
  }

  .swagger-ui .opblock.opblock-delete {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(252, 165, 165, 0.55);
  }

  .swagger-ui .opblock.opblock-get .opblock-summary-method {
    background: #0369a1;
  }

  .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #15803d;
  }

  .swagger-ui .opblock.opblock-put .opblock-summary-method,
  .swagger-ui .opblock.opblock-patch .opblock-summary-method {
    background: #b45309;
  }

  .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background: #b91c1c;
  }

  .swagger-ui .btn,
  .swagger-ui select,
  .swagger-ui input,
  .swagger-ui textarea {
    background: var(--panel-2);
    border-color: var(--border);
  }

  .swagger-ui input,
  .swagger-ui textarea,
  .swagger-ui select,
  .swagger-ui .parameters input,
  .swagger-ui .parameters textarea,
  .swagger-ui .parameter__extension input {
    color: #0f172a !important;
    -webkit-text-fill-color: #0f172a !important;
  }

  .swagger-ui input::placeholder,
  .swagger-ui textarea::placeholder {
    color: #64748b !important;
    opacity: 1;
  }

  .swagger-ui .btn.authorize {
    background: var(--accent-2);
    border-color: var(--accent-2);
    color: #082f49;
  }

  .swagger-ui .btn.execute {
    background: var(--success);
    border-color: var(--success);
    color: #052e16;
  }

  .swagger-ui .btn.cancel {
    background: var(--danger);
    border-color: var(--danger);
    color: #450a0a;
  }

  .swagger-ui .dialog-ux .modal-ux-header h3,
  .swagger-ui .dialog-ux .modal-ux-content h4,
  .swagger-ui .dialog-ux .modal-ux-content p,
  .swagger-ui .dialog-ux .modal-ux-content label,
  .swagger-ui .auth-container .scope-def {
    color: var(--text) !important;
  }

  .swagger-ui .dialog-ux .modal-ux-content,
  .swagger-ui .dialog-ux .modal-ux-header {
    color: var(--text-2) !important;
  }

  .swagger-ui .dialog-ux .modal-ux-header .close-modal {
    color: var(--text) !important;
    opacity: 1;
  }

  .swagger-ui .dialog-ux .modal-ux-header .close-modal svg,
  .swagger-ui .authorization__btn svg,
  .swagger-ui .authorize svg {
    fill: #fff !important;
    color: #fff !important;
  }

  .swagger-ui .dialog-ux .modal-ux-content input[type=text],
  .swagger-ui .dialog-ux .modal-ux-content input[type=password] {
    background: #f8fafc !important;
    color: #0f172a !important;
    border-color: #94a3b8 !important;
  }

  .swagger-ui .dialog-ux .modal-ux-content input::placeholder {
    color: #64748b !important;
  }

  .swagger-ui .model-toggle:after,
  .swagger-ui .expand-operation svg,
  .swagger-ui .opblock-control-arrow svg,
  .swagger-ui select {
    fill: var(--text);
    color: var(--text);
  }

  .swagger-ui .highlight-code,
  .swagger-ui .microlight,
  .swagger-ui pre,
  .swagger-ui .model-example {
    background: #020617;
    color: var(--text);
  }
`;

export async function GET() {
  if (!isSwaggerEnabled) {
    return new NextResponse('Not found', { status: 404 });
  }

  const [css, bundle] = await Promise.all([
    loadSwaggerAsset('swagger-ui.css'),
    loadSwaggerAsset('swagger-ui-bundle.js'),
  ]);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Second Brain API Docs</title>
    <style>${css}</style>
    <style>${swaggerDarkTheme}</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script>${bundle}</script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: '/api/docs/spec',
          dom_id: '#swagger-ui',
          deepLinking: true,
          docExpansion: 'list',
          defaultModelsExpandDepth: 1,
        });
      };
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
