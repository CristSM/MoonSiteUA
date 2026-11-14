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
    const box = form.querySelector(`.err[data-for="${k}"]`); if (box) box.textContent = v;
  }
  const g = form.querySelector('.err[data-for="_"]'); if (g) g.textContent = Object.keys(errs).length ? '' : e.message;
}

// ================================================================ acceso
function vistaEntrar() {
  view.innerHTML = `<div class="hero">
    <div class="stack"><h1 style="font-size:2.2rem">Sé un <span style="color:var(--accent)">rover humano</span></h1>
      <p class="muted">Sube fotos de terrenos parecidos a la Luna y Marte, compáralos con los puntos recomendados con datos de la NASA y construye tu base con otros exploradores.</p>
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
      <label>País (opcional)<select id="rPais"><option value="">Sin indicar</option>${paises.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></label>
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
async function vistaZonas() {
  const zonas = await api('/api/zonas');
  const misZonas = new Set((await api('/api/reportes')).map((r) => r.zona_id));
  view.innerHTML = `<div class="stack"><h2>Zonas</h2>
    <p class="muted">Los puntos recomendados salen del motor de similitud con datos de la NASA. Las zonas comunitarias las crean exploradores al subir fotos lejos de cualquier zona. Para fundar o unirte a una base tienes que haber subido una foto desde esa zona.</p>
    <div class="grid">${zonas.map((z) => tarjetaZona(z, misZonas.has(z.id))).join('')}</div></div>`;
  view.querySelectorAll('[data-unirse]').forEach((b) => b.addEventListener('click', async () => {
    try { const r = await api(`/api/bases/${b.dataset.unirse}/unirse`, {method: 'POST'}); logros(r.logros); await refreshMe(); location.hash = `#base/${r.base.id}`; }
    catch (e) { toast(esc(e.message)); }
  }));
}
function tarjetaZona(z, estuve) {
  const iap = z.iap ? Object.entries(z.iap).map(([k, v]) => `<div class="barrow"><span class="muted">${DEST[k]}</span><span class="bar ${k.startsWith('luna') ? 'moon' : ''}"><i style="width:${v}%"></i></span><span class="mono">${v.toFixed(0)}</span></div>`).join('') : '<p class="muted">Zona comunitaria: aún sin perfil satelital.</p>';
  let base;
  if (z.base) {
    const soyMiembro = ME && ME.habitaciones.some((h) => h.base_id === z.base.id);
    base = `<a class="svgbox" href="#base/${z.base.id}" aria-label="Ver base">${Disenos.base(z.base.nivel_dibujo, z.base.color1, z.base.color2, z.base.miembros)}</a>
      <div class="row"><span class="pill">${esc(z.base.nombre)} · nivel ${z.base.nivel} · ${z.base.miembros} miembro${z.base.miembros === 1 ? '' : 's'}</span>
      ${soyMiembro ? '<span class="pill ok">Eres miembro</span>' : estuve ? `<button class="btn" data-unirse="${z.base.id}">Unirme</button>` : ''}</div>`;
  } else {
    base = estuve ? `<a class="btn primary" href="#fundar/${z.id}">Fundar la base de esta zona</a>` : '<p class="muted">Sin base todavía. Sube una foto desde aquí para poder fundarla.</p>';
  }
  return `<article class="card zone"><div class="row" style="justify-content:space-between"><h3>${esc(z.nombre)}</h3>${z.recomendada ? '<span class="pill acc">Recomendada NASA</span>' : '<span class="pill">Comunitaria</span>'}</div>
    ${z.nota ? `<p class="muted" style="font-size:.85rem">${esc(z.nota)}</p>` : ''}<div class="bars">${iap}</div>${base}</article>`;
}

