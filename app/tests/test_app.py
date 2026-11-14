"""Tests de la app: python -m pytest app/tests  (desde la raíz del repo)."""
import io
import os
import sys
import tempfile
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP))
os.environ["MOONSITE_DB"] = str(Path(tempfile.mkdtemp()) / "test.db")

from fastapi.testclient import TestClient  # noqa: E402

import logic as L  # noqa: E402
import main  # noqa: E402

JPG = b"\xff\xd8\xff\xe0" + b"0" * 200
TABERNAS = {"lat": "37.05", "lon": "-2.39"}


def nuevo(n: int, **extra):
    c = TestClient(main.app)
    datos = {"nombre": "Ana", "apellido": "Pérez", "username": f"ana{n}", "email": f"ana{n}@ua.es",
             "telefono": f"6000000{n:02d}", "password": "Luna2026ok", **extra}
    r = c.post("/api/registro", json=datos)
    return c, r


def foto(c, **campos):
    datos = {**TABERNAS, "tipo_suelo": "arcilla", "vegetacion": "escasa", "pendiente_deg": "14", **campos}
    return c.post("/api/reportes", data=datos, files={"foto": ("t.jpg", io.BytesIO(JPG), "image/jpeg")})


# ------------------------------------------------------------------ registro
def test_registro_da_monedas_y_sesion():
    c, r = nuevo(1)
    assert r.status_code == 200
    yo = c.get("/api/yo").json()
    assert yo["saldo"]["moon"] == L.MOON_REGISTRO + L.MOON_LOGIN_DIARIO
    assert yo["saldo"]["marth"] == 0


@pytest.mark.parametrize("campo,valor", [
    ("password", "corta1A"), ("password", "sinnumerosAA"), ("password", "SINMINUSCULA1"), ("password", "sinmayuscula1"),
    ("email", "no-es-correo"), ("telefono", "123"), ("username", "a"), ("nombre", "  "), ("apellido", ""),
])
def test_registro_valida_campos(campo, valor):
    _, r = nuevo(2, **{campo: valor})
    assert r.status_code == 400
    assert campo in r.json()["errores"]


@pytest.mark.parametrize("campo,valor", [("username", "ANA3"), ("email", "ANA3@UA.ES"), ("telefono", "+34 600 000 003")])
def test_no_se_repiten_usuario_correo_ni_telefono(campo, valor):
    nuevo(3)
    base = {"username": "otra3", "email": "otra3@ua.es", "telefono": "699999903"}
    base[campo] = valor
    _, r = nuevo(99, **base)
    assert r.status_code == 409 and campo in r.json()["errores"]


def test_login_y_recompensa_diaria_una_vez():
    nuevo(4)
    c = TestClient(main.app)
    assert c.post("/api/login", json={"usuario": "ana4", "password": "mal"}).status_code == 401
    r = c.post("/api/login", json={"usuario": "ana4@ua.es", "password": "Luna2026ok"})
    assert r.status_code == 200 and r.json()["moon_ganadas"] == 0   # ya cobró hoy al registrarse


def test_la_contrasena_no_se_guarda_en_claro():
    nuevo(5)
    u = main.con.execute("SELECT * FROM usuarios WHERE username = 'ana5'").fetchone()
    assert "Luna2026ok" not in (u["pass_hash"] + u["pass_salt"])


# ------------------------------------------------------------------ regiones
def test_regiones_jerarquia_varios_padres():
    regs = {r["codigo"]: r for r in TestClient(main.app).get("/api/regiones").json()}
    es, ue, eur = regs["ES"], regs["EU"], regs["EUR"]
    assert set(es["padres"]) == {ue["id"], eur["id"]}
    assert regs["ES-A"]["padres"] == [es["id"]] and regs["ES-A"]["tipo"] == "provincia"
    assert regs["US-CA"]["tipo"] == "estado"


# ------------------------------------------------------------------ fotos
def test_foto_compara_con_punto_nasa_y_da_objetivo():
    c, _ = nuevo(6)
    r = foto(c)
    assert r.status_code == 200, r.text
    comp = r.json()["comparacion"]
    assert comp["punto_nasa"]["nombre"].startswith("Desierto de Tabernas") and comp["punto_nasa"]["dentro"]
    assert len(comp["destinos"]) == 4 and 0 <= comp["similitud_con_punto"] <= 100
    assert any(l["titulo"] == "Sube una foto hoy" for l in r.json()["logros"])


def test_foto_rechaza_archivo_que_no_es_imagen():
    c, _ = nuevo(7)
    r = c.post("/api/reportes", data={**TABERNAS, "tipo_suelo": "arcilla", "vegetacion": "nada"},
               files={"foto": ("x.jpg", io.BytesIO(b"no soy una foto"), "image/jpeg")})
    assert r.status_code == 400


def test_foto_lejos_crea_zona_comunitaria():
    c, _ = nuevo(8)
    r = foto(c, lat="38.35", lon="-0.48")   # Alicante
    assert r.status_code == 200 and r.json()["zona"].startswith("Zona comunitaria")


# ------------------------------------------------------------------ bases
def _zona_tabernas():
    return main.con.execute("SELECT id FROM zonas WHERE clave = 'tabernas'").fetchone()[0]


