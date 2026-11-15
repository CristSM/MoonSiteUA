"""MoonSiteUA - Indice de Analogia Planetaria (IAP).

Convierte variables fisicas de un lugar de la Tierra (sacadas de datos NASA
con engine/gee_analog_score.js) a 9 ejes 0-1 y las compara con un perfil
objetivo de la Luna o Marte (engine/targets.json).

    IAP = 100 * sum(w_i * (1 - |x_i - t_i|)) / sum(w_i)

Ademas de la nota global, devuelve la similitud por eje, que es lo que
permite explicar "en que se parece y en que no", como pide el reto.

La misma formula esta implementada en JavaScript en web/index.html y en
Earth Engine en engine/gee_analog_score.js. Si cambias una, cambia las tres.

Uso:
    python analog_score.py                 # ranking de todos los objetivos
    python analog_score.py marte_jezero    # ranking de un objetivo
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
AXES = ["aridez", "desnudez", "frio", "amplitud", "mafico",
        "relieve", "altitud", "polvo", "hielo"]


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def normalize(site: dict) -> dict:
    """Variables fisicas -> ejes 0-1 (1 = mas extremo / mas planetario)."""
    return {
        # 0 mm/ano -> 1 ; 3000 mm/ano -> 0 (escala logaritmica)
        "aridez": clamp01(1 - math.log10(site["precip_mm"] + 1) / math.log10(3001)),
        # NDVI <= 0.05 -> 1 ; NDVI >= 0.5 -> 0
        "desnudez": clamp01(1 - (site["ndvi_max"] - 0.05) / 0.45),
        # +30 C -> 0 ; -50 C -> 1
        "frio": clamp01((30 - site["lst_media_c"]) / 80),
        # 0 C -> 0 ; 40 C o mas -> 1
        "amplitud": clamp01(site["lst_amplitud_c"] / 40),
        # cociente de emisividad: 0.85 (rico en silice) -> 0 ; 0.98 (basaltico) -> 1
        "mafico": clamp01((site["mafico_ratio"] - 0.85) / 0.13),
        "relieve": clamp01(site["pendiente_deg"] / 25),
        "altitud": clamp01(site["altitud_m"] / 5000),
        "polvo": clamp01(site["aod"] / 0.6),
        "hielo": clamp01(site["nieve_frac"]),
    }


def score(axes: dict, target: dict) -> dict:
    sims = {a: 1 - abs(axes[a] - target["valores"][a]) for a in AXES}
    w = target["pesos"]
    total = sum(w[a] * sims[a] for a in AXES) / sum(w[a] for a in AXES)
    # Ejes que mas pesan en el resultado, para la ficha del sitio
    ranked = sorted(AXES, key=lambda a: sims[a] * w[a], reverse=True)
    weak = sorted(AXES, key=lambda a: (sims[a], -w[a]))
    return {
        "iap": round(100 * total, 1),
        "similitud": {a: round(sims[a], 3) for a in AXES},
        "fortalezas": [a for a in ranked if sims[a] >= 0.75][:3],
        "rupturas": [a for a in weak if sims[a] < 0.6][:3],
    }


def load(name: str) -> dict:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def rank(sites: list[dict], target: dict) -> list[dict]:
    rows = []
    for s in sites:
        r = score(normalize(s), target)
        rows.append({"id": s["id"], "nombre": s["nombre"], **r})
    return sorted(rows, key=lambda r: r["iap"], reverse=True)


def main(argv: list[str]) -> None:
    targets = load("targets.json")["targets"]
    sites = load("sites_demo.json")["sites"]
    wanted = argv[1:] or [t["id"] for t in targets]
    for t in targets:
        if t["id"] not in wanted:
            continue
        print(f"\n== {t['nombre']} ==")
        for r in rank(sites, t):
            print(f"{r['iap']:5.1f}  {r['nombre']:<34} +{','.join(r['fortalezas']) or '-':<28} "
                  f"-{','.join(r['rupturas']) or '-'}")


if __name__ == "__main__":
    main(sys.argv)
