import express from 'express';
import crypto from 'crypto';
import { URL_IDP } from './configuracion.js';
import { renderizarPagina } from './vistas/plantilla.js';
import { decodificarJwt, escaparHtml } from './servicios/jwtServicio.js';
import { exigirAutenticacionPagina, exigirAutenticacionApi, establecerNoCache } from './middlewares/autenticacion.js';

const rutas = express.Router();

// Inicio
rutas.get('/', (req, res) => {
  const autenticado = Boolean(req.session.token_acceso);
  const payload = autenticado ? decodificarJwt(req.session.token_acceso) : null;
  const nombre = payload?.name ? escaparHtml(payload.name) : 'Usuario';

  // Usaremos un diseño de tarjeta (card) de Bootstrap para ambas vistas
  const cuerpo = `
    <div class="row">
      <div class="col-md-8 col-lg-6 mx-auto">
        <div class="card shadow-sm">
          <div class="card-body text-center p-4 p-md-5">
            ${autenticado
              ? `
                <h1 class="mb-3">Bienvenido, ${nombre}</h1>
                <p class="fs-5 muted">Tu sesión está activa.</p>
                <div class="d-flex gap-2 justify-content-center">
                  <a class="btn btn-primary" href="/dashboard">Ir al dashboard</a>
                  <a class="btn btn-outline-danger" href="/logout">Cerrar sesión</a>
                </div>
              `
              : `
                <h1 class="mb-3">Demo SSO Client</h1>
                <p class="fs-5 muted">Inicia sesión para continuar</p>
                <a class="btn btn-primary btn-lg" href="/login">Login con IdP</a>
              `
            }
          </div>
        </div>
      </div>
    </div>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(renderizarPagina('Inicio', cuerpo, payload ? { name: payload.name, email: payload.email } : null));
});

// Iniciar login contra IdP
rutas.get('/login', (req, res) => {
  const estado = crypto.randomBytes(8).toString('hex');
  if (!Array.isArray(req.session.estados)) req.session.estados = [];
  req.session.estados.push(estado);
  const authorize = new URL(`${URL_IDP}/authorize`);
  authorize.searchParams.set('client_id', 'demo');
  const redireccion = `${req.protocol}://${req.get('host')}/callback`;
  authorize.searchParams.set('redirect_uri', redireccion);
  authorize.searchParams.set('state', estado);
  req.session.save(() => res.redirect(authorize.toString()));
});

