import express from 'express';
import crypto from 'crypto';
import { buscarUsuarioPorEmail, guardarCodigo, consumirCodigo } from './storage.js';
import { crearTokenAcceso } from './tokenService.js';
import { URL_BASE } from './config.js';

const router = express.Router();

// Middleware para exigir sesión iniciada
function requireLoginPage(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireLoginApi(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'not_authenticated' });
  next();
}

// Página de inicio mínima del IdP
router.get('/', (req, res) => {
  const user = req.session.user;
  const userEmail = user ? String(user.email).replace(/"/g, '&quot;') : '';

  res.send(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>IdP - Inicio</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          /* Mismos estilos oscuros */
          body { background-color: #0f172a; color: #e2e8f0; }
          .card { background: #111827; border-color: #1f2937; }
          .muted { color: #94a3b8; }
          a { text-decoration: none; }
        </style>
      </head>
      <body class="d-flex align-items-center" style="min-height: 90vh;">
        <main class="container">
          <div class="row">
            <div class="col-md-6 col-lg-5 mx-auto">
              <div class="card shadow-sm">
                <div class="card-body p-4 p-md-5 text-center">
                  <h1 class="h3 mb-4">IdP Home</h1>
                  ${user ? `
                    <p class="fs-5 muted">Sesión activa como:</p>
                    <p class="fs-5"><strong>${userEmail}</strong></p>
                    <a href="/logout" class="btn btn-outline-danger w-100 mt-3">Cerrar sesión</a>
                    <p class="mt-4 mb-0">
                      <a href="/me" class="muted small">Ver perfil (JSON)</a>
                    </p>
                  ` : `
                    <p class="fs-5 muted">No has iniciado sesión.</p>
                    <a href="/login" class="btn btn-primary w-100 btn-lg mt-3">Ir al Login</a>
                  `}
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  `);
});

// Login form (GET)
router.get('/login', (req, res) => {
  const returnTo = String(req.query.returnTo || '').replace(/"/g, '&quot;');
  res.send(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>IdP - Login</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          /* Mismos estilos oscuros que el client */
          body { background-color: #0f172a; color: #e2e8f0; }
          .card { background: #111827; border-color: #1f2937; }
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
          .form-label { color: #94a3b8; }
        </style>
      </head>
      <body class="d-flex align-items-center" style="min-height: 90vh;">
        <main class="container">
          <div class="row">
            <div class="col-md-6 col-lg-4 mx-auto">
              <div class="card shadow-sm">
                <div class="card-body p-4 p-md-5">
                  <h1 class="h3 mb-4 text-center">IdP Login</h1>
                  <form method="post" action="/login">
                    <div class="mb-3">
                      <label for="email" class="form-label">Email</label>
                      <input id="email" name="email" class="form-control" placeholder="email" value="demo@lab.local" required />
                    </div>
                    <div class="mb-3">
                      <label for="pass" class="form-label">Password</label>
                      <input id="pass" name="password" type="password" class="form-control" placeholder="password" value="demo" required />
                    </div>
                    <input type="hidden" name="returnTo" value="${returnTo}"/>
                    <button class="btn btn-primary w-100 btn-lg mt-3">Entrar</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  `);
});

// Handle login (POST)
router.post('/login', (req, res) => {
  const { email, password, returnTo } = req.body;
  const user = buscarUsuarioPorEmail(email);
  if (!user || user.password !== password) return res.status(401).send('Credenciales inválidas');
  // Carga mínima en sesión
  req.session.user = { id: user.id, email: user.email, name: user.name };
  res.redirect(returnTo || '/');
});

router.get('/me', requireLoginPage, (req, res) => {
  res.send(`<pre>${JSON.stringify(req.session.user, null, 2)}</pre>`);
});

// API de usuario (solo con sesión activa)
router.get('/userinfo', requireLoginApi, (req, res) => {
  res.json(req.session.user);
});

// Logout IdP: destruye la sesión y vuelve a login
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Authorization endpoint: issue a short-lived code and redirect back to client
router.get('/authorize', (req, res) => {
  const { client_id, redirect_uri, state } = req.query;
  if (!req.session.user) {
    const returnTo = `/authorize?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${encodeURIComponent(state || '')}`;
    return res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const codigo = crypto.randomBytes(32).toString('hex');
  guardarCodigo(codigo, { user: req.session.user, client_id });
  console.log('[idp] emitiendo código para client:', client_id, 'user:', req.session.user?.email, 'state:', state);
  const url = new URL(redirect_uri);
  url.searchParams.set('code', codigo);
  if (state) url.searchParams.set('state', state);
  res.redirect(url.toString());
});

// Token endpoint: exchange code for token
router.post('/token', express.urlencoded({ extended: false }), async (req, res) => {
  const { code, grant_type } = req.body;
  if (grant_type !== 'authorization_code') return res.status(400).json({ error: 'unsupported_grant_type' });
  const data = consumirCodigo(code);
  if (!data) return res.status(400).json({ error: 'invalid_code' });

  const jwt = await crearTokenAcceso({ sub: data.user.id, name: data.user.name, email: data.user.email, aud: 'demo-client' });
  res.json({ access_token: jwt, token_type: 'Bearer', expires_in: 600 });
});

export default router;
