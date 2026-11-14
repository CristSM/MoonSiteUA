from datetime import datetime, timedelta
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))

import verification as v
import analog_score as a

T0 = datetime(2026, 11, 14, 12, 0)


def rep(i, dia=0, pendiente=12.0, suelo="basalto", verificado=True, lat=37.05, lon=-2.39,
        precision=8, usuario=None, dispositivo=None, **extra):
    return v.Reporte(usuario=usuario or f"u{i}", dispositivo=dispositivo or f"d{i}",
                     dispositivo_verificado=verificado, lat=lat, lon=lon, precision_m=precision,
                     momento=T0 + timedelta(days=dia, minutes=i),
                     medidas={"pendiente_deg": pendiente, **extra}, tipo_suelo=suelo)


def nodo(reps, **kw):
    return v.Nodo(id="tabernas-01", lat=37.05, lon=-2.39, reportes=reps, **kw)


def test_un_reporte_es_gris():
    assert v.estado(nodo([rep(1)]))["estado"] == v.GRIS


def test_dos_consistentes_es_naranja():
    assert v.estado(nodo([rep(1), rep(2, pendiente=13)]))["estado"] == v.NARANJA


def test_cinco_en_un_solo_dia_no_es_verde():
    assert v.estado(nodo([rep(i) for i in range(5)]))["estado"] == v.NARANJA


def test_cinco_en_dos_dias_es_verde():
    reps = [rep(i, dia=i % 2) for i in range(5)]
    assert v.estado(nodo(reps))["estado"] == v.VERDE


def test_misma_persona_cuenta_una_vez():
    reps = [rep(i, dia=i % 2, usuario="u1") for i in range(6)]
    assert v.estado(nodo(reps))["exploradores"] == 1


def test_mismo_dispositivo_con_varias_cuentas_cuenta_una_vez():
    reps = [rep(i, dia=i % 2, dispositivo="granja") for i in range(6)]
    assert v.estado(nodo(reps))["exploradores"] == 1


def test_dispositivo_no_verificado_y_gps_lejano_se_descartan():
    reps = [rep(1, verificado=False), rep(2, lat=37.10), rep(3, precision=200)]
    assert v.estado(nodo(reps))["estado"] is None


def test_medidas_contradictorias_dan_disputa():
    reps = [rep(1, pendiente=2, suelo="arena"), rep(2, pendiente=30, suelo="basalto"),
            rep(3, pendiente=15, suelo="arcilla")]
    assert v.estado(nodo(reps))["estado"] == v.DISPUTA


def test_desacuerdo_con_satelite_impide_verde():
    reps = [rep(i, dia=i % 2, pendiente=30) for i in range(5)]
    n = nodo(reps, esperado={"pendiente_deg": 10})
    assert v.estado(n)["estado"] == v.NARANJA


def test_temperatura_sin_sensor_externo_no_cuenta():
    reps = [rep(1, anomalia_temp_c=1.0), rep(2, anomalia_temp_c=1.5)]
    assert "anomalia_temp_c" in v.huecos_de_datos(nodo(reps))


def test_misiones_por_huecos_y_no_en_zona_restringida():
    n = nodo([rep(1), rep(2)])
    vars_ = {m["variable"] for m in v.misiones(n)}
    assert "humedad_rel" in vars_ and "pendiente_deg" not in vars_
    assert v.misiones(nodo([rep(1)], zona_restringida=True)) == []


def test_sin_otp_no_cuenta():
    r = rep(1); r.telefono_verificado = False
    assert v.estado(nodo([r]))["estado"] is None


def offline(i, horas, sync_lat, sync_lon, firma=True):
    r = rep(i)
    r.capturado_offline, r.firma_valida = True, firma
    r.sync_momento, r.sync_lat, r.sync_lon = r.momento + timedelta(hours=horas), sync_lat, sync_lon
    return r


def test_offline_sincronizado_en_almeria_es_valido():
    # captura en Tabernas, sincroniza 2 h despues en Almeria capital (~30 km)
    assert v.estado(nodo([offline(1, 2, 36.84, -2.46)]))["estado"] == v.GRIS


def test_offline_viaje_imposible_se_rechaza():
    # dice estar en Tabernas pero sincroniza 1 h despues en Buenos Aires
    assert v.estado(nodo([offline(1, 1, -34.6, -58.4)]))["estado"] is None


def test_offline_firma_invalida_o_paquete_viejo_se_rechaza():
    assert v.estado(nodo([offline(1, 2, 36.84, -2.46, firma=False)]))["estado"] is None
    assert v.estado(nodo([offline(2, 24 * 20, 36.84, -2.46)]))["estado"] is None


# --------- indice de analogia

def test_iap_identico_al_objetivo_es_100():
    t = {"valores": {k: 0.5 for k in a.AXES}, "pesos": {k: 1 for k in a.AXES}}
    assert a.score({k: 0.5 for k in a.AXES}, t)["iap"] == 100.0


def test_normalizacion_en_rango_y_ranking_estable():
    sites = a.load("sites_demo.json")["sites"]
    for s in sites:
        assert all(0 <= x <= 1 for x in a.normalize(s).values())
    jezero = next(t for t in a.load("targets.json")["targets"] if t["id"] == "marte_jezero")
    ranking = a.rank(sites, jezero)
    assert ranking[0]["iap"] >= ranking[-1]["iap"]


def test_mision_global_cuenta_nodos_distintos():
    karst = v.MISIONES_GLOBALES[0]
    n1 = v.Nodo(id="a", lat=37.05, lon=-2.39, reportes=[rep(1, usuario="ana", suelo="caliza"), rep(2, usuario="ana", suelo="caliza")])
    n2 = v.Nodo(id="b", lat=37.05, lon=-2.39, reportes=[rep(3, usuario="ana", suelo="caliza")])
    p = v.progreso_global("ana", [n1, n2], karst, 2026, 11)
    assert p["hechos"] == 2 and not p["completada"]


def test_escalado_robotico_solo_en_zona_restringida_de_interes():
    peligrosa = nodo([], zona_restringida=True)
    assert v.escalado_robotico(peligrosa, iap=72)["nivel"] == 3
    assert v.escalado_robotico(peligrosa, iap=40) is None
    assert v.escalado_robotico(nodo([]), iap=90) is None          # zona abierta: la hacen los exploradores
    parcial = nodo([rep(1), rep(2)], zona_restringida=True)       # validada desde el perímetro
    assert v.escalado_robotico(parcial, iap=40)["motivo"].startswith("validación")
    assert v.misiones(peligrosa) == []                            # el público no recibe misiones