// ================================================================ subir foto
async function vistaSubir() {
  const zonas = (await api('/api/zonas')).filter((z) => z.recomendada);
  view.innerHTML = `<div class="split"><form class="card stack" id="fFoto" novalidate>
    <h2>Subir foto de un terreno</h2>
    <label>Foto (JPG, PNG o WEBP, máx. 8 MB)<input type="file" name="foto" id="fFile" accept="image/jpeg,image/png,image/webp" capture="environment" required><span class="err" data-for="foto"></span></label>
    <img class="photo" id="prev" alt="Vista previa de la foto" hidden>
    <div class="field">Ubicación
      <div class="row"><button type="button" class="btn" id="geo">Usar mi ubicación</button><span class="muted" id="geoMsg"></span></div>
      <div class="two"><input name="lat" id="fLat" inputmode="decimal" placeholder="Latitud"><input name="lon" id="fLon" inputmode="decimal" placeholder="Longitud"></div>
      <select id="fDemo" aria-label="Rellenar con una zona recomendada (para probar)"><option value="">Para probar: rellenar con una zona recomendada…</option>${zonas.map((z) => `<option value="${z.lat},${z.lon}">${esc(z.nombre)}</option>`).join('')}</select>
      <span class="err" data-for="lat"></span></div>
    <label>Tipo de suelo<select name="tipo_suelo" id="fSuelo" required><option value="">Elige…</option>${Object.entries(SUELOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><span class="err" data-for="tipo_suelo"></span></label>
    <label>Vegetación<select name="vegetacion" id="fVeg" required><option value="">Elige…</option><option value="nada">Ninguna</option><option value="escasa">Escasa</option><option value="abundante">Abundante</option></select><span class="err" data-for="vegetacion"></span></label>
    <div class="two"><label>Pendiente en grados (opcional)<input name="pendiente_deg" id="fPend" inputmode="decimal" placeholder="Inclinómetro del móvil"><span class="err" data-for="pendiente_deg"></span></label>
      <label>Altitud en metros (opcional)<input name="altitud_m" id="fAlt" inputmode="decimal"></label></div>
    <label>Nota (opcional)<textarea name="nota" id="fNota" rows="2" maxlength="500"></textarea></label>
    <p class="err" data-for="_"></p>
    <button class="btn primary" id="fEnviar">Subir y comparar</button>
  </form><div id="resultado" class="stack"><div class="card muted">Al subir la foto verás su parecido con el punto recomendado más cercano y con los cuatro destinos.</div></div></div>`;
  const f = $('#fFoto');
  $('#fFile').addEventListener('change', (e) => { const file = e.target.files[0]; if (file) { $('#prev').src = URL.createObjectURL(file); $('#prev').hidden = false; } });
  $('#fDemo').addEventListener('change', (e) => { if (!e.target.value) return; const [la, lo] = e.target.value.split(','); f.lat.value = la; f.lon.value = lo; });
  $('#geo').addEventListener('click', () => {
    if (!navigator.geolocation) { $('#geoMsg').textContent = 'Tu navegador no da la ubicación.'; return; }
    $('#geoMsg').textContent = 'Buscando…';
    navigator.geolocation.getCurrentPosition((p) => {
      f.lat.value = p.coords.latitude.toFixed(5); f.lon.value = p.coords.longitude.toFixed(5);
      $('#geoMsg').textContent = `Precisión ±${Math.round(p.coords.accuracy)} m`;
      if (p.coords.altitude != null) f.altitud_m.value = Math.round(p.coords.altitude);
    }, () => { $('#geoMsg').textContent = 'No se pudo obtener. Escríbela a mano.'; }, {enableHighAccuracy: true, timeout: 15000});
  });
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    for (const k of ['pendiente_deg', 'altitud_m', 'nota']) if (!fd.get(k)) fd.delete(k);
    if (!$('#fFile').files[0]) return fieldErrors(f, {data: {errores: {foto: 'Elige una foto.'}}});
    if (!fd.get('lat') || !fd.get('lon')) return fieldErrors(f, {data: {errores: {lat: 'Hace falta la ubicación de la foto.'}}});
    $('#fEnviar').disabled = true;
    try {
      const r = await api('/api/reportes', {method: 'POST', body: fd});
      fieldErrors(f, {data: {errores: {}}});
      $('#resultado').innerHTML = resultado(r.comparacion, r.foto, r.zona_id, r.zona);
      logros(r.logros); await refreshMe();
    } catch (e) { fieldErrors(f, e); } finally { $('#fEnviar').disabled = false; }
  });
}
function resultado(c, foto, zonaId, zonaNombre) {
  const p = c.punto_nasa;
  return `<div class="card stack"><img class="photo" src="${esc(foto)}" alt="Foto subida">
    <h3>Parecido con «${esc(p.nombre)}»: <span style="color:var(--accent)">${c.similitud_con_punto.toFixed(0)} %</span></h3>
    <p class="muted">Punto recomendado más cercano, a ${p.distancia_km} km${p.dentro ? ' (estás dentro de la zona)' : ''}. Se comparan los ejes que has medido: ${Object.keys(c.ejes_medidos).join(', ')}.</p>
    <table><thead><tr><th>Destino</th><th>Tu foto</th><th>Punto NASA</th></tr></thead><tbody>
      ${c.destinos.map((d) => `<tr><td>${esc(d.nombre)}</td><td class="mono">${d.iap_foto.toFixed(0)}</td><td class="mono">${d.iap_punto_nasa.toFixed(0)}</td></tr>`).join('')}
    </tbody></table>
    ${zonaId ? `<a class="btn" href="#zonas">Ver la zona «${esc(zonaNombre)}» y su base</a>` : '<p class="muted">Estás cerca de una zona pero fuera de su radio: la foto cuenta, pero no da acceso a la base.</p>'}</div>`;
}
async function vistaFotos() {
  const rs = await api('/api/reportes');
  view.innerHTML = `<div class="stack"><h2>Mis fotos</h2>${rs.length ? `<div class="grid">${rs.map((r) => `<article class="card stack"><img class="photo" src="${esc(r.foto)}" alt="Foto en ${esc(r.zona || 'sin zona')}">
    <div class="row" style="justify-content:space-between"><b>${esc(r.zona || 'Sin zona')}</b><span class="pill">${r.fecha.slice(0, 10)}</span></div>
    <p class="muted">${SUELOS[r.tipo_suelo]} · vegetación ${r.vegetacion}${r.pendiente_deg != null ? ` · ${r.pendiente_deg}°` : ''}</p>
    <p>Parecido con ${esc(r.comparacion.punto_nasa.nombre)}: <b class="mono">${r.comparacion.similitud_con_punto.toFixed(0)} %</b></p>
    <p class="muted">Mejor destino: ${esc(r.comparacion.destinos[0].nombre)} (${r.comparacion.destinos[0].iap_foto.toFixed(0)})</p></article>`).join('')}</div>` : '<div class="card"><p class="muted">Aún no has subido fotos. <a href="#subir">Sube la primera</a>.</p></div>'}</div>`;
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
      <p class="muted">Zona: ${esc(b.zona)}. Cada planta tiene 5 habitaciones; la base sube de nivel al llenarse. Quedan ${b.plazas_libres_planta} plazas en la planta actual.</p>
      <div class="floors">${Object.keys(plantas).sort((a, c) => c - a).map((p) => `<div class="floor"><span class="mono muted">P${p}</span>${plantas[p].map((h) => `<a class="room ${ME && h.username === ME.username ? 'me' : ''}" href="#habitacion/${h.id}">Hab. ${h.numero} · ${esc(h.username)}</a>`).join('')}</div>`).join('')}</div>
    </div></div>`;
}
async function vistaMisBases() {
  await refreshMe();
  if (!ME.habitaciones.length) { view.innerHTML = '<div class="card"><p class="muted">Aún no estás en ninguna base. Sube una foto desde una zona y fúndala o únete desde <a href="#zonas">Zonas</a>.</p></div>'; return; }
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
    ${lista.map((m) => `<button class="choice ${m.lo_tengo ? '' : 'locked'}" data-k="${key}" data-v="${m.clave}" aria-pressed="${actual === m.clave}" title="${esc(m.nombre)}">${Disenos.mueble(m.clave, m.tipo, m.hueco, h)}<span class="tag">${m.lo_tengo ? esc(m.nombre) : m.precio_moon + ' MC'}</span></button>`).join('')}</div></div>`;
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
    if (m && !m.lo_tengo) { toast(`Primero compra «${esc(m.nombre)}» en la tienda (${m.precio_moon} Moon Coins).`); return; }
    const k = b.dataset.k;
    if (k.startsWith('deco:')) est.decoraciones[k.slice(5)] = b.dataset.v || null; else est[k] = b.dataset.v;
    b.parentElement.querySelectorAll('.choice').forEach((x) => x.setAttribute('aria-pressed', x === b));
    pintar();
  }));
  $('#guardar').addEventListener('click', async () => {
    try { const r = await api(`/api/habitaciones/${id}`, {method: 'PUT', json: est}); logros(r.logros); toast('Habitación guardada.'); await refreshMe(); }
    catch (e) { toast(esc(e.message)); }
  });
}