// Callback del IdP con authorization code
rutas.get('/callback', async (req, res) => {
  const { code: codigo, state: estado } = req.query;
  const estados = Array.isArray(req.session.estados) ? req.session.estados : [];
  const idx = estados.indexOf(estado);
  if (!codigo || idx === -1) {
    return res
      .status(400)
      .send(
        renderizarPagina(
          'Error de autenticación',
          `<div class="alert alert-danger">State inválido o falta code</div>
           <p class="muted">Recibido state=<code>${estado}</code>, conocidos=<code>${estados.join(',')}</code>, code=<code>${codigo || 'null'}</code></p>
           <a class="btn btn-primary" href="/login">Volver a iniciar sesión</a>`
        )
      );
  }
  // Consumir el state usado
  estados.splice(idx, 1);
  req.session.estados = estados;

  const resp = await fetch(`${URL_IDP}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: codigo })
  });
  const datos = await resp.json();
  if (!datos.access_token) {
    return res.status(400).send(renderizarPagina('Error', `<div class="alert alert-danger">No se recibió token</div>`));
  }
  req.session.token_acceso = datos.access_token;
  res.redirect('/dashboard');
});

// Dashboard protegido (MODIFICADO para GUI)
rutas.get('/dashboard', exigirAutenticacionPagina, (req, res) => {
  const token = req.session.token_acceso;
  const payload = decodificarJwt(token);
  const expTs = payload?.exp ? payload.exp * 1000 : null;
  const nombre = payload?.name || 'Usuario';
  const correo = payload?.email || '';

  res.set('Content-Type', 'text/html; charset=utf-8');
  establecerNoCache(res);
  res.send(
    renderizarPagina(
      'Dashboard',
      `
      <div class="row">
        <div class="col-lg-10 mx-auto">
          <div class="d-flex align-items-center mb-4">
            <div class="me-3" style="width:48px;height:48px;border-radius:8px;background:#1f2937;display:flex;align-items:center;justify-content:center;font-weight:700;">${(nombre||'U').slice(0,1)}</div>
            <div>
              <h2 class="mb-0">Hola, ${escaparHtml(nombre)}</h2>
              <div class="muted">${escaparHtml(correo)}</div>
            </div>
            <div class="ms-auto text-end">
              <div class="muted">Expira en:</div>
              <div id="expCountdown" class="fw-bold">calculando…</div>
            </div>
          </div>

          <div class="row g-3">
            
            <div class="col-md-6 col-lg-4">
              <div class="card shadow-sm h-100">
                <div class="card-body">
                  <h5 class="card-title">Acciones</h5>
                  <p class="card-text muted">Accede a tu perfil o cierra sesión.</p>
                  <div class="d-flex gap-2">
                    <a class="btn btn-primary" href="/me">Ver perfil</a>
                    <a class="btn btn-outline-danger" href="/logout">Cerrar sesión</a>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="col-md-6 col-lg-4">
              <div class="card shadow-sm h-100">
                <div class="card-body">
                  <h5 class="card-title">Configuración</h5>
                  <p class="card-text muted">Ajusta tus preferencias de visualización.</p>
                  <div class="d-flex gap-2">
                    <a class="btn btn-outline-info" href="/settings">Ir a Configuración</a>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-md-6 col-lg-4">
              <div class="card shadow-sm h-100">
                <div class="card-body">
                  <h5 class="card-title">Token</h5>
                  <p class="card-text muted">Tu token de acceso (JWT) actual.</p>
                  <details>
                    <summary>Mostrar token</summary>
<pre class="mb-0"><code>${escaparHtml(token)}</code></pre>
                  </details>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <script>
        (function(){
          const exp = ${expTs ?? 'null'};
          const el = document.getElementById('expCountdown');
          function tick(){
            if(!exp){ el.textContent = 'desconocido'; return; }
            const ms = exp - Date.now();
            if (ms <= 0) { el.textContent = 'expirado'; return; }
            const s = Math.floor(ms/1000);
            const m = Math.floor(s/60);
            const r = s % 60;
            el.textContent = m + 'm ' + r + 's';
            requestAnimationFrame(tick);
          }
          tick();
        })();
      </script>`
    , { name: nombre, email: correo })
  );
});

// Perfil protegido
rutas.get('/me', exigirAutenticacionPagina, (req, res) => {
  const payload = decodificarJwt(req.session.token_acceso);
  res.set('Content-Type', 'text/html; charset=utf-8');
  establecerNoCache(res);
  res.send(
    renderizarPagina(
      'Perfil',
      `
      <div class="row">
        <div class="col-lg-8 mx-auto">
          <div class="card shadow-sm">
            <div class="card-body">
              <h3 class="card-title mb-3">Perfil (claims del token)</h3>
              <pre class="mb-0"><code>${escaparHtml(JSON.stringify(payload, null, 2))}</code></pre>
            </div>
          </div>
          <div class="mt-3 d-flex gap-2">
            <a class="btn btn-primary" href="/dashboard">Volver al dashboard</a>
            <a class="btn btn-outline-danger" href="/logout">Cerrar sesión</a>
          </div>
        </div>
      </div>`
    , { name: payload?.name || 'Usuario', email: payload?.email || '' })
  );
});

// Página de Configuración
rutas.get('/settings', exigirAutenticacionPagina, (req, res) => {
  const payload = decodificarJwt(req.session.token_acceso);
  res.set('Content-Type', 'text/html; charset=utf-8');
  establecerNoCache(res);
  res.send(
    renderizarPagina(
      'Configuración',
      `
      <div class="row">
        <div class="col-lg-8 mx-auto">
          <div class="card shadow-sm">
            <div class="card-body">
              <h3 class="card-title mb-3">Configuración de la Cuenta</h3>
              <p class="muted">Hola, ${escaparHtml(payload?.name || 'Usuario')}.</p>
              
              <div class="mb-3">
                <label class="form-label">Tema</label>
                <p class="muted small">Elige tu preferencia visual (claro u oscuro).</p>
                <button id="btn-theme-toggle" class="btn btn-primary">Cargando...</button>
              </div>

            </div>
          </div>
          <div class="mt-3 d-flex gap-2">
            <a class="btn btn-primary" href="/dashboard">Volver al dashboard</a>
          </div>
        </div>
      </div>
      
      <script>
        (function() {
          var btn = document.getElementById('btn-theme-toggle');
          var htmlEl = document.documentElement;

          function updateButtonText() {
            if (htmlEl.classList.contains('light-theme')) {
              btn.textContent = 'Cambiar a Tema Oscuro';
            } else {
              btn.textContent = 'Cambiar a Tema Claro';
            }
          }

          // Set initial button text on load
          updateButtonText();

          // Add click listener
          btn.addEventListener('click', function() {
            if (htmlEl.classList.contains('light-theme')) {
              // Switch to dark
              htmlEl.classList.remove('light-theme');
              localStorage.setItem('sso-theme', 'dark');
            } else {
              // Switch to light
              htmlEl.classList.add('light-theme');
              localStorage.setItem('sso-theme', 'light');
            }
            // Update text after click
            updateButtonText();
          });
        })();
      </script>
      `
    , { name: payload?.name || 'Usuario', email: payload?.email || '' })
  );
});


// Cerrar sesión local y en el IdP
rutas.get('/logout', (req, res) => {
  const idpLogout = `${URL_IDP}/logout`;
  req.session.destroy(() => {
    res.clearCookie('cliente.sid');
    res.redirect(idpLogout);
  });
});

// API protegida de perfil
rutas.get('/api/perfil', exigirAutenticacionApi, (req, res) => {
  const payload = decodificarJwt(req.session.token_acceso);
  res.json(payload);
});

export default rutas;