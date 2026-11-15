"""MoonSiteUA - Verificacion ciudadana por consenso (balizas).

Decide el estado de un punto de interes (nodo) a partir de los reportes de
campo que suben los exploradores:

    GRIS      1 reporte valido. El punto existe, sin validez cientifica.
    NARANJA   2+ exploradores independientes con medidas consistentes.
    VERDE     5+ exploradores independientes, consistentes, en 2+ dias
              distintos, y de acuerdo con el dato satelital.
    DISPUTA   hay reportes suficientes pero se contradicen entre si.

"Independiente" significa: cuenta distinta con telefono verificado por OTP,
dispositivo distinto y dispositivo verificado (Play Integrity / App Attest). Cada explorador cuenta
una sola vez por nodo aunque suba varios reportes (se usa el ultimo).

Por que asi:
- Los moviles no tienen termometro ni higrometro: las medidas fiables son
  pendiente (inclinometro), altitud (barometro), brujula, fotos y el tipo de
  suelo de una lista cerrada. Temperatura y humedad solo cuentan si vienen de
  un sensor Bluetooth emparejado (campo `sensor_externo`).
- La temperatura cambia con la hora, asi que no se compara en bruto: se
  compara la anomalia frente al valor satelital del mismo momento.
- Modo Expedicion offline: el GPS funciona sin cobertura movil, asi que la
  posicion se guarda EN EL MOMENTO de la captura, junto con la hora, y el
  paquete se firma en el dispositivo. Al sincronizar se comprueba la firma, que
  no haya pasado demasiado tiempo y que el viaje entre el punto de captura y el
  punto de sincronizacion sea fisicamente posible (geofencing ampliado que
  crece con el tiempo transcurrido).
- Exigir varios dias evita que un grupo de amigos valide un sitio en una
  sola excursion.

Sin dependencias: solo biblioteca estandar.
"""
from __future__ import annotations

import math
import statistics
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime

GRIS, NARANJA, VERDE, DISPUTA = "gris", "naranja", "verde", "disputa"

# Configuracion (ajustable sin tocar la logica)
RADIO_NODO_M = 60          # distancia maxima a las coordenadas del nodo
PRECISION_GPS_MAX_M = 25   # se descartan lecturas con peor precision
MIN_NARANJA = 2
MIN_VERDE = 5
MIN_DIAS_VERDE = 2
# Tolerancia para considerar consistentes dos medidas numericas
TOLERANCIA = {
    "pendiente_deg": 4.0,
    "altitud_m": 25.0,
    "anomalia_temp_c": 3.0,   # medida - satelite del mismo momento
    "humedad_rel": 12.0,
}
CONSENSO_CATEGORICO = 0.6  # 60 % debe coincidir en tipo de suelo
ACUERDO_SATELITE_MIN = 0.7
# Modo Expedicion offline
MAX_DIAS_SYNC = 14            # paquetes mas antiguos se rechazan
VELOCIDAD_MAX_KMH = 120       # captura -> sincronizacion por carretera
MARGEN_SYNC_KM = 30           # margen fijo (zonas sin cobertura alrededor del sitio)


@dataclass
class Reporte:
    usuario: str
    dispositivo: str
    dispositivo_verificado: bool
    lat: float
    lon: float
    precision_m: float
    momento: datetime
    medidas: dict = field(default_factory=dict)   # p. ej. {"pendiente_deg": 12}
    tipo_suelo: str | None = None                 # lista cerrada: basalto, arcilla...
    sensor_externo: bool = False
    foto_en_vivo: bool = True                     # tomada con la camara de la app
    telefono_verificado: bool = True              # OTP por SMS en el registro
    # Modo Expedicion offline: lat/lon/momento son los de la CAPTURA
    capturado_offline: bool = False
    firma_valida: bool = True                     # paquete firmado con la clave del dispositivo
    sync_momento: datetime | None = None
    sync_lat: float | None = None
    sync_lon: float | None = None


@dataclass
class Nodo:
    id: str
    lat: float
    lon: float
    # Valores esperados segun satelite, para el acuerdo satelite-campo
    esperado: dict = field(default_factory=dict)
    zona_restringida: bool = False                # espacio protegido o peligroso
    reportes: list[Reporte] = field(default_factory=list)


