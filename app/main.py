"""MoonSiteUA · servidor de la web y API de la zona de exploradores.

Sirve la web completa (carpeta web/) y la API con cuentas y base de datos.
Arrancar (desde la carpeta app):
    pip install -r requirements.txt
    python -m uvicorn main:app --reload
y abrir http://localhost:8000
"""
from __future__ import annotations

import json
import secrets
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, File, Form, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import db
import logic as L
from logic import ErrorJuego

HERE = Path(__file__).resolve().parent
UPLOADS = HERE / "uploads"
UPLOADS.mkdir(exist_ok=True)
MAX_FOTO = 8 * 1024 * 1024
FIRMAS = {b"\xff\xd8\xff": ".jpg", b"\x89PNG": ".png", b"RIFF": ".webp"}

app = FastAPI(title="MoonSiteUA")
con = db.init()


@app.exception_handler(ErrorJuego)
def _error(_: Request, e: ErrorJuego):
    con.rollback()   # nada a medias: si una regla falla, no se guarda ningún cambio de esa petición
    return JSONResponse({"error": e.mensaje, "campo": e.campo, "errores": getattr(e, "errores", {}), **getattr(e, "extra", {})},
                        status_code=e.status)


def usuario(token: str | None = Cookie(default=None, alias="moonsite_sesion")):
    u = L.usuario_por_token(con, token)
    if not u:
        raise ErrorJuego("Inicia sesión para continuar.", status=401)
    return u


def _sesion(resp: Response, token: str):
    resp.set_cookie("moonsite_sesion", token, httponly=True, samesite="lax", max_age=L.SESION_DIAS * 86400)


# ------------------------------------------------------------------ cuentas
@app.post("/api/registro")
async def registro(request: Request, response: Response):
    datos = await request.json()
    uid = L.registrar(con, datos)
    token, diario = L.login(con, (datos.get("username") or "").strip(), datos.get("password", ""))
    _sesion(response, token)
    return {"usuario_id": uid, "moon_ganadas": L.MOON_REGISTRO + diario}


@app.post("/api/login")
async def login(request: Request, response: Response):
    d = await request.json()
    token, diario = L.login(con, d.get("usuario", ""), d.get("password", ""))
    _sesion(response, token)
    return {"moon_ganadas": diario}


@app.post("/api/logout")
def logout(response: Response, token: str | None = Cookie(default=None, alias="moonsite_sesion")):
    con.execute("DELETE FROM sesiones WHERE token = ?", (token,))
    con.commit()
    response.delete_cookie("moonsite_sesion")
    return {"ok": True}


@app.get("/api/yo")
def yo(u=Depends(usuario)):
    region = con.execute("SELECT nombre FROM regiones WHERE id = ?", (u["region_id"],)).fetchone() if u["region_id"] else None
    habs = con.execute("""SELECT h.id AS habitacion_id, h.numero, b.id AS base_id, b.nombre AS base
                          FROM habitaciones h JOIN bases b ON b.id = h.base_id WHERE h.usuario_id = ?""", (u["id"],)).fetchall()
    return {"id": u["id"], "nombre": u["nombre"], "apellido": u["apellido"], "username": u["username"],
            "email": u["email"], "region": region["nombre"] if region else None, "saldo": L.saldo(con, u["id"]),
            "habitaciones": [dict(h) for h in habs]}


@app.get("/api/movimientos")
def movimientos(u=Depends(usuario)):
    return [dict(r) for r in con.execute(
        "SELECT moneda, cantidad, motivo, fecha FROM movimientos WHERE usuario_id = ? ORDER BY id DESC LIMIT 50", (u["id"],))]


# ------------------------------------------------------------------ regiones
@app.get("/api/regiones")
def regiones():
    regs = [dict(r) for r in con.execute("SELECT id, nombre, tipo, codigo FROM regiones ORDER BY nombre")]
    padres = {}
    for r in con.execute("SELECT region_id, padre_id FROM region_padres"):
        padres.setdefault(r["region_id"], []).append(r["padre_id"])
    for r in regs:
        r["padres"] = padres.get(r["id"], [])
    return regs


