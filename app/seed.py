"""Datos iniciales: regiones, zonas recomendadas, muebles, objetivos y premios.
Se ejecuta al crear la base de datos (idempotente: usa INSERT OR IGNORE)."""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ------------------------------------------------------------------ regiones
# (codigo, nombre, tipo, [codigos de los padres])
REGIONES = [
    ("EUR", "Europa", "continente", []),
    ("ASI", "Asia", "continente", []),
    ("AFR", "África", "continente", []),
    ("NAM", "América del Norte", "continente", []),
    ("SAM", "América del Sur", "continente", []),
    ("OCE", "Oceanía", "continente", []),
    ("ANT", "Antártida", "continente", []),
    ("EU", "Unión Europea", "union", ["EUR"]),
    ("ES", "España", "pais", ["EUR", "EU"]),
    ("PT", "Portugal", "pais", ["EUR", "EU"]),
    ("FR", "Francia", "pais", ["EUR", "EU"]),
    ("IT", "Italia", "pais", ["EUR", "EU"]),
    ("IS", "Islandia", "pais", ["EUR"]),
    ("US", "Estados Unidos", "pais", ["NAM"]),
    ("US-CA", "California", "estado", ["US"]),
    ("US-UT", "Utah", "estado", ["US"]),
    ("US-HI", "Hawái", "estado", ["US"]),
    ("CA", "Canadá", "pais", ["NAM"]),
    ("CA-NU", "Nunavut", "territorio", ["CA"]),
    ("CL", "Chile", "pais", ["SAM"]),
    ("CL-AN", "Antofagasta", "region", ["CL"]),
    ("IR", "Irán", "pais", ["ASI"]),
    ("IR-08", "Kerman", "provincia", ["IR"]),
    ("CN", "China", "pais", ["ASI"]),
    ("CN-QH", "Qinghai", "provincia", ["CN"]),
    ("MA", "Marruecos", "pais", ["AFR"]),
    ("AU", "Australia", "pais", ["OCE"]),
]

PROVINCIAS_ES = {
    "ES-C": "A Coruña", "ES-VI": "Álava", "ES-AB": "Albacete", "ES-A": "Alicante", "ES-AL": "Almería",
    "ES-O": "Asturias", "ES-AV": "Ávila", "ES-BA": "Badajoz", "ES-PM": "Illes Balears", "ES-B": "Barcelona",
    "ES-BI": "Bizkaia", "ES-BU": "Burgos", "ES-CC": "Cáceres", "ES-CA": "Cádiz", "ES-S": "Cantabria",
    "ES-CS": "Castellón", "ES-CR": "Ciudad Real", "ES-CO": "Córdoba", "ES-CU": "Cuenca", "ES-SS": "Gipuzkoa",
    "ES-GI": "Girona", "ES-GR": "Granada", "ES-GU": "Guadalajara", "ES-H": "Huelva", "ES-HU": "Huesca",
    "ES-J": "Jaén", "ES-LO": "La Rioja", "ES-GC": "Las Palmas", "ES-LE": "León", "ES-L": "Lleida",
    "ES-LU": "Lugo", "ES-M": "Madrid", "ES-MA": "Málaga", "ES-MU": "Murcia", "ES-NA": "Navarra",
    "ES-OR": "Ourense", "ES-P": "Palencia", "ES-PO": "Pontevedra", "ES-SA": "Salamanca",
    "ES-TF": "Santa Cruz de Tenerife", "ES-SG": "Segovia", "ES-SE": "Sevilla", "ES-SO": "Soria",
    "ES-T": "Tarragona", "ES-TE": "Teruel", "ES-TO": "Toledo", "ES-V": "Valencia", "ES-VA": "Valladolid",
    "ES-ZA": "Zamora", "ES-Z": "Zaragoza",
}
CIUDADES_AUTONOMAS = {"ES-CE": "Ceuta", "ES-ML": "Melilla"}