def distancia_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def sincronizacion_valida(r: Reporte) -> bool:
    """Para reportes offline: firma correcta, subida a tiempo y viaje posible
    entre el punto de captura y el de sincronizacion."""
    if not r.capturado_offline:
        return True
    if not r.firma_valida or r.sync_momento is None or r.sync_lat is None:
        return False
    horas = (r.sync_momento - r.momento).total_seconds() / 3600
    if horas < 0 or horas > MAX_DIAS_SYNC * 24:
        return False
    km = distancia_m(r.lat, r.lon, r.sync_lat, r.sync_lon) / 1000
    return km <= MARGEN_SYNC_KM + VELOCIDAD_MAX_KMH * horas


def es_valido(nodo: Nodo, r: Reporte) -> bool:
    return (
        r.dispositivo_verificado
        and r.telefono_verificado
        and sincronizacion_valida(r)
        and r.foto_en_vivo
        and r.precision_m <= PRECISION_GPS_MAX_M
        and distancia_m(nodo.lat, nodo.lon, r.lat, r.lon) <= RADIO_NODO_M + r.precision_m
    )


def reportes_independientes(nodo: Nodo) -> list[Reporte]:
    """Un reporte por persona y dispositivo (el mas reciente)."""
    ultimo: dict[str, Reporte] = {}
    usados: set[str] = set()
    for r in sorted((r for r in nodo.reportes if es_valido(nodo, r)),
                    key=lambda r: r.momento, reverse=True):
        if r.usuario in ultimo or r.dispositivo in usados:
            continue
        ultimo[r.usuario] = r
        usados.add(r.dispositivo)
    return list(ultimo.values())


def _medidas_utiles(r: Reporte) -> dict:
    m = dict(r.medidas)
    if not r.sensor_externo:   # sin sensor fiable no cuentan
        m.pop("anomalia_temp_c", None)
        m.pop("humedad_rel", None)
    return m


def consistencia(reps: list[Reporte]) -> float:
    """Fraccion de comprobaciones (por variable) que pasan. 1.0 = todo coincide."""
    checks, ok = 0, 0
    variables = {k for r in reps for k in _medidas_utiles(r)}
    for var in variables:
        vals = [_medidas_utiles(r)[var] for r in reps if var in _medidas_utiles(r)]
        if len(vals) < 2:
            continue
        med = statistics.median(vals)
        for v in vals:
            checks += 1
            ok += abs(v - med) <= TOLERANCIA.get(var, float("inf"))
    suelos = [r.tipo_suelo for r in reps if r.tipo_suelo]
    if len(suelos) >= 2:
        checks += 1
        ok += Counter(suelos).most_common(1)[0][1] / len(suelos) >= CONSENSO_CATEGORICO
    return ok / checks if checks else 0.0


def acuerdo_satelite(nodo: Nodo, reps: list[Reporte]) -> float:
    """Que parte de lo esperado por satelite confirma el campo (mediana)."""
    checks, ok = 0, 0
    for var, esperado in nodo.esperado.items():
        vals = [_medidas_utiles(r)[var] for r in reps if var in _medidas_utiles(r)]
        if not vals:
            continue
        checks += 1
        ok += abs(statistics.median(vals) - esperado) <= 2 * TOLERANCIA.get(var, float("inf"))
    return ok / checks if checks else 1.0  # sin dato satelital comparable no penaliza


def estado(nodo: Nodo) -> dict:
    reps = reportes_independientes(nodo)
    n = len(reps)
    dias = len({r.momento.date() for r in reps})
    cons = consistencia(reps) if n >= 2 else 0.0
    sat = acuerdo_satelite(nodo, reps)

    if n == 0:
        e = None
    elif n < MIN_NARANJA:
        e = GRIS
    elif cons < 0.6:
        e = DISPUTA
    elif n >= MIN_VERDE and dias >= MIN_DIAS_VERDE and sat >= ACUERDO_SATELITE_MIN:
        e = VERDE
    else:
        e = NARANJA
    return {"nodo": nodo.id, "estado": e, "exploradores": n, "dias": dias,
            "consistencia": round(cons, 2), "acuerdo_satelite": round(sat, 2)}


