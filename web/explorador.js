(function () {
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const view = $('#view');
  if (!view) return;
const DEST = {luna_polo_sur: 'Luna · polo sur', luna_mares_tubos: 'Luna · tubos de lava', marte_jezero: 'Marte · Jezero', marte_arcadia: 'Marte · Arcadia'};
const SUELOS = {basalto: 'Basalto', lava_escoria: 'Lava o escoria', ceniza_volcanica: 'Ceniza volcánica', grava_regolito: 'Grava suelta', arcilla: 'Arcilla o marga', arena: 'Arena', yeso: 'Yeso', caliza: 'Caliza (karst)', sal: 'Sal o costra salina', granito: 'Granito', hielo_nieve: 'Hielo o nieve'};
const HUECOS = {pared_izq: 'Pared izquierda', pared_der: 'Pared derecha', techo: 'Techo', suelo: 'Rincón del suelo', alfombra: 'Alfombra'};
let ME = null;
const SIN_SERVIDOR = 'No hay conexión con el servidor de MoonSiteUA. Para registrarte e iniciar sesión, arranca el servidor (python -m uvicorn main:app desde la carpeta app) y abre http://localhost:8000/explorador.html';

async function api(path, opts = {}) {
  const init = {credentials: 'same-origin', ...opts};
  if (opts.json) { init.body = JSON.stringify(opts.json); init.headers = {'Content-Type': 'application/json'}; }
  let r;
  try { r = await fetch(path, init); }
  catch { const e = new Error(SIN_SERVIDOR); e.data = {}; throw e; }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'Algo ha fallado.'); e.data = data; e.status = r.status; throw e; }
  return data;
}
function toast(html) {
  const d = document.createElement('div'); d.innerHTML = html; $('#toast').append(d);
  setTimeout(() => d.remove(), 5000);
}
function logros(list = []) {
  for (const l of list) toast(`${Disenos.moneda(l.moneda, 22)}<span>${esc(l.titulo)}: <b>+${l.recompensa}</b> ${l.moneda === 'moon' ? 'Moon' : 'Mars'} Coins${l.ambito === 'base' ? ' para cada miembro' : ''}</span>`);
}
async function refreshMe() {
  try { ME = await api('/api/yo'); } catch { ME = null; }
  $('#tabs').hidden = $('#coins').hidden = !ME;
  if (ME) $('#coins').innerHTML = `<span class="coin" title="Moon Coins">${Disenos.moneda('moon', 24)}${ME.saldo.moon}</span><span class="coin" title="Mars Coins">${Disenos.moneda('mars', 24)}${ME.saldo.mars}</span>`;
}
function fieldErrors(form, e) {
  form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
  form.querySelectorAll('.err[data-for]').forEach((x) => (x.textContent = ''));
  const errs = e.data?.errores || (e.data?.campo ? {[e.data.campo]: e.message} : {});
  for (const [k, v] of Object.entries(errs)) {
    const inp = form.elements[k]; if (inp) inp.setAttribute('aria-invalid', 'true');
    const box = form.querySelector(`.err[data-for="${k}"]`); if (box) box.textContent = tr(v);
  }
  const g = form.querySelector('.err[data-for="_"]'); if (g) g.textContent = Object.keys(errs).length ? '' : tr(e.message);
}