def test_fundar_requiere_haber_estado_y_solo_una_base_por_zona():
    z = _zona_tabernas()
    c, _ = nuevo(10)
    col = {"zona_id": z, "color1": "#E7794B", "color2": "#1B2A4A"}
    assert c.post("/api/bases", json=col).status_code == 403
    foto(c)
    r = c.post("/api/bases", json=col)
    assert r.status_code == 200
    b = r.json()["base"]
    assert b["color1"] == "#e7794b" and b["nivel"] == 1 and b["habitaciones"][0]["numero"] == 1
    c2, _ = nuevo(11)
    foto(c2)
    assert c2.post("/api/bases", json=col).status_code == 409


def test_la_base_crece_una_planta_cada_5_miembros():
    base_id = main.con.execute("SELECT id FROM bases WHERE zona_id = ?", (_zona_tabernas(),)).fetchone()[0]
    for n in range(20, 26):          # 6 miembros más
        c, _ = nuevo(n)
        foto(c)
        assert c.post(f"/api/bases/{base_id}/unirse").status_code == 200
    b = TestClient(main.app).get(f"/api/bases/{base_id}").json()
    assert b["miembros"] == 7 and b["nivel"] == 2 and b["habitaciones"][5]["planta"] == 2
    assert L.nivel(21) == 5 and min(L.nivel(40), L.NIVEL_MAX_DIBUJO) == 5


def test_objetivo_de_base_paga_a_todos_los_miembros():
    fundador = main.con.execute("SELECT id FROM usuarios WHERE username = 'ana10'").fetchone()[0]
    movs = main.con.execute("SELECT motivo FROM movimientos WHERE usuario_id = ?", (fundador,)).fetchall()
    assert any("planta 2" in m[0] for m in movs)          # se completó al llegar a 6 miembros
    assert L.saldo(main.con, fundador)["marth"] >= 2 + 2   # pionero + planta 2


# ------------------------------------------------------------------ habitación y tienda
def test_habitacion_compra_y_decoracion():
    c = TestClient(main.app)
    c.post("/api/login", json={"usuario": "ana10", "password": "Luna2026ok"})
    hab = c.get("/api/yo").json()["habitaciones"][0]["habitacion_id"]
    assert c.put(f"/api/habitaciones/{hab}", json={"cama": "cama_capsula"}).status_code == 402   # no comprada
    assert c.post("/api/muebles/cama_capsula/comprar").status_code == 200
    r = c.put(f"/api/habitaciones/{hab}", json={"cama": "cama_capsula", "color_pared": "#223344",
                                                "decoraciones": {"pared_der": "bandera_base"}})
    assert r.status_code == 402   # bandera no comprada: no se aplica nada
    c.post("/api/muebles/bandera_base/comprar")
    r = c.put(f"/api/habitaciones/{hab}", json={"cama": "cama_capsula", "color_pared": "#223344",
                                                "decoraciones": {"pared_der": "bandera_base"}})
    h = r.json()["habitacion"]
    assert h["cama"] == "cama_capsula" and h["decoraciones"]["pared_der"] == "bandera_base"
    # una cama y un escritorio; las decoraciones van en su hueco
    assert c.put(f"/api/habitaciones/{hab}", json={"cama": "escritorio_consola"}).status_code == 400
    assert c.put(f"/api/habitaciones/{hab}", json={"decoraciones": {"suelo": "poster_luna"}}).status_code == 400


def test_no_se_puede_editar_la_habitacion_de_otro():
    hab = main.con.execute("SELECT h.id FROM habitaciones h JOIN usuarios u ON u.id = h.usuario_id WHERE u.username = 'ana10'").fetchone()[0]
    c = TestClient(main.app)
    c.post("/api/login", json={"usuario": "ana20", "password": "Luna2026ok"})
    assert c.put(f"/api/habitaciones/{hab}", json={"color_pared": "#000000"}).status_code == 403


def test_sin_saldo_no_se_compra():
    c, _ = nuevo(40)
    for clave in ("escritorio_holo",):          # 200 > 110
        assert c.post(f"/api/muebles/{clave}/comprar").status_code == 402


# ------------------------------------------------------------------ premios
def test_canje_premio_con_marth_y_talla():
    c = TestClient(main.app)
    c.post("/api/login", json={"usuario": "ana10", "password": "Luna2026ok"})
    assert c.post("/api/premios/camiseta/canjear", json={"direccion": "Calle Mayor 1, Alicante"}).status_code in (400, 402)
    assert c.post("/api/premios/pegatinas/canjear", json={"direccion": "corta"}).status_code == 400
    r = c.post("/api/premios/pegatinas/canjear", json={"direccion": "Calle Mayor 1, 03001 Alicante"})
    assert r.status_code == 200
    assert c.post("/api/premios/sudadera/canjear", json={"direccion": "Calle Mayor 1, 03001 Alicante", "talla": "M"}).status_code == 402


def test_rutas_privadas_piden_sesion():
    c = TestClient(main.app)
    for ruta in ("/api/yo", "/api/objetivos", "/api/muebles", "/api/reportes"):
        assert c.get(ruta).status_code == 401
