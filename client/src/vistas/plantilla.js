export function renderizarPagina(titulo, cuerpoHtml, usuario) {
  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${titulo}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        /* --- Tema Oscuro (Default) --- */
        body { background-color: #0f172a; color: #e2e8f0; }
        .navbar { background: #111827; border-color: #1f2937; }
        .card { background: #111827; border-color: #1f2937; }
        .muted { color: #94a3b8; }
        a { text-decoration: none; }
        .form-control { 
          background-color: #1f2937; 
          border-color: #374151;
          color: #e2e8f0;
        }
        .form-control:focus {
          background-color: #1f2937;
          border-color: #4f46e5;
          color: #e2e8f0;
          box-shadow: 0 0 0 0.25rem rgba(79, 70, 229, 0.25);
        }

        /* --- Tema Claro (Opcional) --- */
        html.light-theme body { background-color: #f8f9fa; color: #212529; }
        html.light-theme .navbar { background: #ffffff; border-bottom: 1px solid #dee2e6; }
        html.light-theme .navbar-dark .navbar-brand { color: #212529; }
        html.light-theme .navbar-dark .muted { color: #6c757d; }
        html.light-theme .card { background: #ffffff; border-color: #dee2e6; }
        html.light-theme .muted { color: #6c757d; }
        html.light-theme a:not(.btn) { text-decoration: none; }
        html.light-theme .form-control {
          background-color: #fff;
          border-color: #ced4da;
          color: #212529;
        }
        html.light-theme .form-control:focus {
          background-color: #fff;
          border-color: #86b7fe;
          color: #212529;
          box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
        }
      </style>
      
      <script>
        (function() {
          var theme = localStorage.getItem('sso-theme');
          if (theme === 'light') {
            document.documentElement.classList.add('light-theme');
          }
        })();
      </script>

    </head>
    <body>
      <nav class="navbar navbar-expand-md navbar-dark mb-4">
        <div class="container">
          <a class="navbar-brand" href="/">Demo SSO Client</a>
          <div class="ms-auto d-flex align-items-center gap-2">
            <a class="btn btn-sm btn-outline-light" href="/">Inicio</a>
            <a class="btn btn-sm btn-primary" href="/dashboard">Dashboard</a>
            <a class="btn btn-sm btn-outline-info" href="/settings">Config</a>
            ${usuario ? `
              <span class=\"d-none d-md-inline muted\">${(usuario.email ? usuario.email : usuario.name || 'Usuario')}</span>
              <a class=\"btn btn-sm btn-outline-danger\" href=\"/logout\">Cerrar sesión</a>
            ` : `
              <a class=\"btn btn-sm btn-success\" href=\"/login\">Login</a>
            `}
          </div>
        </div>
      </nav>
      <main class="container">${cuerpoHtml}</main>
    </body>
  </html>`;
}