// ================================================================ acceso
function vistaEntrar() {
  view.innerHTML = `<div class="hero">
    <div class="stack"><h1 style="font-size:2.2rem">Sé un <span style="color:var(--accent)">rover humano</span></h1>
      <p class="muted">Aporta fotos y datos de terrenos parecidos a la Luna y Marte desde la Demo, crea puntos nuevos y construye tu base con otros exploradores.</p>
      <div class="row">${Disenos.moneda('moon', 40)}<span class="muted">Moon Coins: por entrar cada día, registrarte y objetivos sencillos.</span></div>
      <div class="row">${Disenos.moneda('mars', 40)}<span class="muted">Mars Coins: objetivos difíciles. Se canjean por pins, parches y camisetas.</span></div></div>
    <div class="card"><form class="stack" id="fLogin" novalidate>
      <h2>Iniciar sesión</h2>
      <label>Usuario o correo<input name="usuario" id="lUser" autocomplete="username" required></label>
      <label>Contraseña<input name="password" id="lPass" type="password" autocomplete="current-password" required></label>
      <p class="err" data-for="_"></p>
      <button class="btn primary">Entrar</button>
      <p class="muted">¿No tienes cuenta? <a href="#registro">Regístrate</a></p>
    </form></div></div>`;
  $('#fLogin').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    try {
      const r = await api('/api/login', {method: 'POST', json: {usuario: f.usuario.value, password: f.password.value}});
      await refreshMe();
      if (r.moon_ganadas) toast(`${Disenos.moneda('moon', 22)}<span>Primer acceso del día: <b>+${r.moon_ganadas}</b> Moon Coins</span>`);
      location.hash = '#zonas';
    } catch (e) { fieldErrors(f, e); }
  });
}

async function vistaRegistro() {
  const regs = await api('/api/regiones');
  const paises = regs.filter((r) => r.tipo === 'pais').sort((a, b) => a.nombre.localeCompare(b.nombre));
  view.innerHTML = `<div class="card" style="max-width:640px;margin-inline:auto"><form class="stack" id="fReg" novalidate>
    <h2>Crear cuenta</h2><p class="muted">Todos los campos son obligatorios salvo la ubicación. Al registrarte ganas 100 Moon Coins.</p>
    <div class="two">
      <label>Nombre<input name="nombre" id="rNombre" autocomplete="given-name" required maxlength="60"><span class="err" data-for="nombre"></span></label>
      <label>Apellido<input name="apellido" id="rApellido" autocomplete="family-name" required maxlength="60"><span class="err" data-for="apellido"></span></label>
    </div>
    <label>Nombre de usuario<input name="username" id="rUser" autocomplete="username" required pattern="[A-Za-z0-9_.]{3,20}" maxlength="20"><span class="err" data-for="username"></span></label>
    <div class="two">
      <label>Correo electrónico<input name="email" id="rEmail" type="email" autocomplete="email" required><span class="err" data-for="email"></span></label>
      <label>Teléfono<input name="telefono" id="rTel" type="tel" autocomplete="tel" placeholder="+34 600 000 000" required><span class="err" data-for="telefono"></span></label>
    </div>
    <label>Contraseña<span class="pass"><input name="password" id="rPass" type="password" autocomplete="new-password" required minlength="9"><button type="button" id="verPass">Mostrar</button></span>
      <ul class="rules" id="rules"><li data-r="len">Al menos 9 caracteres</li><li data-r="low">Una letra minúscula</li><li data-r="up">Una letra mayúscula</li><li data-r="num">Un número</li></ul>
      <span class="err" data-for="password"></span></label>
    <div class="two">
      <label>País (opcional)<select id="rPais"><option value="">Sin indicar</option>${paises.map((p) => `<option value="${p.id}">${esc(tr(p.nombre))}</option>`).join('')}</select></label>
      <label>Provincia, estado o región (opcional)<select id="rProv" disabled><option value="">Sin indicar</option></select></label>
    </div>
    <p class="err" data-for="_"></p>
    <button class="btn primary">Crear cuenta</button>
    <p class="muted">¿Ya tienes cuenta? <a href="#entrar">Inicia sesión</a></p>
  </form></div>`;
  const f = $('#fReg');
  const reglas = {len: (v) => v.length >= 9, low: (v) => /[a-z]/.test(v), up: (v) => /[A-Z]/.test(v), num: (v) => /\d/.test(v)};
  f.password.addEventListener('input', () => $('#rules').querySelectorAll('li').forEach((li) => li.classList.toggle('ok', reglas[li.dataset.r](f.password.value))));
  $('#verPass').addEventListener('click', () => { const t = f.password.type === 'password'; f.password.type = t ? 'text' : 'password'; $('#verPass').textContent = t ? 'Ocultar' : 'Mostrar'; });
  $('#rPais').addEventListener('change', (e) => {
    const hijos = regs.filter((r) => r.padres.includes(+e.target.value)).sort((a, b) => a.nombre.localeCompare(b.nombre));
    $('#rProv').innerHTML = '<option value="">Sin indicar</option>' + hijos.map((h) => `<option value="${h.id}">${esc(h.nombre)}</option>`).join('');
    $('#rProv').disabled = !hijos.length;
  });
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(['nombre', 'apellido', 'username', 'email', 'telefono', 'password'].map((k) => [k, f[k].value]));
    d.region_id = +$('#rProv').value || +$('#rPais').value || null;
    try {
      const r = await api('/api/registro', {method: 'POST', json: d});
      await refreshMe();
      toast(`${Disenos.moneda('moon', 22)}<span>¡Bienvenida/o! <b>+${r.moon_ganadas}</b> Moon Coins</span>`);
      location.hash = '#zonas';
    } catch (e) { fieldErrors(f, e); }
  });
}