# ------------------------------------------------------------------ zonas
@app.get("/api/zonas")
def zonas():
    targets = L.motor.load("targets.json")["targets"]
    out = []
    for z in con.execute("SELECT * FROM zonas ORDER BY recomendada DESC, nombre"):
        item = {k: z[k] for k in ("id", "nombre", "lat", "lon", "radio_m", "recomendada", "restringida", "nota")}
        if z["perfil_json"]:
            ejes = L.motor.normalize(json.loads(z["perfil_json"]))
            item["iap"] = {t["id"]: L.motor.score(ejes, t)["iap"] for t in targets}
        b = con.execute("SELECT id FROM bases WHERE zona_id = ?", (z["id"],)).fetchone()
        item["base"] = L.info_base(con, b["id"]) if b else None
        out.append(item)
    return out


# ------------------------------------------------------------------ reportes (fotos)
@app.post("/api/reportes")
async def subir_reporte(foto: UploadFile = File(...), lat: float = Form(...), lon: float = Form(...),
                        tipo_suelo: str = Form(...), vegetacion: str = Form(...),
                        pendiente_deg: float | None = Form(None), altitud_m: float | None = Form(None),
                        nota: str | None = Form(None), nombre_zona: str | None = Form(None), u=Depends(usuario)):
    contenido = await foto.read(MAX_FOTO + 1)
    if len(contenido) > MAX_FOTO:
        raise ErrorJuego("La foto no puede pasar de 8 MB.", "foto", 413)
    ext = next((e for firma, e in FIRMAS.items() if contenido.startswith(firma)), None)
    if not ext:
        raise ErrorJuego("La foto tiene que ser JPG, PNG o WEBP.", "foto")
    nombre = secrets.token_hex(12) + ext
    datos = {"lat": lat, "lon": lon, "tipo_suelo": tipo_suelo, "vegetacion": vegetacion,
             "pendiente_deg": pendiente_deg, "altitud_m": altitud_m, "nota": nota, "nombre_zona": nombre_zona}
    res = L.crear_reporte(con, u["id"], datos, nombre)   # valida antes de guardar el archivo
    (UPLOADS / nombre).write_bytes(contenido)
    res["foto"] = f"/uploads/{nombre}"
    return res


@app.get("/api/reportes")
def mis_reportes(u=Depends(usuario)):
    out = []
    for r in con.execute("""SELECT r.*, z.nombre AS zona FROM reportes r LEFT JOIN zonas z ON z.id = r.zona_id
                            WHERE r.usuario_id = ? ORDER BY r.id DESC""", (u["id"],)):
        d = dict(r)
        d["comparacion"] = json.loads(d.pop("comparacion_json"))
        d["foto"] = f"/uploads/{d['foto']}"
        out.append(d)
    return out


# ------------------------------------------------------------------ aportaciones desde la demo
def usuario_opcional(token: str | None = Cookie(default=None, alias="moonsite_sesion")):
    return L.usuario_por_token(con, token)


async def _guardar_foto(foto: UploadFile | None) -> tuple[str | None, bytes | None]:
    if foto is None or not foto.filename:
        return None, None
    contenido = await foto.read(MAX_FOTO + 1)
    if not contenido:
        return None, None
    if len(contenido) > MAX_FOTO:
        raise ErrorJuego("La foto no puede pasar de 8 MB.", "foto", 413)
    ext = next((e for firma, e in FIRMAS.items() if contenido.startswith(firma)), None)
    if not ext:
        raise ErrorJuego("La foto tiene que ser JPG, PNG o WEBP.", "foto")
    return secrets.token_hex(12) + ext, contenido