# Región de cada zona recomendada (id del sitio en engine/sites_demo.json)
REGION_ZONA = {
    "atacama_yungay": "CL-AN", "haughton": "CA-NU", "dry_valleys": "ANT", "timanfaya": "ES-GC",
    "rio_tinto": "ES-H", "dasht_e_lut": "IR-08", "qaidam": "CN-QH", "tabernas": "ES-AL",
    "bardenas": "ES-NA", "calatrava": "ES-CR", "sierra_nevada": "ES-GR", "cabo_gata": "ES-AL",
    "teide": "ES-TF",
}

# ------------------------------------------------------------------ muebles
# (clave, tipo, hueco, nombre, precio en Moon Coins). Precio 0 = de serie.
MUEBLES = [
    ("cama_estandar", "cama", None, "Litera de módulo", 0),
    ("cama_capsula", "cama", None, "Cápsula de descanso", 120),
    ("cama_saco_iss", "cama", None, "Saco de dormir orbital", 90),
    ("cama_crater", "cama", None, "Cama cráter", 160),
    ("escritorio_estandar", "escritorio", None, "Mesa de trabajo", 0),
    ("escritorio_consola", "escritorio", None, "Consola de misión", 150),
    ("escritorio_laboratorio", "escritorio", None, "Banco de laboratorio", 130),
    ("escritorio_holo", "escritorio", None, "Mesa holográfica", 200),
    ("poster_luna", "decoracion", "pared_izq", "Póster de la Luna", 40),
    ("poster_marte", "decoracion", "pared_izq", "Póster de Marte", 40),
    ("ventana_tierra", "decoracion", "pared_izq", "Ojo de buey con vista a la Tierra", 110),
    ("estanteria_rocas", "decoracion", "pared_der", "Estantería de muestras", 70),
    ("bandera_base", "decoracion", "pared_der", "Bandera de la base", 30),
    ("reloj_mision", "decoracion", "pared_der", "Reloj de misión", 50),
    ("planta_hidroponica", "decoracion", "suelo", "Planta hidropónica", 45),
    ("maqueta_rover", "decoracion", "suelo", "Maqueta de rover", 80),
    ("telescopio", "decoracion", "suelo", "Telescopio", 100),
    ("lampara_orbital", "decoracion", "techo", "Lámpara orbital", 35),
    ("satelite_colgante", "decoracion", "techo", "Satélite colgante", 60),
    ("alfombra_crater", "decoracion", "alfombra", "Alfombra cráter", 30),
    ("alfombra_hex", "decoracion", "alfombra", "Alfombra hexagonal", 30),
]

# ------------------------------------------------------------------ objetivos
# (clave, ambito, periodo, evento, titulo, meta, moneda, recompensa)
OBJETIVOS = [
    ("foto_diaria", "individual", "diario", "foto", "Sube una foto hoy", 1, "moon", 20),
    ("fotos_semana", "individual", "semanal", "foto", "Sube 5 fotos esta semana", 5, "moon", 60),
    ("primera_base", "individual", "unico", "unirse_base", "Funda una base o únete a una", 1, "moon", 50),
    ("decorador", "individual", "unico", "personalizar", "Personaliza tu habitación", 1, "moon", 30),
    ("pionero", "individual", "unico", "fundar", "Pionero: funda la base de una zona", 1, "marth", 2),
    ("tres_zonas", "individual", "unico", "zona_nueva", "Visita 3 zonas recomendadas distintas", 3, "marth", 3),
    ("fotos_mes_zonas", "individual", "mensual", "foto_zona", "Sube 20 fotos en zonas recomendadas este mes", 20, "marth", 3),
    ("tres_paises", "individual", "unico", "pais_nuevo", "Sube fotos en 3 países distintos", 3, "marth", 6),
    ("base_fotos_semana", "base", "semanal", "foto_base", "La base suma 10 fotos esta semana", 10, "moon", 40),
    ("base_fotos_mes", "base", "mensual", "foto_base", "La base suma 50 fotos este mes", 50, "marth", 2),
    ("base_planta_2", "base", "unico", "miembro_base", "La base llega a la planta 2 (6 miembros)", 6, "marth", 2),
    ("base_planta_5", "base", "unico", "miembro_base", "La base llega a la planta 5 (21 miembros)", 21, "marth", 5),
]