// ================================================================ zonas
const fechaLocal = (iso) => new Date(iso).toLocaleString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'});
async function vistaZonas() {
  const zonas = await api('/api/zonas');
  const mias = zonas.filter((z) => z.mio), resto = zonas.filter((z) => !z.mio);
  view.innerHTML = `<div class="stack"><h2>Zonas</h2>
    <p class="muted">Los puntos recomendados salen del motor de similitud con datos de la NASA. Los puntos de la comunidad los crean exploradores desde la <a href="demo.html">Demo</a>. Puedes fundar la base de cualquier zona que no tenga una, o unirte a la que ya exista.</p>
    ${mias.length ? `<h3>Mis puntos</h3><p class="muted" style="font-size:.88rem">Solo tú puedes editar los puntos que has creado. Después de guardar cambios hay que esperar 12 horas para volver a cambiarlos.</p>
      <div class="grid">${mias.map(tarjetaZona).join('')}</div><h3>Todas las zonas</h3>` : ''}
    <div class="grid">${resto.map(tarjetaZona).join('')}</div></div>`;
  view.querySelectorAll('[data-unirse]').forEach((b) => b.addEventListener('click', async () => {
    try { const r = await api(`/api/bases/${b.dataset.unirse}/unirse`, {method: 'POST'}); logros(r.logros); await refreshMe(); location.hash = `#base/${r.base.id}`; }
    catch (e) { toast(esc(tr(e.message))); }
  }));
  view.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => {
    const f = view.querySelector(`#edit-${b.dataset.editar}`); f.hidden = !f.hidden; b.textContent = f.hidden ? 'Editar punto' : 'Cerrar';
  }));
  view.querySelectorAll('form[data-zona]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await api(`/api/zonas/${f.dataset.zona}`, {method: 'PUT', json: {nombre: f.nombre.value, lat: f.lat.value, lon: f.lon.value}});
      toast('Punto actualizado. Podrás volver a cambiarlo dentro de 12 horas.');
      vistaZonas();
    } catch (e) {
      if (e.data?.bloqueado_hasta) e.data.errores = {_: `Podrás cambiar este punto a partir del ${fechaLocal(e.data.bloqueado_hasta)}.`};
      fieldErrors(f, e);
      if (e.data?.errores?._) f.querySelector('.err[data-for="_"]').textContent = e.data.errores._;
    }
  }));
}
function tarjetaZona(z) {
  const iap = z.iap ? Object.entries(z.iap).map(([k, v]) => `<div class="barrow"><span class="muted">${DEST[k]}</span><span class="bar ${k.startsWith('luna') ? 'moon' : ''}"><i style="width:${v}%"></i></span><span class="mono">${v.toFixed(0)}</span></div>`).join('') : '<p class="muted">Punto de la comunidad: aún sin perfil satelital.</p>';
  let base;
  if (z.base) {
    const soyMiembro = ME && ME.habitaciones.some((h) => h.base_id === z.base.id);
    base = `<a class="svgbox" href="#base/${z.base.id}" aria-label="Ver base">${Disenos.base(z.base.nivel_dibujo, z.base.color1, z.base.color2, z.base.miembros)}</a>
      <div class="row"><span class="pill">${esc(z.base.nombre)} · nivel ${z.base.nivel} · ${z.base.miembros} miembro${z.base.miembros === 1 ? '' : 's'}</span>
      ${soyMiembro ? '<span class="pill ok">Eres miembro</span>' : `<button class="btn" data-unirse="${z.base.id}">Unirme</button>`}</div>`;
  } else {
    base = `<a class="btn primary" href="#fundar/${z.id}">Fundar la base de esta zona</a>`;
  }
  let editar = '';
  if (z.mio) {
    const bloq = z.bloqueado_hasta && new Date(z.bloqueado_hasta) > new Date() ? z.bloqueado_hasta : null;
    editar = `<button class="btn" type="button" data-editar="${z.id}">Editar punto</button>
      <form class="stack" id="edit-${z.id}" data-zona="${z.id}" hidden novalidate style="gap:8px">
        ${bloq ? `<p class="pill" style="white-space:normal;color:var(--warn);border-color:var(--warn)">Podrás cambiarlo a partir del ${fechaLocal(bloq)}</p>` : ''}
        <fieldset ${bloq ? 'disabled' : ''} style="border:0;margin:0;padding:0;display:grid;gap:8px">
          <label>Nombre<input name="nombre" id="eNom-${z.id}" maxlength="60" value="${esc(z.nombre)}"><span class="err" data-for="nombre"></span></label>
          <div class="two"><label>Latitud<input name="lat" id="eLat-${z.id}" inputmode="decimal" value="${z.lat}"><span class="err" data-for="lat"></span></label>
            <label>Longitud<input name="lon" id="eLon-${z.id}" inputmode="decimal" value="${z.lon}"><span class="err" data-for="lon"></span></label></div>
          <p class="err" data-for="_"></p>
          <button class="btn primary">Guardar cambios</button>
        </fieldset>
      </form>`;
  }
  const etiqueta = z.recomendada ? '<span class="pill acc">Recomendada NASA</span>' : z.mio ? '<span class="pill ok">Creado por ti</span>' : '<span class="pill">Comunidad</span>';
  return `<article class="card zone"><div class="row" style="justify-content:space-between"><h3>${esc(tr(z.nombre))}</h3>${etiqueta}</div>
    ${z.nota ? `<p class="muted" style="font-size:.85rem">${esc(tr(z.nota))}</p>` : ''}${z.mio ? `<p class="muted mono" style="font-size:.78rem">${(+z.lat).toFixed(4)}, ${(+z.lon).toFixed(4)}</p>` : ''}
    <div class="bars">${iap}</div>${base}${editar}</article>`;
}