@app.post("/api/aportaciones")
async def aportar(modo: str = Form("existente"), zona: str | None = Form(None), nombre: str | None = Form(None),
                  lat: str | None = Form(None), lon: str | None = Form(None), temperatura_c: str | None = Form(None),
                  calidad_aire: str | None = Form(None), humedad_rel: str | None = Form(None),
                  destino: str | None = Form(None), pesos: str | None = Form(None),
                  foto: UploadFile | None = File(None), u=Depends(usuario)):
    nombre_foto, contenido = await _guardar_foto(foto)
    datos = {"modo": modo, "zona": zona, "nombre": nombre, "lat": lat, "lon": lon, "temperatura_c": temperatura_c,
             "calidad_aire": calidad_aire, "humedad_rel": humedad_rel, "destino": destino, "pesos": pesos}
    res = L.crear_aportacion(con, u["id"], datos, nombre_foto)   # valida antes de guardar el archivo
    if contenido:
        (UPLOADS / nombre_foto).write_bytes(contenido)
    res["saldo"] = L.saldo(con, u["id"])
    return res


@app.get("/api/aportaciones/resumen")
def resumen(zona: str, u=Depends(usuario_opcional)):
    return L.resumen_punto(con, zona, u["id"] if u else None)


@app.get("/api/puntos-comunidad")
def puntos_comunidad():
    return L.puntos_comunidad(con)


@app.get("/api/sesion")
def sesion(u=Depends(usuario_opcional)):
    """Para las páginas públicas: ¿hay sesión? (no da error si no la hay)."""
    return {"usuario": u["username"], "saldo": L.saldo(con, u["id"])} if u else {"usuario": None}


# ------------------------------------------------------------------ bases y habitaciones
@app.post("/api/bases")
async def fundar(request: Request, u=Depends(usuario)):
    d = await request.json()
    return L.fundar_base(con, u["id"], int(d.get("zona_id", 0)), d.get("nombre"), d.get("color1"), d.get("color2"))


@app.get("/api/bases/{base_id}")
def ver_base(base_id: int):
    return L.info_base(con, base_id)


@app.post("/api/bases/{base_id}/unirse")
def unirse(base_id: int, u=Depends(usuario)):
    return L.unirse_base(con, u["id"], base_id)


@app.get("/api/habitaciones/{hab_id}")
def ver_habitacion(hab_id: int):
    return L.ver_habitacion(con, hab_id)


@app.put("/api/habitaciones/{hab_id}")
async def editar_habitacion(hab_id: int, request: Request, u=Depends(usuario)):
    return L.editar_habitacion(con, u["id"], hab_id, await request.json())


# ------------------------------------------------------------------ tienda y premios
@app.get("/api/muebles")
def muebles(u=Depends(usuario)):
    return [{**dict(m), "lo_tengo": L.lo_tiene(con, u["id"], m)} for m in con.execute("SELECT * FROM muebles ORDER BY tipo, precio_moon")]


@app.post("/api/muebles/{clave}/comprar")
def comprar(clave: str, u=Depends(usuario)):
    return L.comprar_mueble(con, u["id"], clave)


@app.get("/api/premios")
def premios():
    return [{**dict(p), "con_talla": p["clave"] in L.CON_TALLA} for p in con.execute("SELECT * FROM premios ORDER BY precio_mars")]


@app.post("/api/premios/{clave}/canjear")
async def canjear(clave: str, request: Request, u=Depends(usuario)):
    d = await request.json()
    return L.canjear(con, u["id"], clave, d.get("direccion", ""), d.get("talla"))


@app.get("/api/objetivos")
def objetivos(u=Depends(usuario)):
    return L.objetivos_de(con, u["id"])


# ------------------------------------------------------------------ estáticos
app.mount("/uploads", StaticFiles(directory=UPLOADS), name="uploads")
# La web del proyecto (todas sus páginas). Va la última para no tapar la API.
app.mount("/", StaticFiles(directory=HERE.parent / "web", html=True), name="web")