// ================================================================ tienda, premios, objetivos, perfil
async function vistaTienda() {
  const ms = await api('/api/muebles');
  const tipos = {cama: 'Camas', escritorio: 'Escritorios', decoracion: 'Decoraciones'};
  view.innerHTML = `<div class="stack"><h2>Tienda de muebles</h2><p class="muted">Se pagan con Moon Coins. Los de precio 0 vienen de serie.</p>
    ${Object.entries(tipos).map(([t, titulo]) => `<h3>${titulo}</h3><div class="grid">${ms.filter((m) => m.tipo === t).map((m) => `<article class="card item">
      <div class="svgbox">${Disenos.mueble(m.clave, m.tipo, m.hueco)}</div><b>${esc(m.nombre)}</b>
      ${m.hueco ? `<span class="muted" style="font-size:.82rem">${HUECOS[m.hueco]}</span>` : ''}
      <div class="row" style="justify-content:space-between"><span class="coin">${Disenos.moneda('moon', 20)}${m.precio_moon}</span>
      ${m.lo_tengo ? '<span class="pill ok">Lo tienes</span>' : `<button class="btn" data-comprar="${m.clave}">Comprar</button>`}</div></article>`).join('')}</div>`).join('')}</div>`;
  view.querySelectorAll('[data-comprar]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/api/muebles/${b.dataset.comprar}/comprar`, {method: 'POST'}); await refreshMe(); toast('Comprado. Ya puedes ponerlo en tu habitación.'); vistaTienda(); }
    catch (e) { toast(esc(e.message)); }
  }));
}
async function vistaPremios() {
  const ps = await api('/api/premios');
  view.innerHTML = `<div class="stack"><h2>Premios físicos</h2><p class="muted">Se canjean con Mars Coins y te los enviamos a casa. Diseños originales de MoonSiteUA.</p>
    <div class="grid">${ps.map((p) => `<article class="card item"><div class="svgbox">${Disenos.premio(p.clave)}</div><b>${esc(p.nombre)}</b><p class="muted" style="font-size:.85rem">${esc(p.descripcion)}</p>
      <div class="row" style="justify-content:space-between"><span class="coin">${Disenos.moneda('mars', 20)}${p.precio_mars}</span><span class="pill">${p.stock ? p.stock + ' disponibles' : 'Agotado'}</span></div>
      <button class="btn" data-canjear="${p.clave}" ${p.stock ? '' : 'disabled'}>Canjear</button></article>`).join('')}</div>
    <dialog id="dlg" style="background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:10px;max-width:420px;width:calc(100% - 32px)"></dialog></div>`;
  view.querySelectorAll('[data-canjear]').forEach((b) => b.addEventListener('click', () => {
    const p = ps.find((x) => x.clave === b.dataset.canjear);
    const d = $('#dlg');
    d.innerHTML = `<form class="stack" id="fCanje" novalidate><h3>Canjear ${esc(p.nombre)}</h3><p class="muted">Coste: ${p.precio_mars} Mars Coins. Tienes ${ME.saldo.mars}.</p>
      ${p.con_talla ? `<label>Talla<select name="talla" id="cTalla"><option value="">Elige…</option>${['S', 'M', 'L', 'XL', 'XXL'].map((t) => `<option>${t}</option>`).join('')}</select><span class="err" data-for="talla"></span></label>` : ''}
      <label>Dirección de envío<textarea name="direccion" id="cDir" rows="3" placeholder="Calle, número, código postal, ciudad"></textarea><span class="err" data-for="direccion"></span></label>
      <p class="err" data-for="_"></p><div class="row"><button class="btn primary">Confirmar canje</button><button class="btn" type="button" id="cCancel">Cancelar</button></div></form>`;
    d.showModal();
    $('#cCancel').addEventListener('click', () => d.close());
    $('#fCanje').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = ev.target;
      try { await api(`/api/premios/${p.clave}/canjear`, {method: 'POST', json: {talla: f.talla?.value || null, direccion: f.direccion.value}}); d.close(); await refreshMe(); toast(`¡Canjeado! Te enviaremos ${esc(p.nombre)}.`); vistaPremios(); }
      catch (e) { fieldErrors(f, e); }
    });
  }));
}
async function vistaObjetivos() {
  const o = await api('/api/objetivos');
  const PER = {diario: 'Hoy', semanal: 'Esta semana', mensual: 'Este mes', unico: 'Una vez'};
  const fila = (x) => `<div class="card stack" style="gap:8px"><div class="row" style="justify-content:space-between"><b>${esc(x.titulo)}</b><span class="coin">${Disenos.moneda(x.moneda, 20)}+${x.recompensa}</span></div>
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
    <div class="card"><h3>Movimientos</h3><table><tbody>${movs.map((m) => `<tr><td>${esc(m.motivo)}</td><td class="mono" style="color:${m.cantidad > 0 ? 'var(--ok)' : 'var(--bad)'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad} ${m.moneda === 'moon' ? 'Moon' : 'Mars'}</td></tr>`).join('')}</tbody></table></div></div>`;
  $('#salir').addEventListener('click', async () => { await api('/api/logout', {method: 'POST'}); ME = null; await refreshMe(); location.hash = '#entrar'; });
}