// ================================================================ mis aportaciones
async function vistaAportaciones() {
  const lista = await api('/api/aportaciones/mias');
  const dato = (v, u) => (v == null ? '' : `<span class="pill">${v}${u}</span>`);
  view.innerHTML = `<div class="stack"><h2>Mis aportaciones</h2>
    <p class="muted">Fotos y datos que has subido desde la <a href="demo.html">Demo</a>, con su fecha de subida.</p>
    ${lista.length ? `<div class="grid">${lista.map((a) => `<article class="card stack" style="gap:8px">
      ${a.foto ? `<img class="photo" src="${esc(a.foto)}" alt="Foto en ${esc(tr(a.zona))}">` : ''}
      <div class="row" style="justify-content:space-between"><b>${esc(tr(a.zona))}</b>${a.crea_punto ? '<span class="pill ok">Punto creado</span>' : ''}</div>
      <p class="muted mono" style="font-size:.8rem">${fechaLocal(a.fecha)} · ${(+a.lat).toFixed(4)}, ${(+a.lon).toFixed(4)}</p>
      <div class="row">${dato(a.temperatura_c, ' °C')}${dato(a.humedad_rel, ' % humedad')}${a.calidad_aire == null ? '' : `<span class="pill">Aire ${a.calidad_aire}</span>`}</div>
      <span class="coin">${Disenos.moneda('moon', 20)}+${a.moon_ganadas}</span></article>`).join('')}</div>`
      : '<div class="card"><p class="muted">Aún no has aportado datos. Elige un punto en la <a href="demo.html">Demo</a> y sube una foto o tus medidas.</p></div>'}</div>`;
}

