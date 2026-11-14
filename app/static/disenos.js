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
      `width="${size}" height="${size}" role="img" aria-label="${moon ? 'Moon Coin' : 'Marth Coin'}"`);
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

  // ------------------------------------------------------------ muebles (coordenadas de la habitación 400x260)
  const M = {
    // camas: hueco izquierdo del suelo (x 24-170, base y 230)
    cama_estandar: () => `<rect x="30" y="196" width="130" height="30" rx="4" fill="${HULL}" stroke="${STEEL}" stroke-width="2"/><rect x="30" y="188" width="130" height="12" rx="4" fill="#5d7fb8"/><rect x="36" y="180" width="34" height="12" rx="5" fill="${WHITE}"/><rect x="34" y="226" width="6" height="6" fill="${STEEL}"/><rect x="150" y="226" width="6" height="6" fill="${STEEL}"/>`,
    cama_capsula: () => `<rect x="26" y="160" width="140" height="70" rx="30" fill="${WHITE}" stroke="${STEEL}" stroke-width="2"/><rect x="40" y="172" width="112" height="44" rx="20" fill="${NAVY}"/><rect x="48" y="196" width="96" height="14" rx="6" fill="#5d7fb8"/><circle cx="60" cy="184" r="4" fill="#7fc3e8"/><circle cx="72" cy="184" r="4" fill="#5cb85c"/>`,
    cama_saco_iss: () => `<line x1="40" y1="120" x2="40" y2="230" stroke="${STEEL}" stroke-width="3"/><rect x="46" y="128" width="46" height="96" rx="20" fill="#3b6fd6" stroke="${NAVY}" stroke-width="2"/><circle cx="69" cy="146" r="12" fill="#f0c9a8"/><path d="M50 170h38" stroke="${NAVY}" stroke-width="2"/><rect x="100" y="200" width="60" height="26" rx="3" fill="${HULL}"/>`,
    cama_crater: () => `<ellipse cx="96" cy="214" rx="72" ry="18" fill="#8e94a3"/><ellipse cx="96" cy="208" rx="62" ry="13" fill="#b9bfcc"/><ellipse cx="96" cy="204" rx="50" ry="9" fill="#e0b25a"/><circle cx="62" cy="200" r="8" fill="${WHITE}"/>`,
    // escritorios: hueco derecho (x 215-335)
    escritorio_estandar: () => `<rect x="215" y="180" width="110" height="8" fill="${STEEL}"/><rect x="222" y="188" width="6" height="42" fill="${STEEL}"/><rect x="312" y="188" width="6" height="42" fill="${STEEL}"/><rect x="250" y="160" width="40" height="20" rx="2" fill="${DARK}"/><rect x="254" y="164" width="32" height="12" fill="#7fc3e8"/>`,
    escritorio_consola: () => `<path d="M212 230 V196 L226 176 H324 L336 196 V230Z" fill="${NAVY}" stroke="${STEEL}" stroke-width="2"/><rect x="232" y="182" width="86" height="12" fill="#0f1730"/>${[0,1,2,3,4,5].map(i => `<circle cx="${238 + i * 15}" cy="188" r="3" fill="${['#e2462c','#5cb85c','#f0a33c','#7fc3e8','#5cb85c','#e2462c'][i]}"/>`).join('')}<rect x="236" y="140" width="80" height="34" rx="3" fill="${DARK}"/><path d="M242 166 l14-14 12 8 16-16 16 10" stroke="#5cb85c" stroke-width="2" fill="none"/>`,
    escritorio_laboratorio: () => `<rect x="214" y="184" width="118" height="10" fill="${WHITE}" stroke="${STEEL}"/><rect x="220" y="194" width="106" height="36" fill="${HULL}" stroke="${STEEL}"/><path d="M226 210h40M286 210h34" stroke="${STEEL}"/><path d="M240 184 v-26 h8 v-12 h6 v38" fill="none" stroke="${DARK}" stroke-width="3"/><circle cx="244" cy="160" r="6" fill="${DARK}"/><path d="M290 184 l6 -22 h10 l6 22z" fill="#7fc3e8" opacity=".8"/>`,
    escritorio_holo: () => `<ellipse cx="275" cy="226" rx="52" ry="7" fill="${DARK}"/><rect x="268" y="196" width="14" height="30" fill="${STEEL}"/><ellipse cx="275" cy="194" rx="44" ry="8" fill="${HULL}" stroke="${STEEL}"/><path d="M245 190 L260 140 H290 L305 190Z" fill="#7fc3e8" opacity=".25"/><circle cx="275" cy="160" r="14" fill="none" stroke="#7fc3e8" stroke-width="1.5"/><ellipse cx="275" cy="160" rx="14" ry="5" fill="none" stroke="#7fc3e8"/>`,
    // decoraciones: pared izquierda (x 40-150, y 40-130)
    poster_luna: () => `<rect x="60" y="44" width="72" height="90" fill="${NAVY}" stroke="${WHITE}" stroke-width="3"/><circle cx="96" cy="80" r="22" fill="#e9ecf2"/><circle cx="88" cy="74" r="4" fill="#c9cfdb"/><circle cx="102" cy="88" r="6" fill="#c9cfdb"/><text x="96" y="124" text-anchor="middle" font-size="9" fill="#fff" font-family="monospace">POLO SUR</text>`,
    poster_marte: () => `<rect x="60" y="44" width="72" height="90" fill="#2a1410" stroke="${WHITE}" stroke-width="3"/><circle cx="96" cy="80" r="22" fill="#d4643a"/><path d="M76 78c8 3 14-3 20 0s12 4 18 0" stroke="#a8432a" stroke-width="3" fill="none"/><text x="96" y="124" text-anchor="middle" font-size="9" fill="#fff" font-family="monospace">JEZERO</text>`,
    ventana_tierra: () => `<circle cx="96" cy="86" r="42" fill="${STEEL}"/><circle cx="96" cy="86" r="34" fill="#05070f"/><circle cx="104" cy="94" r="18" fill="#3d7bd9"/><path d="M94 86c6 4 4 10 12 10s8 8 2 10" stroke="#5cb85c" stroke-width="4" fill="none"/>${[0,1,2,3,4,5,6,7].map(i => { const a = i * Math.PI / 4; return `<circle cx="${96 + Math.cos(a) * 38}" cy="${86 + Math.sin(a) * 38}" r="2.4" fill="${HULL}"/>`; }).join('')}`,
    // pared derecha (x 250-360, y 40-130)
    estanteria_rocas: () => `<rect x="262" y="52" width="96" height="6" fill="${STEEL}"/><rect x="262" y="94" width="96" height="6" fill="${STEEL}"/><ellipse cx="280" cy="46" rx="10" ry="7" fill="#5a5f6b"/><ellipse cx="306" cy="47" rx="8" ry="6" fill="#b9542e"/><ellipse cx="334" cy="45" rx="11" ry="8" fill="#d8d2c4"/><ellipse cx="284" cy="88" rx="12" ry="7" fill="#2b2f38"/><ellipse cx="318" cy="89" rx="9" ry="6" fill="#c9b37a"/><rect x="336" y="78" width="12" height="16" fill="#7fc3e8" opacity=".7"/>`,
    bandera_base: (h) => `<line x1="276" y1="40" x2="276" y2="140" stroke="${STEEL}" stroke-width="3"/><rect x="278" y="44" width="70" height="22" fill="${h.color1}"/><rect x="278" y="66" width="70" height="22" fill="${h.color2}"/><circle cx="313" cy="66" r="8" fill="${WHITE}"/>`,
    reloj_mision: () => `<rect x="262" y="58" width="96" height="40" rx="4" fill="${DARK}" stroke="${STEEL}" stroke-width="2"/><text x="310" y="84" text-anchor="middle" font-size="16" fill="#e2462c" font-family="monospace">T+042:17</text><text x="310" y="112" text-anchor="middle" font-size="8" fill="${STEEL}" font-family="monospace">TIEMPO DE MISIÓN</text>`,
    // suelo (x 340-396)
    planta_hidroponica: () => `<rect x="346" y="204" width="40" height="26" rx="3" fill="${WHITE}" stroke="${STEEL}"/><rect x="346" y="204" width="40" height="5" fill="#7fc3e8"/><path d="M366 204 q-14 -20 -6 -38 M366 204 q12 -18 8 -34 M366 204 q0 -24 2 -40" stroke="#4caf50" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    maqueta_rover: () => `<rect x="342" y="210" width="48" height="6" fill="${STEEL}"/><rect x="346" y="196" width="40" height="12" rx="2" fill="${WHITE}"/><line x1="378" y1="196" x2="378" y2="180" stroke="${STEEL}" stroke-width="2"/><rect x="372" y="174" width="14" height="7" fill="${DARK}"/>${[350,366,382].map(x => `<circle cx="${x}" cy="222" r="6" fill="${DARK}"/>`).join('')}`,
    telescopio: () => `<path d="M352 230 L366 196 L380 230 M366 196 V230" stroke="${STEEL}" stroke-width="3" fill="none"/><rect x="346" y="168" width="50" height="14" rx="4" transform="rotate(-30 366 190)" fill="${WHITE}" stroke="${STEEL}"/>`,
    // techo (centro)
    lampara_orbital: () => `<line x1="200" y1="18" x2="200" y2="40" stroke="${STEEL}" stroke-width="2"/><ellipse cx="200" cy="46" rx="26" ry="9" fill="${WHITE}" stroke="${STEEL}"/><ellipse cx="200" cy="52" rx="18" ry="4" fill="#ffd27a"/><path d="M182 56 L160 110 H240 L218 56Z" fill="#ffd27a" opacity=".12"/>`,
    satelite_colgante: () => `<line x1="200" y1="18" x2="200" y2="44" stroke="${STEEL}" stroke-width="1.5"/><rect x="190" y="44" width="20" height="16" fill="#e0b25a" stroke="${STEEL}"/><rect x="152" y="46" width="34" height="12" fill="#1f3c88" stroke="#9ab"/><rect x="214" y="46" width="34" height="12" fill="#1f3c88" stroke="#9ab"/><line x1="186" y1="52" x2="190" y2="52" stroke="${STEEL}"/><line x1="210" y1="52" x2="214" y2="52" stroke="${STEEL}"/>`,
    // alfombra (centro del suelo)
    alfombra_crater: () => `<ellipse cx="195" cy="238" rx="56" ry="10" fill="#8e94a3"/><ellipse cx="195" cy="238" rx="40" ry="6" fill="#a8aebb"/><ellipse cx="195" cy="238" rx="20" ry="3" fill="#8e94a3"/>`,
    alfombra_hex: () => `<path d="M150 238 l12 -9 h66 l12 9 l-12 9 h-66z" fill="${NAVY}" stroke="${RED}" stroke-width="2"/><path d="M170 238 h50" stroke="${WHITE}" stroke-width="1" stroke-dasharray="4 3"/>`,
  };

  function habitacion(h) {
    const pared = h.color_pared || '#dfe6f0', suelo = h.color_suelo || '#5b6578';
    let s = `<rect width="400" height="260" fill="${pared}"/>`;
    s += `<rect width="400" height="18" fill="${HULL}"/><path d="M0 18 H400" stroke="${STEEL}" stroke-width="2"/>`;
    s += [100, 200, 300].map(x => `<line x1="${x}" y1="18" x2="${x}" y2="180" stroke="#000" stroke-opacity=".06" stroke-width="2"/>`).join('');
    s += `<path d="M0 182 H400 V260 H0Z" fill="${suelo}"/><path d="M0 182 H400" stroke="#000" stroke-opacity=".2" stroke-width="2"/>`;
    s += [40, 120, 200, 280, 360].map(x => `<line x1="${x}" y1="182" x2="${x + (x - 200) * .3}" y2="260" stroke="#000" stroke-opacity=".08"/>`).join('');
    s += `<rect x="372" y="60" width="22" height="122" rx="3" fill="${HULL}" stroke="${STEEL}"/><circle cx="378" cy="124" r="2.4" fill="${STEEL}"/>`; // puerta
    s += `<text x="10" y="13" font-size="9" fill="${NAVY}" font-family="monospace">HAB ${String(h.numero || 1).padStart(2, '0')} · PLANTA ${h.planta || 1}</text>`;
    const d = h.decoraciones || {};
    for (const hueco of ['alfombra', 'pared_izq', 'pared_der', 'techo']) if (d[hueco] && M[d[hueco]]) s += M[d[hueco]](h);
    if (M[h.cama]) s += M[h.cama](h);
    if (M[h.escritorio]) s += M[h.escritorio](h);
    if (d.suelo && M[d.suelo]) s += M[d.suelo](h);
    return svg(400, 260, s, `role="img" aria-label="Habitación ${h.numero || ''}"`);
  }

  // Miniatura de un mueble: lo dibuja en una habitación neutra recortada a su zona
  const ZONA = {
    cama: '20 110 160 130', escritorio: '205 120 140 115', pared_izq: '40 30 120 115', pared_der: '250 30 120 115',
    suelo: '336 150 64 90', techo: '140 10 120 110', alfombra: '130 220 130 30'
  };
  function mueble(clave, tipo, hueco, colores = {color1: '#e7794b', color2: '#1b2a4a'}) {
    const vb = ZONA[tipo === 'decoracion' ? hueco : tipo] || '0 0 400 260';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${clave}"><rect x="0" y="0" width="400" height="260" fill="#eef1f6"/>${M[clave] ? M[clave](colores) : ''}</svg>`;
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
    pegatinas: () => `<rect width="140" height="140" fill="#eef1f6"/><g transform="rotate(-8 50 50)"><circle cx="45" cy="45" r="28" fill="${WHITE}" stroke="#ccd"/>${inner(moneda('moon'), 21, 21, 48)}</g><g transform="rotate(10 95 50)"><circle cx="98" cy="48" r="28" fill="${WHITE}" stroke="#ccd"/>${inner(moneda('marth'), 74, 24, 48)}</g><rect x="22" y="80" width="96" height="46" rx="10" fill="${WHITE}" stroke="#ccd"/><text x="70" y="102" text-anchor="middle" font-size="11" font-weight="700" fill="${NAVY}" font-family="Arial">ROVER</text><text x="70" y="116" text-anchor="middle" font-size="11" font-weight="700" fill="${RED}" font-family="Arial">HUMANO</text>`,
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
