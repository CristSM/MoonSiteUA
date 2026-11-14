"""Reglas del juego: cuentas, monedas, objetivos, comparación de fotos, bases,
habitaciones, tienda y premios. Sin dependencias de FastAPI, para poder
probarlo directamente."""
from __future__ import annotations

import hashlib
import hmac
import json
import math
import re
import secrets
import sqlite3
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "engine"))
import analog_score as motor  # noqa: E402

from seed import CON_TALLA  # noqa: E402

# ------------------------------------------------------------------ constantes
MOON_REGISTRO = 100
MOON_LOGIN_DIARIO = 10
POR_PLANTA = 5
NIVEL_MAX_DIBUJO = 5
RADIO_NUEVA_ZONA_M = 6000      # una zona comunitaria nueva no puede solapar otra
SESION_DIAS = 30
TALLAS = ("S", "M", "L", "XL", "XXL")
HUECOS = ("pared_izq", "pared_der", "suelo", "techo", "alfombra")

SUELOS = {   # tipo de suelo -> eje "mafico" (0 silíceo/sedimentario, 1 basáltico)
    "basalto": 1.0, "lava_escoria": 0.95, "ceniza_volcanica": 0.8, "grava_regolito": 0.5,
    "arcilla": 0.35, "arena": 0.3, "yeso": 0.2, "caliza": 0.2, "sal": 0.15, "granito": 0.1,
    "hielo_nieve": 0.3,
}
VEGETACION = {"nada": 1.0, "escasa": 0.6, "abundante": 0.1}


class ErrorJuego(Exception):
    """Error de reglas, con mensaje listo para mostrar. campo = input afectado."""
    def __init__(self, mensaje: str, campo: str | None = None, status: int = 400):
        super().__init__(mensaje)
        self.mensaje, self.campo, self.status = mensaje, campo, status


def ahora() -> datetime:
    return datetime.now(timezone.utc)


# ================================================================== cuentas
RE_PASS = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{9,}$")
RE_USER = re.compile(r"^[A-Za-z0-9_.]{3,20}$")
RE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalizar_telefono(t: str) -> str:
    t = re.sub(r"[\s\-().]", "", t or "")
    if t.startswith("00"):
        t = "+" + t[2:]
    if re.fullmatch(r"[6789]\d{8}", t):        # móvil o fijo español sin prefijo
        t = "+34" + t
    return t


def validar_registro(d: dict) -> dict:
    errores = {}
    limpio = {k: (d.get(k) or "").strip() for k in ("nombre", "apellido", "username", "email", "telefono")}
    limpio["password"] = d.get("password") or ""
    for k, etiqueta in (("nombre", "El nombre"), ("apellido", "El apellido")):
        if not limpio[k]:
            errores[k] = f"{etiqueta} es obligatorio."
        elif len(limpio[k]) > 60:
            errores[k] = f"{etiqueta} no puede pasar de 60 caracteres."
    if not RE_USER.fullmatch(limpio["username"]):
        errores["username"] = "Entre 3 y 20 caracteres: letras, números, punto o guion bajo."
    limpio["email"] = limpio["email"].lower()
    if not RE_EMAIL.fullmatch(limpio["email"]):
        errores["email"] = "Introduce un correo válido, por ejemplo nombre@dominio.com."
    limpio["telefono"] = normalizar_telefono(limpio["telefono"])
    if not re.fullmatch(r"\+\d{8,15}", limpio["telefono"]):
        errores["telefono"] = "Introduce un teléfono válido, con prefijo si no es español (+34…)."
    if not RE_PASS.fullmatch(limpio["password"]):
        errores["password"] = "Mínimo 9 caracteres, con al menos una minúscula, una mayúscula y un número."
    if errores:
        e = ErrorJuego("Revisa los campos marcados.")
        e.errores = errores
        raise e
    limpio["region_id"] = d.get("region_id") or None
    return limpio


def hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    h = hashlib.scrypt(password.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return h.hex(), salt.hex()


def registrar(con: sqlite3.Connection, datos: dict) -> int:
    d = validar_registro(datos)
    dup = {}
    for campo, msg in (("username", "Ese nombre de usuario ya está en uso."),
                       ("email", "Ya existe una cuenta con ese correo."),
                       ("telefono", "Ya existe una cuenta con ese teléfono.")):
        if con.execute(f"SELECT 1 FROM usuarios WHERE {campo} = ?", (d[campo],)).fetchone():
            dup[campo] = msg
    if dup:
        e = ErrorJuego("Ya hay una cuenta con esos datos.", status=409)
        e.errores = dup
        raise e
    h, s = hash_password(d["password"])
    try:
        cur = con.execute("""INSERT INTO usuarios (nombre, apellido, username, email, telefono, pass_hash, pass_salt, region_id)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                          (d["nombre"], d["apellido"], d["username"], d["email"], d["telefono"], h, s, d["region_id"]))
    except sqlite3.IntegrityError:   # carrera entre dos registros simultáneos
        raise ErrorJuego("Ya hay una cuenta con esos datos.", status=409)
    uid = cur.lastrowid
    mover(con, uid, "moon", MOON_REGISTRO, "Bienvenida: registro")
    con.commit()
    return uid


def login(con: sqlite3.Connection, identificador: str, password: str) -> tuple[str, int]:
    """Acepta usuario o correo. Devuelve (token, monedas ganadas por el login diario)."""
    ident = (identificador or "").strip()
    u = con.execute("SELECT * FROM usuarios WHERE username = ? OR email = ?", (ident, ident.lower())).fetchone()
    ok = False
    if u:
        h, _ = hash_password(password or "", bytes.fromhex(u["pass_salt"]))
        ok = hmac.compare_digest(h, u["pass_hash"])
    if not ok:
        raise ErrorJuego("Usuario o contraseña incorrectos.", status=401)
    token = secrets.token_urlsafe(32)
    con.execute("INSERT INTO sesiones VALUES (?, ?, ?)",
                (token, u["id"], (ahora() + timedelta(days=SESION_DIAS)).isoformat()))
    ganado = recompensa_diaria(con, u["id"])
    con.commit()
    return token, ganado


def recompensa_diaria(con, uid: int, hoy: date | None = None) -> int:
    hoy = (hoy or ahora().date()).isoformat()
    u = con.execute("SELECT ultimo_dia_login FROM usuarios WHERE id = ?", (uid,)).fetchone()
    if u["ultimo_dia_login"] == hoy:
        return 0
    con.execute("UPDATE usuarios SET ultimo_dia_login = ? WHERE id = ?", (hoy, uid))
    mover(con, uid, "moon", MOON_LOGIN_DIARIO, f"Primer inicio de sesión del día {hoy}")
    return MOON_LOGIN_DIARIO


def usuario_por_token(con, token: str | None):
    if not token:
        return None
    return con.execute("""SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
                          WHERE s.token = ? AND s.expira > ?""", (token, ahora().isoformat())).fetchone()


# ================================================================== monedas
def mover(con, uid: int, moneda: str, cantidad: int, motivo: str) -> None:
    con.execute("INSERT INTO movimientos (usuario_id, moneda, cantidad, motivo) VALUES (?, ?, ?, ?)",
                (uid, moneda, cantidad, motivo))


def saldo(con, uid: int) -> dict:
    r = con.execute("SELECT moon, mars FROM saldos WHERE usuario_id = ?", (uid,)).fetchone()
    return {"moon": r["moon"], "mars": r["mars"]}


def cobrar(con, uid: int, moneda: str, cantidad: int, motivo: str) -> None:
    if saldo(con, uid)[moneda] < cantidad:
        nombre = "Moon Coins" if moneda == "moon" else "Mars Coins"
        raise ErrorJuego(f"No tienes suficientes {nombre}.", status=402)
    mover(con, uid, moneda, -cantidad, motivo)


# ================================================================== objetivos
def clave_periodo(periodo: str, d: date | None = None) -> str:
    d = d or ahora().date()
    if periodo == "diario":
        return d.isoformat()
    if periodo == "semanal":
        y, w, _ = d.isocalendar()
        return f"{y}-W{w:02d}"
    if periodo == "mensual":
        return f"{d.year}-{d.month:02d}"
    return "unico"


def evento(con, evento_: str, usuario_id: int | None = None, base_id: int | None = None, n: int = 1) -> list[dict]:
    """Suma progreso a los objetivos que escuchan este evento y paga los que se
    completan. Devuelve los objetivos completados ahora."""
    hechos = []
    for o in con.execute("SELECT * FROM objetivos WHERE evento = ?", (evento_,)).fetchall():
        sujeto = usuario_id if o["ambito"] == "individual" else base_id
        if sujeto is None:
            continue
        pk = clave_periodo(o["periodo"])
        con.execute("INSERT OR IGNORE INTO progreso_objetivos (objetivo_id, sujeto_id, periodo_clave) VALUES (?, ?, ?)",
                    (o["id"], sujeto, pk))
        p = con.execute("SELECT * FROM progreso_objetivos WHERE objetivo_id = ? AND sujeto_id = ? AND periodo_clave = ?",
                        (o["id"], sujeto, pk)).fetchone()
        if p["completado"]:
            continue
        nuevo = p["progreso"] + n
        completado = ahora().isoformat() if nuevo >= o["meta"] else None
        con.execute("UPDATE progreso_objetivos SET progreso = ?, completado = ? WHERE objetivo_id = ? AND sujeto_id = ? AND periodo_clave = ?",
                    (min(nuevo, o["meta"]), completado, o["id"], sujeto, pk))
        if completado:
            if o["ambito"] == "individual":
                beneficiarios = [usuario_id]
            else:
                beneficiarios = [r[0] for r in con.execute("SELECT usuario_id FROM habitaciones WHERE base_id = ?", (base_id,))]
            for b in beneficiarios:
                mover(con, b, o["moneda"], o["recompensa"], f"Objetivo: {o['titulo']}")
            hechos.append({"titulo": o["titulo"], "moneda": o["moneda"], "recompensa": o["recompensa"], "ambito": o["ambito"]})
    return hechos


def objetivos_de(con, uid: int) -> dict:
    def fila(o, sujeto):
        p = con.execute("SELECT progreso, completado FROM progreso_objetivos WHERE objetivo_id = ? AND sujeto_id = ? AND periodo_clave = ?",
                        (o["id"], sujeto, clave_periodo(o["periodo"]))).fetchone()
        return {"clave": o["clave"], "titulo": o["titulo"], "periodo": o["periodo"], "meta": o["meta"],
                "progreso": p["progreso"] if p else 0, "completado": bool(p and p["completado"]),
                "moneda": o["moneda"], "recompensa": o["recompensa"]}
    obj = con.execute("SELECT * FROM objetivos ORDER BY id").fetchall()
    bases = con.execute("""SELECT b.id, b.nombre FROM habitaciones h JOIN bases b ON b.id = h.base_id
                           WHERE h.usuario_id = ?""", (uid,)).fetchall()
    return {
        "individuales": [fila(o, uid) for o in obj if o["ambito"] == "individual"],
        "bases": [{"base_id": b["id"], "base": b["nombre"],
                   "objetivos": [fila(o, b["id"]) for o in obj if o["ambito"] == "base"]} for b in bases],
    }


# ================================================================== geografía
def distancia_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def pais_de_region(con, region_id: int | None) -> int | None:
    """Sube por la jerarquía hasta encontrar un país (o devuelve la región raíz)."""
    vistos, pendientes = set(), [region_id]
    ultimo = region_id
    while pendientes:
        rid = pendientes.pop(0)
        if rid is None or rid in vistos:
            continue
        vistos.add(rid)
        r = con.execute("SELECT tipo FROM regiones WHERE id = ?", (rid,)).fetchone()
        if r and r["tipo"] == "pais":
            return rid
        ultimo = rid
        pendientes += [p[0] for p in con.execute("SELECT padre_id FROM region_padres WHERE region_id = ?", (rid,))]
    return ultimo


def zona_mas_cercana(con, lat: float, lon: float, solo_recomendadas: bool = False):
    q = "SELECT * FROM zonas" + (" WHERE recomendada = 1" if solo_recomendadas else "")
    mejor, dmin = None, float("inf")
    for z in con.execute(q):
        d = distancia_m(lat, lon, z["lat"], z["lon"])
        if d < dmin:
            mejor, dmin = z, d
    return mejor, dmin


# ================================================================== comparación
def ejes_reporte(r: dict) -> dict:
    """Ejes 0-1 que se pueden sacar de lo que mide un explorador sobre el terreno."""
    ejes = {"desnudez": VEGETACION[r["vegetacion"]], "mafico": SUELOS[r["tipo_suelo"]],
            "hielo": 1.0 if r["tipo_suelo"] == "hielo_nieve" else 0.0}
    if r.get("pendiente_deg") is not None:
        ejes["relieve"] = motor.clamp01(r["pendiente_deg"] / 25)
    if r.get("altitud_m") is not None:
        ejes["altitud"] = motor.clamp01(r["altitud_m"] / 5000)
    return ejes


def comparar(con, r: dict) -> dict:
    """Compara un reporte de campo con el punto recomendado más cercano y con
    los cuatro destinos. Solo usa los ejes que el explorador ha medido."""
    ejes = ejes_reporte(r)
    targets = motor.load("targets.json")["targets"]
    z, d = zona_mas_cercana(con, r["lat"], r["lon"], solo_recomendadas=True)
    zona_ejes = motor.normalize(json.loads(z["perfil_json"]))
    sim_zona = {a: round(1 - abs(ejes[a] - zona_ejes[a]), 3) for a in ejes}
    destinos = []
    for t in targets:
        w = {a: t["pesos"][a] for a in ejes}
        iap = 100 * sum(w[a] * (1 - abs(ejes[a] - t["valores"][a])) for a in ejes) / sum(w.values())
        destinos.append({"id": t["id"], "nombre": t["nombre"], "iap_foto": round(iap, 1),
                         "iap_punto_nasa": motor.score(zona_ejes, t)["iap"]})
    return {
        "punto_nasa": {"zona_id": z["id"], "nombre": z["nombre"], "distancia_km": round(d / 1000, 2),
                       "dentro": d <= z["radio_m"]},
        "ejes_medidos": ejes,
        "similitud_con_punto": round(100 * sum(sim_zona.values()) / len(sim_zona), 1),
        "similitud_por_eje": sim_zona,
        "destinos": sorted(destinos, key=lambda x: -x["iap_foto"]),
    }


def crear_reporte(con, uid: int, datos: dict, foto: str) -> dict:
    if datos.get("tipo_suelo") not in SUELOS:
        raise ErrorJuego("Elige un tipo de suelo de la lista.", "tipo_suelo")
    if datos.get("vegetacion") not in VEGETACION:
        raise ErrorJuego("Indica cuánta vegetación hay.", "vegetacion")
    lat, lon = datos.get("lat"), datos.get("lon")
    if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ErrorJuego("Hace falta la ubicación de la foto.", "lat")
    if datos.get("pendiente_deg") is not None and not 0 <= datos["pendiente_deg"] <= 90:
        raise ErrorJuego("La pendiente va de 0 a 90 grados.", "pendiente_deg")

    # Zona: la que contiene el punto; si no hay, se crea una zona comunitaria
    z, d = zona_mas_cercana(con, lat, lon)
    if z is not None and d <= z["radio_m"]:
        zona = z
    elif z is None or d > RADIO_NUEVA_ZONA_M:
        cur = con.execute("""INSERT INTO zonas (nombre, lat, lon, radio_m, recomendada, creada_por)
                             VALUES (?, ?, ?, 3000, 0, ?)""",
                          (datos.get("nombre_zona") or f"Zona comunitaria {lat:.3f}, {lon:.3f}", lat, lon, uid))
        zona = con.execute("SELECT * FROM zonas WHERE id = ?", (cur.lastrowid,)).fetchone()
    else:
        zona = None   # cerca de una zona pero fuera de su radio: el reporte cuenta, sin zona
    if zona is not None and zona["restringida"]:
        raise ErrorJuego("Esta zona está restringida por seguridad. Se estudia con misiones robóticas.", status=403)

    comp = comparar(con, datos)
    primera_vez_zona = zona is not None and zona["recomendada"] and not con.execute(
        "SELECT 1 FROM reportes WHERE usuario_id = ? AND zona_id = ?", (uid, zona["id"])).fetchone()
    pais = pais_de_region(con, zona["region_id"]) if zona is not None and zona["region_id"] else None
    paises_previos = {pais_de_region(con, r[0]) for r in con.execute(
        "SELECT z.region_id FROM reportes r JOIN zonas z ON z.id = r.zona_id WHERE r.usuario_id = ? AND z.region_id IS NOT NULL", (uid,))}

    cur = con.execute("""INSERT INTO reportes (usuario_id, zona_id, lat, lon, foto, tipo_suelo, vegetacion, pendiente_deg, altitud_m, nota, comparacion_json)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (uid, zona["id"] if zona is not None else None, lat, lon, foto, datos["tipo_suelo"], datos["vegetacion"],
                       datos.get("pendiente_deg"), datos.get("altitud_m"), (datos.get("nota") or "")[:500], json.dumps(comp)))
    logros = evento(con, "foto", uid)
    if zona is not None and zona["recomendada"]:
        logros += evento(con, "foto_zona", uid)
    if primera_vez_zona:
        logros += evento(con, "zona_nueva", uid)
    if pais is not None and pais not in paises_previos:
        logros += evento(con, "pais_nuevo", uid)
    if zona is not None:
        b = con.execute("""SELECT b.id FROM bases b JOIN habitaciones h ON h.base_id = b.id
                           WHERE b.zona_id = ? AND h.usuario_id = ?""", (zona["id"], uid)).fetchone()
        if b:
            logros += evento(con, "foto_base", base_id=b["id"])
    con.commit()
    return {"reporte_id": cur.lastrowid, "zona_id": zona["id"] if zona is not None else None,
            "zona": zona["nombre"] if zona is not None else None, "comparacion": comp, "logros": logros}


# ================================================================== bases
def nivel(miembros: int) -> int:
    return max(1, math.ceil(miembros / POR_PLANTA))


def info_base(con, base_id: int) -> dict:
    b = con.execute("SELECT b.*, z.nombre AS zona FROM bases b JOIN zonas z ON z.id = b.zona_id WHERE b.id = ?", (base_id,)).fetchone()
    if not b:
        raise ErrorJuego("Esa base no existe.", status=404)
    habs = con.execute("""SELECT h.id, h.numero, u.username, h.usuario_id FROM habitaciones h
                          JOIN usuarios u ON u.id = h.usuario_id WHERE h.base_id = ? ORDER BY h.numero""", (base_id,)).fetchall()
    n = len(habs)
    return {"id": b["id"], "nombre": b["nombre"], "zona_id": b["zona_id"], "zona": b["zona"],
            "color1": b["color1"], "color2": b["color2"], "miembros": n, "nivel": nivel(n),
            "nivel_dibujo": min(nivel(n), NIVEL_MAX_DIBUJO), "plazas_libres_planta": POR_PLANTA * nivel(n) - n,
            "fundador": next((h["username"] for h in habs if h["usuario_id"] == b["fundador_id"]), None),
            "habitaciones": [{"id": h["id"], "numero": h["numero"], "planta": (h["numero"] - 1) // POR_PLANTA + 1,
                              "username": h["username"]} for h in habs]}


def _ha_estado_en_zona(con, uid, zona_id) -> bool:
    return con.execute("SELECT 1 FROM reportes WHERE usuario_id = ? AND zona_id = ?", (uid, zona_id)).fetchone() is not None


RE_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def fundar_base(con, uid: int, zona_id: int, nombre: str, color1: str, color2: str) -> dict:
    zona = con.execute("SELECT * FROM zonas WHERE id = ?", (zona_id,)).fetchone()
    if not zona:
        raise ErrorJuego("Esa zona no existe.", status=404)
    if zona["restringida"]:
        raise ErrorJuego("No se pueden fundar bases en zonas restringidas.", status=403)
    if not _ha_estado_en_zona(con, uid, zona_id):
        raise ErrorJuego("Para fundar una base tienes que haber subido una foto desde esta zona.", status=403)
    if con.execute("SELECT 1 FROM bases WHERE zona_id = ?", (zona_id,)).fetchone():
        raise ErrorJuego("Esta zona ya tiene base. Únete a ella.", status=409)
    if not (RE_HEX.match(color1 or "") and RE_HEX.match(color2 or "")):
        raise ErrorJuego("Elige dos colores válidos.", "color1")
    nombre = (nombre or "").strip() or f"Base {zona['nombre']}"
    try:
        cur = con.execute("INSERT INTO bases (zona_id, nombre, fundador_id, color1, color2) VALUES (?, ?, ?, ?, ?)",
                          (zona_id, nombre[:60], uid, color1.lower(), color2.lower()))
    except sqlite3.IntegrityError:
        raise ErrorJuego("Esta zona ya tiene base. Únete a ella.", status=409)
    logros = evento(con, "fundar", uid)
    logros += _entrar(con, uid, cur.lastrowid)
    con.commit()
    return {"base": info_base(con, cur.lastrowid), "logros": logros}


def _entrar(con, uid, base_id) -> list:
    numero = con.execute("SELECT COALESCE(MAX(numero), 0) + 1 FROM habitaciones WHERE base_id = ?", (base_id,)).fetchone()[0]
    cama = con.execute("SELECT id FROM muebles WHERE clave = 'cama_estandar'").fetchone()[0]
    mesa = con.execute("SELECT id FROM muebles WHERE clave = 'escritorio_estandar'").fetchone()[0]
    con.execute("INSERT INTO habitaciones (base_id, usuario_id, numero, cama_id, escritorio_id) VALUES (?, ?, ?, ?, ?)",
                (base_id, uid, numero, cama, mesa))
    return evento(con, "unirse_base", uid) + evento(con, "miembro_base", base_id=base_id)


def unirse_base(con, uid: int, base_id: int) -> dict:
    b = con.execute("SELECT * FROM bases WHERE id = ?", (base_id,)).fetchone()
    if not b:
        raise ErrorJuego("Esa base no existe.", status=404)
    if con.execute("SELECT 1 FROM habitaciones WHERE base_id = ? AND usuario_id = ?", (base_id, uid)).fetchone():
        raise ErrorJuego("Ya tienes una habitación en esta base.", status=409)
    if not _ha_estado_en_zona(con, uid, b["zona_id"]):
        raise ErrorJuego("Para unirte tienes que haber subido una foto desde la zona de la base.", status=403)
    logros = _entrar(con, uid, base_id)
    con.commit()
    return {"base": info_base(con, base_id), "logros": logros}


# ================================================================== habitaciones y tienda
def _mueble(con, clave):
    m = con.execute("SELECT * FROM muebles WHERE clave = ?", (clave,)).fetchone()
    if not m:
        raise ErrorJuego(f"El mueble «{clave}» no existe.")
    return m


def lo_tiene(con, uid, mueble) -> bool:
    return mueble["precio_moon"] == 0 or con.execute(
        "SELECT 1 FROM inventario WHERE usuario_id = ? AND mueble_id = ?", (uid, mueble["id"])).fetchone() is not None


def comprar_mueble(con, uid: int, clave: str) -> dict:
    m = _mueble(con, clave)
    if lo_tiene(con, uid, m):
        raise ErrorJuego("Ya tienes este mueble.", status=409)
    cobrar(con, uid, "moon", m["precio_moon"], f"Compra: {m['nombre']}")
    con.execute("INSERT INTO inventario VALUES (?, ?)", (uid, m["id"]))
    con.commit()
    return saldo(con, uid)


def ver_habitacion(con, hab_id: int) -> dict:
    h = con.execute("""SELECT h.*, u.username, b.nombre AS base, b.color1, b.color2,
                              c.clave AS cama, e.clave AS escritorio
                       FROM habitaciones h JOIN usuarios u ON u.id = h.usuario_id JOIN bases b ON b.id = h.base_id
                       LEFT JOIN muebles c ON c.id = h.cama_id LEFT JOIN muebles e ON e.id = h.escritorio_id
                       WHERE h.id = ?""", (hab_id,)).fetchone()
    if not h:
        raise ErrorJuego("Esa habitación no existe.", status=404)
    decos = {r["hueco"]: r["clave"] for r in con.execute(
        """SELECT d.hueco, m.clave FROM habitacion_decoraciones d JOIN muebles m ON m.id = d.mueble_id
           WHERE d.habitacion_id = ?""", (hab_id,))}
    return {"id": h["id"], "numero": h["numero"], "planta": (h["numero"] - 1) // POR_PLANTA + 1,
            "username": h["username"], "usuario_id": h["usuario_id"], "base_id": h["base_id"], "base": h["base"],
            "color1": h["color1"], "color2": h["color2"], "color_pared": h["color_pared"], "color_suelo": h["color_suelo"],
            "cama": h["cama"], "escritorio": h["escritorio"], "decoraciones": decos}


def editar_habitacion(con, uid: int, hab_id: int, cambios: dict) -> dict:
    h = con.execute("SELECT * FROM habitaciones WHERE id = ?", (hab_id,)).fetchone()
    if not h:
        raise ErrorJuego("Esa habitación no existe.", status=404)
    if h["usuario_id"] != uid:
        raise ErrorJuego("Solo puedes decorar tu propia habitación.", status=403)
    sets = {}
    for campo in ("color_pared", "color_suelo"):
        if cambios.get(campo) is not None:
            if not RE_HEX.match(cambios[campo]):
                raise ErrorJuego("Color no válido.", campo)
            sets[campo] = cambios[campo].lower()
    for campo, tipo in (("cama", "cama"), ("escritorio", "escritorio")):
        if cambios.get(campo):
            m = _mueble(con, cambios[campo])
            if m["tipo"] != tipo:
                raise ErrorJuego(f"«{m['nombre']}» no es un {tipo}.", campo)
            if not lo_tiene(con, uid, m):
                raise ErrorJuego(f"Primero compra «{m['nombre']}» en la tienda.", campo, 402)
            sets[f"{campo}_id"] = m["id"]
    if sets:
        con.execute(f"UPDATE habitaciones SET {', '.join(k + ' = ?' for k in sets)} WHERE id = ?", (*sets.values(), hab_id))
    for hueco, clave in (cambios.get("decoraciones") or {}).items():
        if hueco not in HUECOS:
            raise ErrorJuego(f"Hueco «{hueco}» no válido.")
        if not clave:
            con.execute("DELETE FROM habitacion_decoraciones WHERE habitacion_id = ? AND hueco = ?", (hab_id, hueco))
            continue
        m = _mueble(con, clave)
        if m["tipo"] != "decoracion" or m["hueco"] != hueco:
            raise ErrorJuego(f"«{m['nombre']}» no va en ese hueco.")
        if not lo_tiene(con, uid, m):
            raise ErrorJuego(f"Primero compra «{m['nombre']}» en la tienda.", status=402)
        con.execute("INSERT OR REPLACE INTO habitacion_decoraciones VALUES (?, ?, ?)", (hab_id, hueco, m["id"]))
    logros = evento(con, "personalizar", uid)
    con.commit()
    return {"habitacion": ver_habitacion(con, hab_id), "logros": logros}


# ================================================================== premios físicos
def canjear(con, uid: int, clave: str, direccion: str, talla: str | None) -> dict:
    p = con.execute("SELECT * FROM premios WHERE clave = ?", (clave,)).fetchone()
    if not p:
        raise ErrorJuego("Ese premio no existe.", status=404)
    if p["stock"] <= 0:
        raise ErrorJuego("Ese premio está agotado.", status=409)
    if clave in CON_TALLA and talla not in TALLAS:
        raise ErrorJuego("Elige una talla.", "talla")
    if len((direccion or "").strip()) < 10:
        raise ErrorJuego("Escribe la dirección de envío completa.", "direccion")
    cobrar(con, uid, "mars", p["precio_mars"], f"Canje: {p['nombre']}")
    con.execute("UPDATE premios SET stock = stock - 1 WHERE id = ?", (p["id"],))
    cur = con.execute("INSERT INTO canjes (usuario_id, premio_id, talla, direccion) VALUES (?, ?, ?, ?)",
                      (uid, p["id"], talla if clave in CON_TALLA else None, direccion.strip()[:300]))
    con.commit()
    return {"canje_id": cur.lastrowid, "saldo": saldo(con, uid)}


# ================================================================== aportaciones desde la demo
MOON_APORTE_DATOS = 10        # por enviar temperatura, calidad del aire o humedad
MOON_APORTE_FOTO = 15         # extra si incluye foto
MOON_PUNTO_NUEVO = 40         # extra si crea un punto nuevo válido
BLOQUEO_HORAS = 12            # espera para volver a aportar al mismo punto
MAX_PUNTOS_NUEVOS_DIA = 5     # contra la creación masiva de puntos para ganar monedas
RANGOS = {"temperatura_c": (-90, 60, "La temperatura debe estar entre -90 y 60 °C."),
          "calidad_aire": (0, 500, "El índice de calidad del aire va de 0 a 500."),
          "humedad_rel": (0, 100, "La humedad va de 0 a 100 %.")}


def _num(v):
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    try:
        return float(str(v).replace(",", "."))
    except ValueError:
        return "error"


def bloqueo_hasta(con, uid: int, zona_id: int) -> str | None:
    """Fecha (UTC, ISO) hasta la que el usuario no puede volver a aportar a ese punto."""
    r = con.execute("""SELECT datetime(MAX(fecha), '+%d hours') AS hasta FROM aportaciones
                       WHERE usuario_id = ? AND zona_id = ? AND fecha > datetime('now', '-%d hours')"""
                    % (BLOQUEO_HORAS, BLOQUEO_HORAS), (uid, zona_id)).fetchone()
    return r["hasta"].replace(" ", "T") + "Z" if r and r["hasta"] else None


def _zona_por_ref(con, ref):
    ref = str(ref or "").strip()
    z = con.execute("SELECT * FROM zonas WHERE clave = ?", (ref,)).fetchone()
    if not z and ref.isdigit():
        z = con.execute("SELECT * FROM zonas WHERE id = ?", (int(ref),)).fetchone()
    return z


def crear_aportacion(con, uid: int, datos: dict, foto: str | None) -> dict:
    """Valida y guarda una aportación. Modo 'existente' (punto ya creado) o
    'nuevo' (crea un punto de la comunidad si pasa la validación)."""
    errores = {}
    lat, lon = _num(datos.get("lat")), _num(datos.get("lon"))
    if lat in (None, "error") or not -90 <= lat <= 90:
        errores["lat"] = "Las coordenadas son obligatorias: latitud entre -90 y 90."
    if lon in (None, "error") or not -180 <= lon <= 180:
        errores["lon"] = "Las coordenadas son obligatorias: longitud entre -180 y 180."
    valores = {}
    for campo, (lo, hi, msg) in RANGOS.items():
        v = _num(datos.get(campo))
        if v == "error" or (v is not None and not lo <= v <= hi):
            errores[campo] = msg
        valores[campo] = None if v == "error" else v
    if valores["calidad_aire"] is not None:
        valores["calidad_aire"] = int(round(valores["calidad_aire"]))
    if foto is None and all(v is None for v in valores.values()):
        errores["_"] = "Rellena al menos un dato: foto, temperatura, calidad del aire o humedad."
    targets = {t["id"]: t for t in motor.load("targets.json")["targets"]}
    destino = datos.get("destino") or None
    if destino is not None and destino not in targets:
        errores["destino"] = "Destino no válido."
    pesos = datos.get("pesos")
    if isinstance(pesos, str):
        try:
            pesos = json.loads(pesos) if pesos.strip() else None
        except ValueError:
            pesos = "error"
    if pesos is not None and (not isinstance(pesos, dict) or any(
            k not in motor.AXES or not isinstance(v, (int, float)) or not 0 <= v <= 2 for k, v in pesos.items())):
        errores["pesos"] = "Los pesos no son válidos."
    if errores:
        e = ErrorJuego(errores.get("_") or "Revisa los campos marcados.")
        e.errores = errores
        raise e

    modo = datos.get("modo") or "existente"
    nuevo = modo == "nuevo"
    if nuevo:
        z, d = zona_mas_cercana(con, lat, lon)
        if z is not None and d < RADIO_NUEVA_ZONA_M:
            e = ErrorJuego(f"Ya existe el punto «{z['nombre']}» a {d / 1000:.1f} km. Aporta tus datos a ese punto.", status=409)
            e.extra = {"zona_existente": {"id": z["id"], "clave": z["clave"], "nombre": z["nombre"]}}
            raise e
        hoy = con.execute("""SELECT COUNT(*) FROM aportaciones WHERE usuario_id = ? AND crea_punto = 1
                             AND fecha > datetime('now', '-1 day')""", (uid,)).fetchone()[0]
        if hoy >= MAX_PUNTOS_NUEVOS_DIA:
            raise ErrorJuego(f"Solo se pueden crear {MAX_PUNTOS_NUEVOS_DIA} puntos nuevos al día.", status=429)
        nombre = (datos.get("nombre") or "").strip()[:60] or f"Punto comunitario {lat:.3f}, {lon:.3f}"
        cur = con.execute("INSERT INTO zonas (nombre, lat, lon, radio_m, recomendada, creada_por) VALUES (?, ?, ?, 3000, 0, ?)",
                          (nombre, lat, lon, uid))
        zona = con.execute("SELECT * FROM zonas WHERE id = ?", (cur.lastrowid,)).fetchone()
    else:
        zona = _zona_por_ref(con, datos.get("zona"))
        if not zona:
            raise ErrorJuego("Elige un punto del mapa o crea uno nuevo.", "zona", 404)
        if zona["restringida"]:
            raise ErrorJuego("Este punto está restringido por seguridad.", status=403)
        d = distancia_m(lat, lon, zona["lat"], zona["lon"])
        if d > zona["radio_m"]:
            e = ErrorJuego(f"Tus coordenadas están a {d / 1000:.1f} km de «{zona['nombre']}». Para aportar datos a un punto "
                           f"tienes que estar a menos de {zona['radio_m'] / 1000:.0f} km. Si es otro lugar, crea un punto nuevo.")
            e.errores = {"lat": e.mensaje}
            raise e
        hasta = bloqueo_hasta(con, uid, zona["id"])
        if hasta:
            e = ErrorJuego("Ya guardaste datos de este punto hace menos de 12 horas.", status=429)
            e.extra = {"bloqueado_hasta": hasta}
            raise e

    ganadas = (MOON_APORTE_DATOS if any(v is not None for v in valores.values()) else 0) \
        + (MOON_APORTE_FOTO if foto else 0) + (MOON_PUNTO_NUEVO if nuevo else 0)
    cur = con.execute("""INSERT INTO aportaciones (usuario_id, zona_id, lat, lon, foto, temperatura_c, calidad_aire, humedad_rel,
                                                   destino, pesos_json, crea_punto, moon_ganadas)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (uid, zona["id"], lat, lon, foto, valores["temperatura_c"], valores["calidad_aire"], valores["humedad_rel"],
                       destino, json.dumps(pesos) if pesos is not None else None, int(nuevo), ganadas))
    motivo = "Punto nuevo validado" if nuevo else "Aportación de datos"
    mover(con, uid, "moon", ganadas, f"{motivo}: {zona['nombre']}")
    con.commit()
    fecha = con.execute("SELECT fecha FROM aportaciones WHERE id = ?", (cur.lastrowid,)).fetchone()["fecha"]
    return {"aportacion_id": cur.lastrowid, "fecha": fecha.replace(" ", "T") + "Z", "punto_nuevo": nuevo,
            "zona": {"id": zona["id"], "clave": zona["clave"], "nombre": zona["nombre"], "lat": zona["lat"], "lon": zona["lon"]},
            "moon_ganadas": ganadas, "bloqueado_hasta": bloqueo_hasta(con, uid, zona["id"])}


def resumen_punto(con, ref, uid: int | None = None) -> dict:
    zona = _zona_por_ref(con, ref)
    if not zona:
        raise ErrorJuego("Ese punto no existe.", status=404)
    a = con.execute("""SELECT COUNT(*) AS n, COUNT(foto) AS fotos, AVG(temperatura_c) AS temp, AVG(calidad_aire) AS aire,
                              AVG(humedad_rel) AS hum, COUNT(DISTINCT usuario_id) AS personas, MAX(fecha) AS ultima
                       FROM aportaciones WHERE zona_id = ?""", (zona["id"],)).fetchone()
    fotos = [{"foto": f"/uploads/{r['foto']}", "fecha": r["fecha"].replace(" ", "T") + "Z"} for r in con.execute(
        "SELECT foto, fecha FROM aportaciones WHERE zona_id = ? AND foto IS NOT NULL ORDER BY id DESC LIMIT 4", (zona["id"],))]
    rnd = lambda v, k=1: None if v is None else round(v, k)
    return {"zona": {"id": zona["id"], "clave": zona["clave"], "nombre": zona["nombre"], "lat": zona["lat"], "lon": zona["lon"],
                     "recomendada": bool(zona["recomendada"])},
            "aportaciones": a["n"], "personas": a["personas"], "fotos": a["fotos"],
            "media": {"temperatura_c": rnd(a["temp"]), "calidad_aire": rnd(a["aire"], 0), "humedad_rel": rnd(a["hum"], 0)},
            "ultima": a["ultima"].replace(" ", "T") + "Z" if a["ultima"] else None, "ultimas_fotos": fotos,
            "mi_bloqueo_hasta": bloqueo_hasta(con, uid, zona["id"]) if uid else None}


def puntos_comunidad(con) -> list[dict]:
    out = []
    for z in con.execute("SELECT * FROM zonas WHERE recomendada = 0 ORDER BY id"):
        a = con.execute("SELECT COUNT(*) AS n, MIN(fecha) AS desde FROM aportaciones WHERE zona_id = ?", (z["id"],)).fetchone()
        out.append({"id": z["id"], "nombre": z["nombre"], "lat": z["lat"], "lon": z["lon"], "aportaciones": a["n"],
                    "creado": a["desde"].replace(" ", "T") + "Z" if a["desde"] else None})
    return out