# ------------------------------------------------------------------ premios
# (clave, nombre, descripción, precio en Marth Coins, stock)
PREMIOS = [
    ("pegatinas", "Pack de pegatinas", "Seis pegatinas de vinilo: monedas, bases y los cuatro destinos.", 4, 300),
    ("pin_luna", "Pin «Polo Sur»", "Pin esmaltado de la Luna con el cráter Shackleton en sombra.", 8, 150),
    ("pin_marte", "Pin «Jezero»", "Pin esmaltado de Marte con el delta de Jezero.", 8, 150),
    ("parche_mision", "Parche de misión MoonSiteUA", "Parche bordado de 9 cm, termoadhesivo.", 12, 120),
    ("taza", "Taza de control de misión", "Taza cerámica 330 ml con el radar del Índice de Analogía.", 18, 80),
    ("gorra", "Gorra de expedición", "Gorra azul marino con el parche de misión bordado.", 25, 60),
    ("camiseta", "Camiseta «Rover humano»", "Algodón orgánico. Tallas S a XXL.", 35, 100),
    ("sudadera", "Sudadera de expedición", "Sudadera con capucha y el mapa de destinos en la espalda. Tallas S a XXL.", 60, 40),
]
CON_TALLA = {"camiseta", "sudadera"}


def seed(con: sqlite3.Connection) -> None:
    cur = con.cursor()
    for codigo, nombre, tipo, _ in REGIONES:
        cur.execute("INSERT OR IGNORE INTO regiones (codigo, nombre, tipo) VALUES (?, ?, ?)", (codigo, nombre, tipo))
    for codigo, nombre in PROVINCIAS_ES.items():
        cur.execute("INSERT OR IGNORE INTO regiones (codigo, nombre, tipo) VALUES (?, ?, 'provincia')", (codigo, nombre))
    for codigo, nombre in CIUDADES_AUTONOMAS.items():
        cur.execute("INSERT OR IGNORE INTO regiones (codigo, nombre, tipo) VALUES (?, ?, 'territorio')", (codigo, nombre))
    rid = {c: i for i, c in cur.execute("SELECT id, codigo FROM regiones")}
    padres = [(c, p) for c, _, _, ps in REGIONES for p in ps]
    padres += [(c, "ES") for c in list(PROVINCIAS_ES) + list(CIUDADES_AUTONOMAS)]
    for hijo, padre in padres:
        cur.execute("INSERT OR IGNORE INTO region_padres VALUES (?, ?)", (rid[hijo], rid[padre]))

    sites_file = ROOT / "engine" / "sites.json"
    if not sites_file.exists():
        sites_file = ROOT / "engine" / "sites_demo.json"
    for s in json.loads(sites_file.read_text(encoding="utf-8"))["sites"]:
        perfil = {k: s[k] for k in ("precip_mm", "ndvi_max", "lst_media_c", "lst_amplitud_c", "mafico_ratio",
                                    "pendiente_deg", "altitud_m", "aod", "nieve_frac")}
        cur.execute("""INSERT OR IGNORE INTO zonas (clave, nombre, lat, lon, region_id, recomendada, perfil_json, nota)
                       VALUES (?, ?, ?, ?, ?, 1, ?, ?)""",
                    (s["id"], s["nombre"], s["lat"], s["lon"], rid.get(REGION_ZONA.get(s["id"])),
                     json.dumps(perfil), s["nota"]))

    cur.executemany("INSERT OR IGNORE INTO muebles (clave, tipo, hueco, nombre, precio_moon) VALUES (?, ?, ?, ?, ?)", MUEBLES)
    cur.executemany("""INSERT OR IGNORE INTO objetivos (clave, ambito, periodo, evento, titulo, meta, moneda, recompensa)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", OBJETIVOS)
    cur.executemany("INSERT OR IGNORE INTO premios (clave, nombre, descripcion, precio_marth, stock) VALUES (?, ?, ?, ?, ?)", PREMIOS)
    con.commit()