// ================================================================ router
const RUTAS = {entrar: vistaEntrar, registro: vistaRegistro, zonas: vistaZonas, subir: vistaSubir, fotos: vistaFotos, bases: vistaMisBases,
  fundar: vistaFundar, base: vistaBase, habitacion: vistaHabitacion, tienda: vistaTienda, premios: vistaPremios, objetivos: vistaObjetivos, perfil: vistaPerfil};
const PUBLICAS = new Set(['entrar', 'registro']);
async function router() {
  const [ruta, arg] = (location.hash.slice(1) || 'zonas').split('/');
  if (!ME && !PUBLICAS.has(ruta)) { if (location.hash !== '#entrar') location.hash = '#entrar'; else vistaEntrar(); return; }
  document.querySelectorAll('nav.tabs a').forEach((a) => { if (a.getAttribute('href') === '#' + ruta) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  try { await (RUTAS[ruta] || vistaZonas)(arg); } catch (e) { view.innerHTML = `<div class="card"><p class="err">${esc(e.message)}</p></div>`; }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', router);
if (location.protocol === 'file:') {
  view.innerHTML = `<div class="card stack"><h2>Zona de exploradores</h2><p class="muted">${SIN_SERVIDOR}</p></div>`;
} else {
  refreshMe().then(router);
}
})();