// ================================================================ bases
function vistaFundar(zonaId) {
  view.innerHTML = `<div class="split"><form class="card stack" id="fBase">
    <h2>Fundar base</h2><p class="muted">Eres la primera persona en esta zona: eliges el nombre y los dos colores de la base.</p>
    <label>Nombre de la base<input name="nombre" id="bNombre" maxlength="60" placeholder="Base Tabernas"></label>
    <div class="row"><label>Color principal<input type="color" name="color1" id="bC1" value="#e7794b"></label><label>Color secundario<input type="color" name="color2" id="bC2" value="#1b2a4a"></label></div>
    <p class="err" data-for="_"></p><button class="btn primary">Fundar base</button></form>
    <div class="card svgbox" id="bPrev"></div></div>`;
  const f = $('#fBase');
  const prev = () => ($('#bPrev').innerHTML = Disenos.base(1, f.color1.value, f.color2.value, 1));
  f.color1.addEventListener('input', prev); f.color2.addEventListener('input', prev); prev();
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const r = await api('/api/bases', {method: 'POST', json: {zona_id: +zonaId, nombre: f.nombre.value, color1: f.color1.value, color2: f.color2.value}});
      logros(r.logros); await refreshMe(); location.hash = `#base/${r.base.id}`;
    } catch (e) { fieldErrors(f, e); }
  });
}
async function vistaBase(id) {
  const b = await api(`/api/bases/${id}`);
  const plantas = {};
  for (const h of b.habitaciones) (plantas[h.planta] ||= []).push(h);
  view.innerHTML = `<div class="split"><div class="card svgbox">${Disenos.base(b.nivel_dibujo, b.color1, b.color2, b.miembros)}</div>
    <div class="stack"><h2>${esc(b.nombre)}</h2>
      <div class="row"><span class="pill acc">Nivel ${b.nivel}</span><span class="pill">${b.miembros} miembro${b.miembros === 1 ? '' : 's'}</span><span class="pill">Fundada por ${esc(b.fundador)}</span></div>
      <p class="muted">Zona: ${esc(tr(b.zona))}. Cada planta tiene 5 habitaciones; la base sube de nivel al llenarse. Quedan ${b.plazas_libres_planta} plazas en la planta actual.</p>
      <div class="floors">${Object.keys(plantas).sort((a, c) => c - a).map((p) => `<div class="floor"><span class="mono muted">P${p}</span>${plantas[p].map((h) => `<a class="room ${ME && h.username === ME.username ? 'me' : ''}" href="#habitacion/${h.id}">Hab. ${h.numero} · ${esc(h.username)}</a>`).join('')}</div>`).join('')}</div>
    </div></div>`;
}
async function vistaMisBases() {
  await refreshMe();
  if (!ME.habitaciones.length) { view.innerHTML = '<div class="card"><p class="muted">Aún no estás en ninguna base. Funda una o únete desde <a href="#zonas">Zonas</a>.</p></div>'; return; }
  const bases = await Promise.all(ME.habitaciones.map((h) => api(`/api/bases/${h.base_id}`)));
  view.innerHTML = `<div class="stack"><h2>Mis bases</h2><div class="grid">${bases.map((b, i) => `<article class="card stack"><a class="svgbox" href="#base/${b.id}">${Disenos.base(b.nivel_dibujo, b.color1, b.color2, b.miembros)}</a>
    <h3>${esc(b.nombre)}</h3><div class="row"><span class="pill">Nivel ${b.nivel}</span><a class="btn" href="#habitacion/${ME.habitaciones[i].habitacion_id}">Mi habitación ${ME.habitaciones[i].numero}</a></div></article>`).join('')}</div></div>`;
}