# ---------------------------------------------------------------- misiones

VARIABLES_REQUERIDAS = ["pendiente_deg", "altitud_m", "tipo_suelo",
                        "anomalia_temp_c", "humedad_rel"]


def huecos_de_datos(nodo: Nodo) -> list[str]:
    reps = reportes_independientes(nodo)
    faltan = []
    for var in VARIABLES_REQUERIDAS:
        if var == "tipo_suelo":
            n = sum(1 for r in reps if r.tipo_suelo)
        else:
            n = sum(1 for r in reps if var in _medidas_utiles(r))
        if n < MIN_NARANJA:
            faltan.append(var)
    return faltan


def misiones(nodo: Nodo) -> list[dict]:
    """Genera 'Objetivos locales' a partir de los huecos. Nunca en zonas
    restringidas: no se premia ir a sitios protegidos o peligrosos."""
    if nodo.zona_restringida:
        return []
    out = []
    for var in huecos_de_datos(nodo):
        externo = var in ("anomalia_temp_c", "humedad_rel")
        out.append({
            "nodo": nodo.id, "variable": var,
            "requiere_sensor_externo": externo,
            "multiplicador": 3 if externo else 2,
        })
    return out


# ---------------------------------------------------------------- misiones globales
# Retos mensuales para mantener a la comunidad activa. Cuentan nodos distintos
# (no reportes) para que no compense repetir el mismo sitio.

MISIONES_GLOBALES = [
    {"id": "karst", "texto": "Documenta 3 zonas kársticas este mes", "suelo": "caliza", "objetivo": 3},
    {"id": "basalto", "texto": "Mide la pendiente en 3 coladas basálticas", "suelo": "basalto", "objetivo": 3},
    {"id": "salinas", "texto": "Fotografía 2 salinas o costras de sal", "suelo": "sal", "objetivo": 2},
]


def progreso_global(usuario: str, nodos: list[Nodo], mision: dict, anio: int, mes: int) -> dict:
    hechos = {
        n.id for n in nodos if not n.zona_restringida
        for r in n.reportes
        if r.usuario == usuario and r.tipo_suelo == mision["suelo"]
        and r.momento.year == anio and r.momento.month == mes and es_valido(n, r)
    }
    return {"mision": mision["id"], "hechos": len(hechos), "objetivo": mision["objetivo"],
            "completada": len(hechos) >= mision["objetivo"]}


# ---------------------------------------------------------------- nivel 3: escalado robótico
# Zonas de alto interés pero demasiado peligrosas o inaccesibles para civiles
# (cuevas profundas, chimeneas volcánicas, acantilados). El acceso público
# queda bloqueado (misiones() devuelve []) y el nodo se deriva a una Misión
# Automatizada con universidades y agencias: drones o rovers con cámaras
# multiespectrales y sensores de precisión que completan el perfil del análogo.

UMBRAL_IAP_ROBOTICA = 65.0


def escalado_robotico(nodo: Nodo, iap: float) -> dict | None:
    """Devuelve la misión automatizada si el nodo debe pasar al nivel 3.
    Criterio: zona restringida Y (IAP alto del motor satelital O ya tiene
    validación parcial de exploradores en el perímetro seguro)."""
    if not nodo.zona_restringida:
        return None
    e = estado(nodo)["estado"]
    if iap < UMBRAL_IAP_ROBOTICA and e not in (NARANJA, VERDE):
        return None
    faltan = huecos_de_datos(nodo)
    return {
        "nodo": nodo.id,
        "nivel": 3,
        "acceso": "instituciones",          # universidades y agencias acreditadas
        "plataformas": ["dron", "rover terrestre"],
        "sensores": ["cámara multiespectral", "espectrómetro de campo", "LiDAR"],
        "objetivo": "composición de rocas y suelo" + (f"; además: {', '.join(faltan)}" if faltan else ""),
        "motivo": "IAP alto" if iap >= UMBRAL_IAP_ROBOTICA else "validación parcial en el perímetro",
    }
