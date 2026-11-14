/* MoonSiteUA · Diseños en SVG: monedas, edificio de la base (niveles 1-5),
   habitación y muebles, y merchandising. Estilo de agencia espacial: azul marino,
   blanco de módulo, rojo-naranja de señalización. Sin logotipos de terceros.
   Uso: Disenos.moneda('moon', 32), Disenos.base(nivel, color1, color2, ocupadas),
        Disenos.habitacion({...}), Disenos.mueble(clave), Disenos.premio(clave). */
(function (root) {
  const NAVY = '#0b2350', WHITE = '#f4f6fa', HULL = '#d9dee8', RED = '#e2462c', STEEL = '#8a94a8', DARK = '#1a2235', GLASS = '#7fc3e8';
  const svg = (w, h, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra}>${body}</svg>`;

  // ------------------------------------------------------------ monedas
  function moneda(tipo, size = 32) {
    const moon = tipo === 'moon';
    const id = 'g' + tipo + size;
    const face = moon
      ? `<circle cx="32" cy="32" r="17" fill="#e9ecf2"/><circle cx="26" cy="27" r="4" fill="#c9cfdb"/><circle cx="37" cy="36" r="5.5" fill="#c9cfdb"/><circle cx="35" cy="24" r="2.4" fill="#c9cfdb"/><circle cx="25" cy="39" r="2" fill="#c9cfdb"/>`
      : `<circle cx="32" cy="32" r="17" fill="#d4643a"/><path d="M17 30c6 2 10-2 15 0s9 3 15 0" stroke="#a8432a" stroke-width="2.4" fill="none"/><circle cx="38" cy="38" r="4" fill="#b8502f"/><path d="M22 20a17 17 0 0 1 20 0" stroke="#f3e6dc" stroke-width="3" fill="none"/>`;
    return svg(64, 64, `
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${moon ? '#fdfdff' : '#ffd6b8'}"/><stop offset="1" stop-color="${moon ? '#9aa6bd' : '#b9542e'}"/></linearGradient></defs>
      <circle cx="32" cy="32" r="30" fill="url(#${id})"/>
      <circle cx="32" cy="32" r="25" fill="${NAVY}"/>
      ${Array.from({length: 24}, (_, i) => { const a = i * Math.PI / 12; return `<line x1="${32 + Math.cos(a) * 27}" y1="${32 + Math.sin(a) * 27}" x2="${32 + Math.cos(a) * 29}" y2="${32 + Math.sin(a) * 29}" stroke="${NAVY}" stroke-width="1.4"/>`; }).join('')}
      ${face}
      <path d="M10 44 Q32 60 54 44" stroke="${moon ? '#cfd6e4' : '#ffb48c'}" stroke-width="1.6" fill="none" stroke-dasharray="2 2"/>`,
      `width="${size}" height="${size}" role="img" aria-label="${moon ? 'Moon Coin' : 'Mars Coin'}"`);
  }

  // ------------------------------------------------------------ edificio de la base
  // Cada planta tiene 5 ventanas = 5 habitaciones. "ocupadas" ilumina las ventanas.
  function base(nivel, c1 = '#e7794b', c2 = '#1b2a4a', ocupadas = 0) {
    const lv = Math.max(1, Math.min(5, nivel));
    const W = 320, H = 300, ground = 262, floorH = 34;
    let s = `<rect width="${W}" height="${H}" fill="#0b1120"/>`;
    // estrellas fijas (deterministas)
    for (let i = 0; i < 40; i++) { const x = (i * 73) % W, y = (i * 37) % 150; s += `<circle cx="${x}" cy="${y}" r="${i % 5 ? .7 : 1.2}" fill="#fff" opacity=".7"/>`; }
    s += `<circle cx="270" cy="40" r="16" fill="#3d7bd9"/><path d="M262 32c5 3 4 9 10 9s6 6 2 8" stroke="#5cb85c" stroke-width="3" fill="none"/>`; // la Tierra
    // suelo lunar
    s += `<path d="M0 ${ground} Q80 ${ground - 8} 160 ${ground} T320 ${ground - 4} V${H} H0Z" fill="#7d8291"/><ellipse cx="60" cy="${ground + 18}" rx="22" ry="5" fill="#6a6f7d"/><ellipse cx="250" cy="${ground + 24}" rx="30" ry="6" fill="#6a6f7d"/>`;
    const cx = 160, bw = 150 - (lv >= 3 ? 0 : 10);
    if (lv === 1) {
      // nivel 1: un módulo hinchable con esclusa
      s += `<path d="M85 ${ground} V${ground - 36} A75 52 0 0 1 235 ${ground - 36} V${ground}Z" fill="${WHITE}" stroke="${STEEL}" stroke-width="2"/>`;
      s += `<path d="M85 ${ground - 36} A75 52 0 0 1 235 ${ground - 36}" fill="none" stroke="${c1}" stroke-width="6"/>`;
      s += `<rect x="85" y="${ground - 22}" width="150" height="8" fill="${c2}"/>`;
      for (let i = 0; i < 5; i++) s += win(103 + i * 26, ground - 52, i < ocupadas);
      s += `<rect x="232" y="${ground - 30}" width="34" height="30" rx="4" fill="${HULL}" stroke="${STEEL}" stroke-width="2"/><rect x="242" y="${ground - 24}" width="14" height="24" rx="3" fill="${DARK}"/>`;
    } else {
      // niveles 2-5: torre de módulos cilíndricos apilados
      const plantas = lv;
      const top = ground - plantas * floorH;
      s += `<rect x="${cx - bw / 2 - 10}" y="${ground - 6}" width="${bw + 20}" height="8" fill="${STEEL}"/>`;
      for (let p = 0; p < plantas; p++) {
        const y = ground - (p + 1) * floorH;
        s += `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${floorH - 2}" rx="${p === plantas - 1 ? 10 : 3}" fill="${WHITE}" stroke="${STEEL}" stroke-width="1.5"/>`;
        s += `<rect x="${cx - bw / 2}" y="${y + floorH - 9}" width="${bw}" height="5" fill="${p % 2 ? c2 : c1}"/>`;
        for (let i = 0; i < 5; i++) s += win(cx - bw / 2 + 14 + i * ((bw - 28) / 4) - 8, y + 6, p * 5 + i < ocupadas);
        s += `<text x="${cx + bw / 2 + 6}" y="${y + 20}" font-size="9" fill="${STEEL}" font-family="monospace">P${p + 1}</text>`;
      }
      // cúpula superior con los colores de la base
      s += `<path d="M${cx - 40} ${top} A40 26 0 0 1 ${cx + 40} ${top}Z" fill="${GLASS}" opacity=".85" stroke="${c1}" stroke-width="3"/>`;
      if (lv >= 3) { // paneles solares
        s += `<line x1="${cx - bw / 2}" y1="${ground - 2.5 * floorH}" x2="${cx - bw / 2 - 40}" y2="${ground - 2.5 * floorH}" stroke="${STEEL}" stroke-width="3"/>`;
        s += `<line x1="${cx + bw / 2}" y1="${ground - 2.5 * floorH}" x2="${cx + bw / 2 + 40}" y2="${ground - 2.5 * floorH}" stroke="${STEEL}" stroke-width="3"/>`;
        for (const sx of [cx - bw / 2 - 70, cx + bw / 2 + 30]) s += `<rect x="${sx}" y="${ground - 2.5 * floorH - 22}" width="40" height="44" fill="#1f3c88" stroke="#9ab" stroke-width="1"/><path d="M${sx} ${ground - 2.5 * floorH} h40 M${sx + 20} ${ground - 2.5 * floorH - 22} v44" stroke="#9ab" stroke-width=".8"/>`;
      }
      if (lv >= 4) { // antena y bandera
        s += `<line x1="${cx}" y1="${top - 26}" x2="${cx}" y2="${top - 70}" stroke="${STEEL}" stroke-width="3"/><path d="M${cx} ${top - 70} h26 v10 h-26z" fill="${c1}"/><path d="M${cx} ${top - 60} h26 v8 h-26z" fill="${c2}"/>`;
      }
      if (lv >= 5) { // plato de comunicaciones e invernadero: dibujo final
        s += `<path d="M${cx + 40} ${top - 4} q22 -30 44 -8" fill="${HULL}" stroke="${STEEL}" stroke-width="2"/><line x1="${cx + 62}" y1="${top - 10}" x2="${cx + 70}" y2="${top - 28}" stroke="${STEEL}" stroke-width="2"/>`;
        s += `<path d="M20 ${ground} A30 24 0 0 1 80 ${ground}Z" fill="${GLASS}" opacity=".7" stroke="#5cb85c" stroke-width="2"/><path d="M34 ${ground - 4} q6 -12 12 0 M50 ${ground - 4} q6 -14 12 0" stroke="#5cb85c" stroke-width="3" fill="none"/>`;
        s += `<text x="${W - 12}" y="${H - 10}" text-anchor="end" font-size="11" fill="#fff" font-family="monospace">NIVEL 5+</text>`;
      }
    }
    // rover aparcado
    s += `<g transform="translate(${lv === 1 ? 24 : 250} ${ground - 16})"><rect width="34" height="10" rx="2" fill="${HULL}"/><rect x="6" y="-6" width="12" height="6" fill="${c2}"/><circle cx="6" cy="12" r="5" fill="${DARK}"/><circle cx="28" cy="12" r="5" fill="${DARK}"/></g>`;
    return svg(W, H, s, `role="img" aria-label="Base de nivel ${nivel}"`);
  }
  function win(x, y, lit) {
    return `<rect x="${x}" y="${y}" width="16" height="14" rx="7" fill="${lit ? '#ffd27a' : DARK}" stroke="${STEEL}" stroke-width="1.2"/>`;
  }

  // ------------------------------------------------------------ habitación realista
  // Perspectiva de un punto: el punto de fuga está en el centro de la pared del fondo.
  // Geometría (400x260): pared del fondo x 80-320, y 36-176; paredes laterales,
  // techo y suelo convergen hacia ella. Los muebles se dibujan con volumen
  // (cara frontal, superior y lateral), degradados de material y sombras.
  const VP = [200, 106];
  let UID = 0;
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(h, to, t) {
    const a = hex2rgb(h), b = hex2rgb(to);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const dark = (h, t) => mix(h, '#000000', t), light = (h, t) => mix(h, '#ffffff', t);
  // altura de techo y suelo en las paredes laterales para una x dada
  const lw = (x, t) => { const c = 36 - (80 - x) * 0.45, f = 176 + (80 - x) * 1.05; return c + t * (f - c); };
  const rw = (x, t) => { const c = 36 - (x - 320) * 0.45, f = 176 + (x - 320) * 1.05; return c + t * (f - c); };

  // Caja con volumen: cara frontal (x,y,w,h), superior y lateral hacia el punto de fuga
  function box(x, y, w, h, d, front, top, side) {
    const cx = x + w / 2, k = d / 100;
    const dx = (VP[0] - cx) * k, dy = (VP[1] - y) * k;
    const sideX = dx > 0 ? x + w : x;
    let s = `<path d="M${x} ${y} L${x + w} ${y} L${x + w + dx} ${y + dy} L${x + dx} ${y + dy}Z" fill="${top}"/>`;
    s += `<path d="M${sideX} ${y} L${sideX + dx} ${y + dy} L${sideX + dx} ${y + h + dy} L${sideX} ${y + h}Z" fill="${side}"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${front}"/>`;
    return s;
  }
  const sombra = (c, cx, cy, rx, ry, o = .35) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="${o}" filter="url(#blur-${c.uid})"/>`;

  function defs(c) {
    const u = c.uid;
    return `<defs>
      <filter id="blur-${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
      <filter id="glow-${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="metal-${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset="1" stop-color="#aeb6c4"/></linearGradient>
      <linearGradient id="metalH-${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa3b3"/><stop offset=".5" stop-color="#eef1f6"/><stop offset="1" stop-color="#8d96a8"/></linearGradient>
      <linearGradient id="dark-${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4357"/><stop offset="1" stop-color="#171c28"/></linearGradient>
      <linearGradient id="fabric-${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f95d8"/><stop offset="1" stop-color="#34508f"/></linearGradient>
      <linearGradient id="sheet-${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d7dde8"/></linearGradient>
      <linearGradient id="screen-${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16406e"/><stop offset="1" stop-color="#050c1a"/></linearGradient>
      <linearGradient id="glass-${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8f1ff" stop-opacity=".75"/><stop offset="1" stop-color="#5aa9d6" stop-opacity=".25"/></linearGradient>
      <radialGradient id="earth-${u}" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#7fb6ff"/><stop offset=".6" stop-color="#2f6fd0"/><stop offset="1" stop-color="#0d2a66"/></radialGradient>
      <radialGradient id="moonG-${u}" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#c9cfdb"/><stop offset="1" stop-color="#7c8496"/></radialGradient>
      <radialGradient id="marsG-${u}" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#f0a274"/><stop offset=".65" stop-color="#c8562e"/><stop offset="1" stop-color="#5e2210"/></radialGradient>
      <radialGradient id="rock-${u}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
      <radialGradient id="lamp-${u}" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#fff3d1" stop-opacity=".55"/><stop offset="1" stop-color="#fff3d1" stop-opacity="0"/></radialGradient>
      <radialGradient id="holo-${u}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9be3ff" stop-opacity=".9"/><stop offset="1" stop-color="#2aa7e0" stop-opacity="0"/></radialGradient>
      <linearGradient id="leaf-${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd36b"/><stop offset="1" stop-color="#2e7d32"/></linearGradient>
    </defs>`;
  }

  const M = {
    // ---------------- camas (delante a la izquierda)
    cama_estandar: (c) => { const u = c.uid; return sombra(c, 100, 246, 86, 8) +
      box(22, 214, 150, 30, 22, `url(#metal-${u})`, '#e9edf3', '#b5bdca') +             // somier
      box(26, 200, 142, 16, 22, `url(#sheet-${u})`, '#ffffff', '#d4dae5') +             // colchón
      `<path d="M26 206 L168 206 L168 216 L26 216Z" fill="url(#fabric-${u})"/>` +          // manta
      `<path d="M74 200 L168 200 L180 190 L86 190Z" fill="url(#fabric-${u})" opacity=".95"/>` +
      `<path d="M90 194 q20 4 40 0 t38 0" stroke="#2c4682" stroke-width="1" fill="none" opacity=".6"/>` +
      `<rect x="34" y="189" width="34" height="13" rx="6" fill="#fdfdff" stroke="#cfd5e0"/>` +   // almohada
      `<rect x="22" y="232" width="150" height="3" fill="#0b2350" opacity=".5"/>` +
      `<path d="M22 196 v-14 h6 v14 M166 196 v-14 h6 v14" fill="#8a94a8"/><rect x="22" y="180" width="150" height="4" rx="2" fill="url(#metalH-${u})"/>`; },
    cama_capsula: (c) => { const u = c.uid; return sombra(c, 102, 248, 90, 9) +
      `<path d="M18 244 L18 204 Q18 176 54 172 L150 172 Q186 176 186 204 L186 244Z" fill="url(#metal-${u})" stroke="#8a94a8"/>` +
      `<path d="M30 236 L30 208 Q30 186 58 184 L146 184 Q174 186 174 208 L174 236Z" fill="url(#dark-${u})"/>` +
      `<rect x="40" y="214" width="124" height="18" rx="7" fill="url(#sheet-${u})"/><rect x="40" y="222" width="124" height="10" rx="4" fill="url(#fabric-${u})"/>` +
      `<rect x="44" y="206" width="30" height="11" rx="5" fill="#fff"/>` +
      `<path d="M30 208 Q30 186 58 184 L146 184 Q174 186 174 208" fill="url(#glass-${u})"/>` +
      `<path d="M50 190 Q100 182 150 190" stroke="#fff" stroke-width="2" opacity=".6" fill="none"/>` +
      `<rect x="36" y="196" width="128" height="2" fill="#7fd4ff" filter="url(#glow-${u})" opacity=".9"/>` +
      `<circle cx="172" cy="240" r="2.5" fill="#4cc38a" filter="url(#glow-${u})"/><circle cx="164" cy="240" r="2.5" fill="#f0a33c"/>`; },
    cama_saco_iss: (c) => { const u = c.uid; return sombra(c, 64, 232, 30, 5, .25) +
      `<rect x="34" y="70" width="64" height="150" rx="4" fill="#cfd6e2" stroke="#9aa3b3"/>` +            // panel de anclaje
      `<path d="M44 92 Q66 78 88 92 L90 206 Q66 216 42 206Z" fill="url(#fabric-${u})" stroke="#2c4682"/>` +
      `<ellipse cx="66" cy="100" rx="16" ry="12" fill="#2c4682"/><ellipse cx="66" cy="102" rx="10" ry="7" fill="#0d1a33"/>` +
      `<path d="M66 112 V202" stroke="#e0b25a" stroke-width="1.6" stroke-dasharray="2 2"/>` +
      [126, 162, 192].map((y) => `<rect x="40" y="${y}" width="52" height="5" rx="2" fill="#f0a33c"/><rect x="62" y="${y - 1}" width="8" height="7" fill="#8a94a8"/>`).join('') +
      `<path d="M50 130 q16 6 32 0 M50 170 q16 6 32 0" stroke="#203a73" fill="none"/>` +
      box(110, 222, 60, 18, 14, `url(#metal-${u})`, '#eef1f6', '#b5bdca') +
      `<rect x="118" y="228" width="44" height="3" fill="#8a94a8"/>`; },
    cama_crater: (c) => { const u = c.uid; return sombra(c, 104, 240, 92, 12, .4) +
      `<ellipse cx="104" cy="226" rx="86" ry="22" fill="#6b7284"/><ellipse cx="104" cy="222" rx="80" ry="18" fill="#9aa1b1"/>` +
      `<ellipse cx="104" cy="220" rx="70" ry="14" fill="#4a5163"/>` +
      `<ellipse cx="104" cy="218" rx="64" ry="11" fill="#e0b25a"/><path d="M44 218 Q104 236 164 218" fill="#c8963e"/>` +
      `<ellipse cx="104" cy="216" rx="60" ry="8" fill="url(#rock-${u})" opacity=".5"/>` +
      `<ellipse cx="62" cy="210" rx="16" ry="7" fill="#fff"/><ellipse cx="84" cy="208" rx="14" ry="6" fill="#f4e1b8"/>` +
      `<path d="M30 226 Q104 252 178 226" stroke="#c9cfdb" stroke-width="1.5" fill="none" opacity=".6"/>`; },

    // ---------------- escritorios (contra la pared del fondo, a la derecha)
    escritorio_estandar: (c) => { const u = c.uid; return sombra(c, 262, 214, 66, 7, .3) +
      `<rect x="214" y="168" width="4" height="44" fill="#6b7488"/><rect x="304" y="168" width="4" height="44" fill="#6b7488"/>` +
      box(208, 162, 104, 6, 22, '#c9cfdb', `url(#metal-${u})`, '#9aa3b3') +
      `<path d="M244 156 L276 156 L280 160 L240 160Z" fill="#2e3444"/><path d="M246 156 L250 130 L280 130 L276 156Z" fill="url(#screen-${u})" stroke="#2e3444"/>` +
      `<path d="M252 150 l6-6 5 3 7-8 6 4" stroke="#7fd4ff" fill="none"/>` +
      `<rect x="288" y="150" width="12" height="9" rx="2" fill="#fff" opacity=".9"/>` +                     // taza
      // silla
      sombra(c, 262, 236, 22, 4) + `<rect x="258" y="210" width="6" height="22" fill="#4a5163"/>` +
      `<path d="M244 234 h36" stroke="#2e3444" stroke-width="3" stroke-linecap="round"/>` +
      box(244, 200, 36, 8, 18, '#2c4682', '#3d5fa8', '#203a73') +
      `<rect x="246" y="172" width="32" height="26" rx="5" fill="url(#fabric-${u})"/>`; },
    escritorio_consola: (c) => { const u = c.uid; return sombra(c, 264, 214, 74, 8, .35) +
      `<path d="M202 212 L202 180 L214 162 L314 162 L326 180 L326 212Z" fill="url(#dark-${u})" stroke="#4a5163"/>` +
      `<path d="M214 162 L314 162 L320 152 L220 152Z" fill="#2e3444"/>` +
      `<rect x="216" y="170" width="96" height="10" rx="2" fill="#0b1120"/>` +
      ['#e2462c', '#4cc38a', '#f0a33c', '#7fd4ff', '#4cc38a', '#e2462c', '#f0a33c'].map((col, i) => `<circle cx="${222 + i * 14}" cy="175" r="2.6" fill="${col}" filter="url(#glow-${u})"/>`).join('') +
      `<rect x="224" y="188" width="80" height="4" rx="2" fill="#8a94a8"/>` +
      [[218, 116, 44], [266, 112, 50]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="34" rx="2" fill="#2e3444"/><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="28" fill="url(#screen-${u})"/>`).join('') +
      `<path d="M224 140 l8-10 6 5 8-11 8 7" stroke="#4cc38a" fill="none" stroke-width="1.5"/><circle cx="291" cy="129" r="9" fill="none" stroke="#7fd4ff"/><path d="M282 129 h18 M291 120 v18" stroke="#7fd4ff" stroke-width=".7"/>` +
      `<rect x="214" y="146" width="100" height="6" fill="#2e3444"/>` +
      sombra(c, 264, 238, 24, 4) + `<rect x="261" y="214" width="6" height="20" fill="#4a5163"/>` +
      box(246, 204, 36, 8, 18, '#e2462c', '#f06a50', '#a8331e') + `<rect x="248" y="178" width="32" height="26" rx="6" fill="#2e3444"/>`; },
    escritorio_laboratorio: (c) => { const u = c.uid; return sombra(c, 264, 214, 70, 7, .3) +
      box(208, 166, 110, 46, 20, `url(#metal-${u})`, '#fbfcfe', '#c3cad6') +
      [0, 1, 2].map((i) => `<rect x="${214 + i * 34}" y="174" width="30" height="16" rx="1" fill="#e9edf3" stroke="#b5bdca"/><rect x="${224 + i * 34}" y="181" width="10" height="2" fill="#8a94a8"/>`).join('') +
      `<rect x="214" y="194" width="98" height="14" rx="1" fill="#e9edf3" stroke="#b5bdca"/>` +
      // microscopio
      `<path d="M232 164 h22 v-4 h-22z" fill="#2e3444"/><path d="M240 160 v-20 q0-6 6-6 h4 v8 h-4 v18z" fill="#3a4357"/><rect x="242" y="124" width="7" height="14" rx="2" transform="rotate(-20 245 131)" fill="#171c28"/><rect x="236" y="150" width="14" height="3" fill="#8a94a8"/>` +
      // matraces
      `<path d="M276 164 l5-14 v-8 h6 v8 l5 14z" fill="url(#glass-${u})" stroke="#7fa7c4"/><path d="M278 162 l3-8 h10 l3 8z" fill="#4cc38a" opacity=".7"/>` +
      `<rect x="298" y="146" width="6" height="18" rx="3" fill="url(#glass-${u})" stroke="#7fa7c4"/><rect x="298" y="156" width="6" height="8" rx="3" fill="#e2462c" opacity=".7"/>` +
      `<ellipse cx="262" cy="163" rx="8" ry="2.5" fill="#c9cfdb"/><ellipse cx="260" cy="161" rx="3" ry="2" fill="#6b5a4a"/>`; },
    escritorio_holo: (c) => { const u = c.uid; return sombra(c, 264, 222, 56, 8, .4) +
      `<ellipse cx="264" cy="216" rx="40" ry="8" fill="#2e3444"/><rect x="256" y="176" width="16" height="40" fill="url(#metalH-${u})"/>` +
      `<ellipse cx="264" cy="174" rx="50" ry="11" fill="url(#metal-${u})" stroke="#8a94a8"/><ellipse cx="264" cy="172" rx="40" ry="7" fill="#1a2235"/>` +
      `<ellipse cx="264" cy="172" rx="30" ry="5" fill="#7fd4ff" opacity=".6" filter="url(#glow-${u})"/>` +
      `<path d="M236 170 L248 112 L280 112 L292 170Z" fill="url(#holo-${u})" opacity=".35"/>` +
      `<circle cx="264" cy="132" r="18" fill="url(#holo-${u})"/><circle cx="264" cy="132" r="16" fill="none" stroke="#9be3ff"/>` +
      `<ellipse cx="264" cy="132" rx="16" ry="6" fill="none" stroke="#9be3ff" opacity=".8"/><ellipse cx="264" cy="132" rx="6" ry="16" fill="none" stroke="#9be3ff" opacity=".8"/>` +
      `<circle cx="276" cy="124" r="2" fill="#fff" filter="url(#glow-${u})"/>`; },

    // ---------------- pared izquierda del fondo
    poster_luna: (c) => cuadro(c, 98, 50, 70, 88, `<rect x="104" y="56" width="58" height="76" fill="#05070f"/>${estrellas(104, 56, 58, 50, 12)}<circle cx="133" cy="88" r="21" fill="url(#moonG-${c.uid})"/><circle cx="126" cy="82" r="4" fill="#aab2c2" opacity=".7"/><circle cx="140" cy="94" r="6" fill="#aab2c2" opacity=".7"/><circle cx="137" cy="78" r="2.5" fill="#aab2c2" opacity=".7"/><text x="133" y="126" text-anchor="middle" font-size="7" fill="#fff" font-family="monospace" letter-spacing="1">POLO SUR</text>`),
    poster_marte: (c) => cuadro(c, 98, 50, 70, 88, `<rect x="104" y="56" width="58" height="76" fill="#1a0b07"/>${estrellas(104, 56, 58, 50, 10)}<circle cx="133" cy="88" r="21" fill="url(#marsG-${c.uid})"/><path d="M114 86 q10 4 19 0 t19 0" stroke="#7a2c14" stroke-width="2" fill="none" opacity=".7"/><path d="M122 72 a21 21 0 0 1 22 0" stroke="#fff" stroke-width="2.5" fill="none" opacity=".8"/><text x="133" y="126" text-anchor="middle" font-size="7" fill="#fff" font-family="monospace" letter-spacing="1">JEZERO</text>`),
    ventana_tierra: (c) => { const u = c.uid; return `<circle cx="128" cy="92" r="44" fill="url(#metalH-${u})"/><circle cx="128" cy="92" r="38" fill="#6b7488"/><circle cx="128" cy="92" r="34" fill="#02040a"/>` +
      `<clipPath id="port-${u}"><circle cx="128" cy="92" r="34"/></clipPath><g clip-path="url(#port-${u})">${estrellas(94, 58, 68, 68, 18)}<circle cx="146" cy="112" r="30" fill="#2f6fd0" opacity=".35" filter="url(#blur-${u})"/><circle cx="146" cy="112" r="26" fill="url(#earth-${u})"/>` +
      `<path d="M128 104 c8 2 6 10 14 10 s10 8 4 12 M150 96 c4 4 12 2 12 8" stroke="#5cb85c" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/><path d="M124 118 q12 6 24 -2" stroke="#fff" stroke-width="3" opacity=".7" fill="none"/></g>` +
      `<path d="M104 72 a34 34 0 0 1 30 -14" stroke="#fff" stroke-width="3" opacity=".35" fill="none"/>` +
      Array.from({length: 8}, (_, i) => { const a = i * Math.PI / 4; return `<circle cx="${128 + Math.cos(a) * 41}" cy="${92 + Math.sin(a) * 41}" r="2.4" fill="#4a5163"/>`; }).join(''); },

    // ---------------- pared derecha del fondo
    estanteria_rocas: (c) => { const u = c.uid; return [62, 100].map((y) => sombra(c, 272, y + 6, 44, 2, .25) + box(228, y, 88, 5, 10, `url(#metal-${u})`, '#eef1f6', '#9aa3b3')).join('') +
      [[240, 56, 10, 7, '#5a5f6b'], [262, 57, 8, 6, '#b9542e'], [286, 55, 11, 8, '#d8d2c4'], [306, 57, 6, 5, '#2b2f38'], [242, 94, 12, 7, '#2b2f38'], [270, 95, 9, 6, '#c9b37a']].map(([x, y, rx, ry, col]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${col}"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#rock-${u})"/>`).join('') +
      `<rect x="292" y="84" width="14" height="16" rx="1" fill="url(#glass-${u})" stroke="#7fa7c4"/><rect x="294" y="92" width="10" height="7" fill="#8e7a5a"/><rect x="292" y="82" width="14" height="3" fill="#e2462c"/>`; },
    bandera_base: (c) => sombra(c, 274, 112, 34, 3, .2) + `<rect x="236" y="44" width="3" height="86" fill="#8a94a8"/>` +
      `<path d="M239 48 Q260 44 276 49 T312 48 L312 70 Q296 72 276 70 T239 70Z" fill="${c.color1}"/><path d="M239 70 Q260 66 276 71 T312 70 L312 92 Q296 94 276 92 T239 92Z" fill="${c.color2}"/>` +
      `<path d="M239 48 Q260 44 276 49 T312 48 L312 92 Q296 94 276 92 T239 92Z" fill="url(#rock-${c.uid})" opacity=".35"/><circle cx="275" cy="70" r="7" fill="#fff"/>`,
    reloj_mision: (c) => `<rect x="230" y="58" width="86" height="36" rx="4" fill="url(#dark-${c.uid})" stroke="#8a94a8" stroke-width="2"/><rect x="236" y="64" width="74" height="24" fill="#05070f"/>` +
      `<text x="273" y="81" text-anchor="middle" font-size="13" fill="#ff5a3c" font-family="monospace" filter="url(#glow-${c.uid})">T+042:17</text>` +
      `<text x="273" y="104" text-anchor="middle" font-size="6.5" fill="#6b7488" font-family="monospace" letter-spacing="1">TIEMPO DE MISIÓN</text>`,

    // ---------------- rincón del suelo (delante a la derecha)
    planta_hidroponica: (c) => { const u = c.uid; return sombra(c, 362, 250, 28, 5) +
      box(338, 216, 48, 32, 14, `url(#metal-${u})`, '#f4f6fa', '#aeb6c4') + `<rect x="338" y="222" width="48" height="5" fill="#4cc38a" opacity=".8"/>` +
      [[-20, -46], [-6, -58], [10, -50], [22, -36], [-28, -30]].map(([dx, dy]) => `<path d="M362 216 Q${362 + dx / 2} ${216 + dy / 2} ${362 + dx} ${216 + dy}" stroke="#2e7d32" stroke-width="2" fill="none"/><ellipse cx="${362 + dx}" cy="${216 + dy}" rx="7" ry="4" transform="rotate(${dx * 2} ${362 + dx} ${216 + dy})" fill="url(#leaf-${u})"/>`).join('') +
      `<rect x="334" y="146" width="56" height="5" rx="2" fill="#2e3444"/><rect x="340" y="150" width="44" height="3" fill="#ff7ad9" filter="url(#glow-${u})" opacity=".8"/><path d="M340 153 L330 214 H394 L384 153Z" fill="#ff7ad9" opacity=".07"/>`; },
    maqueta_rover: (c) => { const u = c.uid; return sombra(c, 364, 248, 30, 5) +
      box(338, 236, 52, 10, 10, '#2e3444', '#4a5163', '#1a2235') +
      box(344, 218, 40, 10, 10, `url(#metal-${u})`, '#f4f6fa', '#aeb6c4') + `<rect x="348" y="214" width="32" height="4" fill="#1f3c88"/>` +
      `<path d="M376 214 v-16" stroke="#6b7488" stroke-width="2"/><rect x="370" y="192" width="14" height="7" rx="1" fill="#2e3444"/><circle cx="381" cy="195.5" r="2" fill="#7fd4ff"/>` +
      [348, 364, 380].map((x) => `<circle cx="${x}" cy="232" r="5.5" fill="#171c28"/><circle cx="${x}" cy="232" r="2" fill="#8a94a8"/>`).join(''); },
    telescopio: (c) => { const u = c.uid; return sombra(c, 362, 250, 26, 4) +
      `<path d="M362 200 L344 250 M362 200 L380 250 M362 200 L362 252" stroke="#4a5163" stroke-width="2.5"/>` +
      `<g transform="rotate(-32 362 196)"><rect x="330" y="188" width="56" height="14" rx="3" fill="url(#metal-${u})" stroke="#8a94a8"/><rect x="384" y="186" width="8" height="18" rx="2" fill="#2e3444"/><rect x="324" y="191" width="8" height="8" fill="#2e3444"/></g>` +
      `<circle cx="362" cy="198" r="4" fill="#2e3444"/>`; },

    // ---------------- techo
    lampara_orbital: (c) => { const u = c.uid; return `<path d="M120 36 L280 36 L340 220 L60 220Z" fill="url(#lamp-${u})"/>` +
      `<line x1="200" y1="4" x2="200" y2="26" stroke="#6b7488" stroke-width="2"/><ellipse cx="200" cy="32" rx="30" ry="9" fill="url(#metal-${u})" stroke="#8a94a8"/>` +
      `<ellipse cx="200" cy="37" rx="22" ry="4" fill="#fff6d8" filter="url(#glow-${u})"/>`; },
    satelite_colgante: (c) => { const u = c.uid; return `<line x1="200" y1="4" x2="200" y2="34" stroke="#6b7488" stroke-width="1.2"/>` +
      box(190, 34, 20, 18, 8, '#e0b25a', '#f0ca78', '#b48a3a') +
      [[148, 1], [214, 1]].map(([x]) => `<rect x="${x}" y="37" width="38" height="12" fill="#1f3c88" stroke="#9ab" stroke-width=".8"/><path d="M${x + 9.5} 37 v12 M${x + 19} 37 v12 M${x + 28.5} 37 v12 M${x} 43 h38" stroke="#9ab" stroke-width=".5"/>`).join('') +
      `<path d="M186 43 h4 M210 43 h4" stroke="#8a94a8"/><path d="M200 52 v8" stroke="#8a94a8"/><path d="M193 64 q7 -8 14 0" fill="#eef1f6" stroke="#8a94a8"/>`; },

    // ---------------- alfombra (suelo, en perspectiva)
    alfombra_crater: (c) => `<ellipse cx="226" cy="238" rx="86" ry="15" fill="#7c8496"/><ellipse cx="226" cy="238" rx="66" ry="11" fill="#9aa1b1"/><ellipse cx="226" cy="238" rx="40" ry="6.5" fill="#7c8496"/><ellipse cx="226" cy="237" rx="20" ry="3" fill="#6b7284"/>`,
    alfombra_hex: (c) => `<path d="M150 236 L172 222 L282 222 L304 236 L282 252 L172 252Z" fill="#0b2350"/><path d="M158 236 L176 225 L278 225 L296 236 L278 249 L176 249Z" fill="none" stroke="#e2462c" stroke-width="2"/><path d="M190 236 h74" stroke="#fff" stroke-width="1" stroke-dasharray="5 4" opacity=".7"/>`,
  };
  function cuadro(c, x, y, w, h, contenido) {
    return sombra(c, x + w / 2 + 3, y + h + 2, w / 2, 3, .25) + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f4f6fa" stroke="#aeb6c4"/>${contenido}` +
      `<path d="M${x + 6} ${y + 6} L${x + w * .55} ${y + 6} L${x + 6} ${y + h * .45}Z" fill="#fff" opacity=".12"/>`;
  }
  function estrellas(x, y, w, h, n) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<circle cx="${x + (i * 37 % w)}" cy="${y + (i * 23 % h)}" r="${i % 4 ? .5 : .9}" fill="#fff" opacity=".8"/>`;
    return s;
  }

  function habitacion(h, viewBox = '0 0 400 260') {
    const c = {uid: ++UID, color1: h.color1 || '#e7794b', color2: h.color2 || '#1b2a4a'};
    const pared = h.color_pared || '#dfe6f0', suelo = h.color_suelo || '#5b6578', u = c.uid;
    let s = defs(c) + `<defs>
      <linearGradient id="wall-${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light(pared, .12)}"/><stop offset="1" stop-color="${dark(pared, .08)}"/></linearGradient>
      <linearGradient id="wallL-${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${dark(pared, .38)}"/><stop offset="1" stop-color="${dark(pared, .16)}"/></linearGradient>
      <linearGradient id="wallR-${u}" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${dark(pared, .34)}"/><stop offset="1" stop-color="${dark(pared, .14)}"/></linearGradient>
      <linearGradient id="floor-${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dark(suelo, .2)}"/><stop offset="1" stop-color="${light(suelo, .08)}"/></linearGradient>
      <radialGradient id="vig-${u}" cx=".5" cy=".42" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
      <radialGradient id="amb-${u}" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>`;
    // estructura
    s += `<path d="M0 0 H400 L320 36 H80Z" fill="#c4cad6"/>`;                                          // techo
    s += `<path d="M120 10 H280 L268 20 H132Z" fill="#fffbe8" filter="url(#glow-${u})" opacity=".9"/>`; // luz de techo
    s += `<path d="M0 0 L80 36 V176 L0 260Z" fill="url(#wallL-${u})"/>`;
    s += `<path d="M400 0 L320 36 V176 L400 260Z" fill="url(#wallR-${u})"/>`;
    s += `<rect x="80" y="36" width="240" height="140" fill="url(#wall-${u})"/>`;
    s += `<path d="M80 176 H320 L400 260 H0Z" fill="url(#floor-${u})"/>`;
    // paneles y juntas de módulo
    s += [140, 200, 260].map((x) => `<line x1="${x}" y1="36" x2="${x}" y2="176" stroke="#000" stroke-opacity=".08"/>`).join('');
    s += `<rect x="80" y="122" width="240" height="4" fill="#000" opacity=".06"/>`;
    s += [40, 60].map((x) => `<line x1="${x}" y1="${lw(x, 0)}" x2="${x}" y2="${lw(x, 1)}" stroke="#000" stroke-opacity=".1"/>`).join('');
    s += [340, 360].map((x) => `<line x1="${x}" y1="${rw(x, 0)}" x2="${x}" y2="${rw(x, 1)}" stroke="#000" stroke-opacity=".1"/>`).join('');
    // pasamanos (típicos de las estaciones espaciales)
    s += `<path d="M6 ${lw(6, .55)} L74 ${lw(74, .55)}" stroke="#f0c040" stroke-width="3" stroke-linecap="round"/>`;
    s += `<rect x="96" y="128" width="208" height="3" rx="1.5" fill="#f0c040" opacity=".85"/>`;
    // juntas del suelo hacia el punto de fuga
    s += [80, 120, 160, 200, 240, 280, 320].map((x) => `<line x1="${x}" y1="176" x2="${200 + (x - 200) * 2.2}" y2="260" stroke="#000" stroke-opacity=".12"/>`).join('');
    s += [190, 208, 232].map((y) => { const t = (y - 106) / 70; return `<line x1="${200 - 120 * t}" y1="${y}" x2="${200 + 120 * t}" y2="${y}" stroke="#000" stroke-opacity=".1"/>`; }).join('');
    s += `<path d="M80 176 H320" stroke="#000" stroke-opacity=".25"/>`;
    // escotilla en la pared derecha
    const hx1 = 346, hx2 = 384;
    s += `<path d="M${hx1} ${rw(hx1, .2)} L${hx2} ${rw(hx2, .18)} L${hx2} ${rw(hx2, .82)} L${hx1} ${rw(hx1, .9)}Z" fill="#b8bfcc" stroke="#7c8496" stroke-width="2"/>`;
    s += `<path d="M${hx1 + 6} ${rw(hx1 + 6, .3)} L${hx2 - 6} ${rw(hx2 - 6, .28)} L${hx2 - 6} ${rw(hx2 - 6, .74)} L${hx1 + 6} ${rw(hx1 + 6, .8)}Z" fill="#9aa1b1"/>`;
    s += `<circle cx="${(hx1 + hx2) / 2}" cy="${rw((hx1 + hx2) / 2, .52)}" r="5" fill="none" stroke="#e2462c" stroke-width="2"/>`;
    // rejilla de ventilación en la pared izquierda
    s += `<path d="M18 ${lw(18, .2)} L50 ${lw(50, .22)} L50 ${lw(50, .34)} L18 ${lw(18, .34)}Z" fill="#000" opacity=".15"/>`;
    // placa con número, sobre la escotilla
    const pc = (hx1 + hx2) / 2, py = rw(pc, .36);
    s += `<rect x="${pc - 15}" y="${py - 9}" width="30" height="18" rx="2" fill="#0b2350" opacity=".9"/><text x="${pc}" y="${py - 1.5}" text-anchor="middle" font-size="6" fill="#fff" font-family="monospace">HAB ${String(h.numero || 1).padStart(2, '0')}</text><text x="${pc}" y="${py + 6}" text-anchor="middle" font-size="5.5" fill="#9fb3d9" font-family="monospace">PLANTA ${h.planta || 1}</text>`;
    // contenido: de atrás hacia delante
    const d = h.decoraciones || {};
    for (const hueco of ['pared_izq', 'pared_der']) if (d[hueco] && M[d[hueco]]) s += M[d[hueco]](c);
    if (d.alfombra && M[d.alfombra]) s += M[d.alfombra](c);
    if (M[h.escritorio]) s += M[h.escritorio](c);
    if (M[h.cama]) s += M[h.cama](c);
    if (d.suelo && M[d.suelo]) s += M[d.suelo](c);
    if (d.techo && M[d.techo]) s += M[d.techo](c);
    // iluminación ambiental y viñeteado
    s += `<rect width="400" height="260" fill="url(#amb-${u})"/><rect width="400" height="260" fill="url(#vig-${u})"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Habitación ${h.numero || ''}">${s}</svg>`;
  }

  // Miniatura de un mueble: la habitación vacía con solo ese objeto, recortada a su zona
  const ZONA = {
    cama: '0 150 210 110', escritorio: '186 96 160 140', pared_izq: '80 40 100 110', pared_der: '220 38 106 80',
    suelo: '318 140 82 120', techo: '120 0 160 90', alfombra: '130 210 196 50'
  };
  function mueble(clave, tipo, hueco, colores = {color1: '#e7794b', color2: '#1b2a4a'}) {
    const h = {color1: colores.color1, color2: colores.color2, color_pared: colores.color_pared, color_suelo: colores.color_suelo, numero: 0, decoraciones: {}};
    if (tipo === 'cama') h.cama = clave; else if (tipo === 'escritorio') h.escritorio = clave; else h.decoraciones[hueco] = clave;
    return habitacion(h, ZONA[tipo === 'decoracion' ? hueco : tipo]);
  }

  // ------------------------------------------------------------ merchandising
  function parche(r = 60, cx = 70, cy = 70) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${NAVY}" stroke="${RED}" stroke-width="${r * .1}"/>
      <circle cx="${cx}" cy="${cy}" r="${r * .82}" fill="none" stroke="${WHITE}" stroke-width="1"/>
      <circle cx="${cx - r * .28}" cy="${cy + r * .05}" r="${r * .3}" fill="#e9ecf2"/><circle cx="${cx - r * .36}" cy="${cy}" r="${r * .06}" fill="#c9cfdb"/><circle cx="${cx - r * .2}" cy="${cy + r * .14}" r="${r * .08}" fill="#c9cfdb"/>
      <circle cx="${cx + r * .34}" cy="${cy - r * .2}" r="${r * .16}" fill="#d4643a"/>
      <path d="M${cx - r * .7} ${cy + r * .42} Q${cx} ${cy + r * .1} ${cx + r * .62} ${cy - r * .36}" stroke="${RED}" stroke-width="${r * .05}" fill="none" stroke-dasharray="${r * .08} ${r * .06}"/>
      <path d="M${cx - r * .62} ${cy + r * .56} Q${cx} ${cy + r * .78} ${cx + r * .62} ${cy + r * .56}" fill="none" stroke="${WHITE}" stroke-width="${r * .02}"/>
      <text x="${cx}" y="${cy - r * .5}" text-anchor="middle" font-size="${r * .17}" font-weight="700" fill="${WHITE}" font-family="Arial, sans-serif" letter-spacing="1">MOONSITEUA</text>
      <text x="${cx}" y="${cy + r * .72}" text-anchor="middle" font-size="${r * .1}" fill="${WHITE}" font-family="Arial, sans-serif" letter-spacing="1">ROVER HUMANO</text>`;
  }
  const P = {
    pegatinas: () => `<rect width="140" height="140" fill="#eef1f6"/><g transform="rotate(-8 50 50)"><circle cx="45" cy="45" r="28" fill="${WHITE}" stroke="#ccd"/>${inner(moneda('moon'), 21, 21, 48)}</g><g transform="rotate(10 95 50)"><circle cx="98" cy="48" r="28" fill="${WHITE}" stroke="#ccd"/>${inner(moneda('mars'), 74, 24, 48)}</g><rect x="22" y="80" width="96" height="46" rx="10" fill="${WHITE}" stroke="#ccd"/><text x="70" y="102" text-anchor="middle" font-size="11" font-weight="700" fill="${NAVY}" font-family="Arial">ROVER</text><text x="70" y="116" text-anchor="middle" font-size="11" font-weight="700" fill="${RED}" font-family="Arial">HUMANO</text>`,
    pin_luna: () => `<rect width="140" height="140" fill="#eef1f6"/><circle cx="70" cy="70" r="48" fill="#c9a43a"/><circle cx="70" cy="70" r="42" fill="${NAVY}"/><circle cx="70" cy="70" r="30" fill="#e9ecf2"/><path d="M70 40 a30 30 0 0 0 0 60 a14 30 0 0 1 0 -60z" fill="#2b3245" opacity=".85"/><circle cx="62" cy="62" r="5" fill="#c9cfdb"/><circle cx="80" cy="66" r="7" fill="#c9cfdb"/><text x="70" y="128" text-anchor="middle" font-size="10" fill="${NAVY}" font-family="monospace">POLO SUR</text>`,
    pin_marte: () => `<rect width="140" height="140" fill="#eef1f6"/><circle cx="70" cy="70" r="48" fill="#c9a43a"/><circle cx="70" cy="70" r="42" fill="#2a1410"/><circle cx="70" cy="70" r="30" fill="#d4643a"/><path d="M56 62 l10 8 -4 10 m4 -10 l12 4" stroke="#8e3a20" stroke-width="3" fill="none"/><circle cx="70" cy="70" r="12" fill="none" stroke="#a8432a" stroke-width="2"/><text x="70" y="128" text-anchor="middle" font-size="10" fill="${NAVY}" font-family="monospace">JEZERO</text>`,
    parche_mision: () => `<rect width="140" height="140" fill="#eef1f6"/>${parche()}`,
    taza: () => `<rect width="140" height="140" fill="#eef1f6"/><path d="M98 52 h10 a16 16 0 0 1 0 32 h-10" fill="none" stroke="${WHITE}" stroke-width="7"/><path d="M98 52 h10 a16 16 0 0 1 0 32 h-10" fill="none" stroke="#ccd" stroke-width="1"/><rect x="30" y="36" width="70" height="80" rx="8" fill="${WHITE}" stroke="#ccd"/><rect x="30" y="36" width="70" height="10" rx="4" fill="${NAVY}"/>${radarMini(65, 82, 22)}`,
    gorra: () => `<rect width="140" height="140" fill="#eef1f6"/><path d="M28 88 a42 40 0 0 1 84 0z" fill="${NAVY}"/><path d="M24 88 h96 q14 2 6 10 h-102z" fill="#08183a"/><circle cx="70" cy="48" r="3" fill="${NAVY}"/>${'<g transform="translate(46 50) scale(.34)">' + parche(60, 70, 70) + '</g>'}`,
    camiseta: () => `<rect width="140" height="140" fill="#eef1f6"/><path d="M42 26 l-26 16 10 22 14 -6 v62 h60 v-62 l14 6 10 -22 -26 -16 q-14 12 -28 0z" fill="${NAVY}"/><g transform="translate(46 44) scale(.34)">${parche(60, 70, 70)}</g><text x="70" y="104" text-anchor="middle" font-size="6.5" fill="${WHITE}" font-family="Arial" letter-spacing=".5">ROVER HUMANO</text>`,
    sudadera: () => `<rect width="140" height="140" fill="#eef1f6"/><path d="M50 22 q20 -14 40 0 l26 14 12 40 -14 4 -6 -18 v62 h-76 v-62 l-6 18 -14 -4 12 -40z" fill="#1d2b45"/><path d="M54 22 q16 16 32 0" fill="none" stroke="#0e1628" stroke-width="5"/><rect x="48" y="100" width="44" height="14" rx="3" fill="#16223a"/><text x="70" y="70" text-anchor="middle" font-size="8" font-weight="700" fill="${RED}" font-family="Arial">EXPEDICIÓN</text><text x="70" y="82" text-anchor="middle" font-size="5.5" fill="${WHITE}" font-family="Arial">LUNA · MARTE · TIERRA</text>`,
  };
  function inner(svgStr, x, y, size) { return svgStr.replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `); }
  function radarMini(cx, cy, r) {
    const pts = (vals) => vals.map((v, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 6; return `${cx + Math.cos(a) * r * v},${cy + Math.sin(a) * r * v}`; }).join(' ');
    return `<polygon points="${pts([1,1,1,1,1,1])}" fill="none" stroke="#ccd"/><polygon points="${pts([.9,.6,.8,.5,.9,.7])}" fill="${RED}" fill-opacity=".3" stroke="${RED}"/>`;
  }
  function premio(clave) { return svg(140, 140, P[clave] ? P[clave]() : '', `role="img" aria-label="${clave}"`); }

  root.Disenos = {moneda, base, habitacion, mueble, premio, parche: () => svg(140, 140, parche())};
})(typeof window !== 'undefined' ? window : globalThis);