// ================================================================ habitación
async function vistaHabitacion(id) {
  const h = await api(`/api/habitaciones/${id}`);
  const mia = ME && h.usuario_id === ME.id;
  view.innerHTML = `<div class="split"><div class="stack"><div class="card svgbox" id="hPrev">${Disenos.habitacion(h)}</div>
      <p class="muted">Habitación ${h.numero} · planta ${h.planta} · ${esc(h.base)} · de ${esc(h.username)}</p></div>
    <div id="editor" class="stack">${mia ? '' : '<div class="card muted">Solo la persona que vive aquí puede decorarla.</div>'}</div></div>`;
  if (!mia) return;
  const muebles = await api('/api/muebles');
  const est = {color_pared: h.color_pared, color_suelo: h.color_suelo, cama: h.cama, escritorio: h.escritorio, decoraciones: {...h.decoraciones}};
  const pintar = () => ($('#hPrev').innerHTML = Disenos.habitacion({...h, ...est}));
  const grupo = (titulo, lista, actual, key, permitirNada) => `<div class="card stack"><h3>${titulo}</h3><div class="choices">
    ${permitirNada ? `<button class="choice none" data-k="${key}" data-v="" aria-pressed="${!actual}">Nada</button>` : ''}
    ${lista.map((m) => `<button class="choice ${m.lo_tengo ? '' : 'locked'}" data-k="${key}" data-v="${m.clave}" aria-pressed="${actual === m.clave}" title="${esc(tr(m.nombre))}">${Disenos.mueble(m.clave, m.tipo, m.hueco, h)}<span class="tag">${m.lo_tengo ? esc(tr(m.nombre)) : m.precio_moon + ' MC'}</span></button>`).join('')}</div></div>`;
  $('#editor').innerHTML = `<div class="card row"><label class="field">Paredes<input type="color" id="cPared" value="${h.color_pared}"></label><label class="field">Suelo<input type="color" id="cSuelo" value="${h.color_suelo}"></label>
      <button class="btn primary" id="guardar" style="margin-left:auto">Guardar habitación</button></div>
    ${grupo('Cama (solo una)', muebles.filter((m) => m.tipo === 'cama'), est.cama, 'cama', false)}
    ${grupo('Escritorio (solo uno)', muebles.filter((m) => m.tipo === 'escritorio'), est.escritorio, 'escritorio', false)}
    ${Object.entries(HUECOS).map(([hu, t]) => grupo(t, muebles.filter((m) => m.hueco === hu), est.decoraciones[hu], 'deco:' + hu, true)).join('')}
    <p class="muted">Los objetos con precio se compran en la <a href="#tienda">tienda</a> con Moon Coins.</p>`;
  $('#cPared').addEventListener('input', (e) => { est.color_pared = e.target.value; pintar(); });
  $('#cSuelo').addEventListener('input', (e) => { est.color_suelo = e.target.value; pintar(); });
  $('#editor').querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
    const m = muebles.find((x) => x.clave === b.dataset.v);
    if (m && !m.lo_tengo) { toast(`Primero compra «${esc(tr(m.nombre))}» en la tienda (${m.precio_moon} Moon Coins).`); return; }
    const k = b.dataset.k;
    if (k.startsWith('deco:')) est.decoraciones[k.slice(5)] = b.dataset.v || null; else est[k] = b.dataset.v;
    b.parentElement.querySelectorAll('.choice').forEach((x) => x.setAttribute('aria-pressed', x === b));
    pintar();
  }));
  $('#guardar').addEventListener('click', async () => {
    try { const r = await api(`/api/habitaciones/${id}`, {method: 'PUT', json: est}); logros(r.logros); toast('Habitación guardada.'); await refreshMe(); }
    catch (e) { toast(esc(tr(e.message))); }
  });
}

// ================================================================ tienda, premios, objetivos, perfil
async function vistaTienda() {
  const ms = await api('/api/muebles');
  const tipos = {cama: 'Camas', escritorio: 'Escritorios', decoracion: 'Decoraciones'};
  view.innerHTML = `<div class="stack"><h2>Tienda de muebles</h2><p class="muted">Se pagan con Moon Coins. Los de precio 0 vienen de serie.</p>
    ${Object.entries(tipos).map(([t, titulo]) => `<h3>${titulo}</h3><div class="grid">${ms.filter((m) => m.tipo === t).map((m) => `<article class="card item">
      <div class="svgbox">${Disenos.mueble(m.clave, m.tipo, m.hueco)}</div><b>${esc(tr(m.nombre))}</b>
      ${m.hueco ? `<span class="muted" style="font-size:.82rem">${HUECOS[m.hueco]}</span>` : ''}
      <div class="row" style="justify-content:space-between"><span class="coin">${Disenos.moneda('moon', 20)}${m.precio_moon}</span>
      ${m.lo_tengo ? '<span class="pill ok">Lo tienes</span>' : `<button class="btn" data-comprar="${m.clave}">Comprar</button>`}</div></article>`).join('')}</div>`).join('')}</div>`;
  view.querySelectorAll('[data-comprar]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/api/muebles/${b.dataset.comprar}/comprar`, {method: 'POST'}); await refreshMe(); toast('Comprado. Ya puedes ponerlo en tu habitación.'); vistaTienda(); }
    catch (e) { toast(esc(tr(e.message))); }
  }));
}
async function vistaPremios() {
  const ps = await api('/api/premios');
  view.innerHTML = `<div class="stack"><h2>Premios físicos</h2><p class="muted">Se canjean con Mars Coins y te los enviamos a casa. Diseños originales de MoonSiteUA.</p>
    <div class="grid">${ps.map((p) => `<article class="card item"><div class="svgbox">${Disenos.premio(p.clave)}</div><b>${esc(tr(p.nombre))}</b><p class="muted" style="font-size:.85rem">${esc(tr(p.descripcion))}</p>
      <div class="row" style="justify-content:space-between"><span class="coin">${Disenos.moneda('mars', 20)}${p.precio_mars}</span><span class="pill">${p.stock ? p.stock + ' disponibles' : 'Agotado'}</span></div>
      <button class="btn" data-canjear="${p.clave}" ${p.stock ? '' : 'disabled'}>Canjear</button></article>`).join('')}</div>
    <dialog id="dlg" style="background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:10px;max-width:420px;width:calc(100% - 32px)"></dialog></div>`;
  view.querySelectorAll('[data-canjear]').forEach((b) => b.addEventListener('click', () => {
    const p = ps.find((x) => x.clave === b.dataset.canjear);
    const d = $('#dlg');
    d.innerHTML = `<form class="stack" id="fCanje" novalidate><h3>Canjear ${esc(tr(p.nombre))}</h3><p class="muted">Coste: ${p.precio_mars} Mars Coins. Tienes ${ME.saldo.mars}.</p>
      ${p.con_talla ? `<label>Talla<select name="talla" id="cTalla"><option value="">Elige…</option>${['S', 'M', 'L', 'XL', 'XXL'].map((t) => `<option>${t}</option>`).join('')}</select><span class="err" data-for="talla"></span></label>` : ''}
      <label>Dirección de envío<textarea name="direccion" id="cDir" rows="3" placeholder="Calle, número, código postal, ciudad"></textarea><span class="err" data-for="direccion"></span></label>
      <p class="err" data-for="_"></p><div class="row"><button class="btn primary">Confirmar canje</button><button class="btn" type="button" id="cCancel">Cancelar</button></div></form>`;
    d.showModal();
    $('#cCancel').addEventListener('click', () => d.close());
    $('#fCanje').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = ev.target;
      try { await api(`/api/premios/${p.clave}/canjear`, {method: 'POST', json: {talla: f.talla?.value || null, direccion: f.direccion.value}}); d.close(); await refreshMe(); toast(`¡Canjeado! Te enviaremos ${esc(tr(p.nombre))}.`); vistaPremios(); }
      catch (e) { fieldErrors(f, e); }
    });
  }));
}
async function vistaObjetivos() {
  const o = await api('/api/objetivos');
  const PER = {diario: 'Hoy', semanal: 'Esta semana', mensual: 'Este mes', unico: 'Una vez'};
  const fila = (x) => `<div class="card stack" style="gap:8px"><div class="row" style="justify-content:space-between"><b>${esc(tr(x.titulo))}</b><span class="coin">${Disenos.moneda(x.moneda, 20)}+${x.recompensa}</span></div>
    <div class="bar"><i style="width:${100 * x.progreso / x.meta}%;${x.completado ? 'background:var(--ok)' : ''}"></i></div>
    <div class="row" style="justify-content:space-between"><span class="muted">${PER[x.periodo]}</span><span class="mono">${x.progreso}/${x.meta}${x.completado ? ' · completado' : ''}</span></div></div>`;
  view.innerHTML = `<div class="stack"><h2>Objetivos</h2><h3>Individuales</h3><div class="grid">${o.individuales.map(fila).join('')}</div>
    <h3>De tus bases (compartidos: al completarse cobra cada miembro)</h3>
    ${o.bases.length ? o.bases.map((b) => `<p class="muted">${esc(b.base)}</p><div class="grid">${b.objetivos.map(fila).join('')}</div>`).join('') : '<p class="muted">Únete a una base para ver sus objetivos.</p>'}</div>`;
}
async function vistaPerfil() {
  await refreshMe();
  const movs = await api('/api/movimientos');
  view.innerHTML = `<div class="split"><div class="card stack"><h2>${esc(ME.nombre)} ${esc(ME.apellido)}</h2>
      <p class="muted">@${esc(ME.username)} · ${esc(ME.email)}${ME.region ? ' · ' + esc(ME.region) : ''}</p>
      <div class="row"><span class="coin">${Disenos.moneda('moon', 32)}${ME.saldo.moon} Moon</span><span class="coin">${Disenos.moneda('mars', 32)}${ME.saldo.mars} Mars</span></div>
      <button class="btn" id="salir">Cerrar sesión</button></div>
    <div class="card"><h3>Movimientos</h3><table><tbody>${movs.map((m) => `<tr><td>${esc(tr(m.motivo))}</td><td class="mono" style="color:${m.cantidad > 0 ? 'var(--ok)' : 'var(--bad)'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad} ${m.moneda === 'moon' ? 'Moon' : 'Mars'}</td></tr>`).join('')}</tbody></table></div></div>`;
  $('#salir').addEventListener('click', async () => { await api('/api/logout', {method: 'POST'}); ME = null; await refreshMe(); location.hash = '#entrar'; });
}

// ================================================================ router
const RUTAS = {entrar: vistaEntrar, registro: vistaRegistro, zonas: vistaZonas, aportaciones: vistaAportaciones, subir: vistaZonas, fotos: vistaAportaciones, bases: vistaMisBases,
  fundar: vistaFundar, base: vistaBase, habitacion: vistaHabitacion, tienda: vistaTienda, premios: vistaPremios, objetivos: vistaObjetivos, perfil: vistaPerfil};
const PUBLICAS = new Set(['entrar', 'registro']);
async function router() {
  const [ruta, arg] = (location.hash.slice(1) || 'zonas').split('/');
  if (!ME && !PUBLICAS.has(ruta)) { if (location.hash !== '#entrar') location.hash = '#entrar'; else vistaEntrar(); return; }
  document.querySelectorAll('nav.tabs a').forEach((a) => { if (a.getAttribute('href') === '#' + ruta) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  try { await (RUTAS[ruta] || vistaZonas)(arg); } catch (e) { view.innerHTML = `<div class="card"><p class="err">${esc(tr(e.message))}</p></div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', router);
if (location.protocol === 'file:') {
  view.innerHTML = `<div class="card stack"><h2>Zona de exploradores</h2><p class="muted">${SIN_SERVIDOR}</p></div>`;
} else {
  refreshMe().then(router);
}
})();