"""Convierte el GeoJSON exportado por gee_analog_score.js (moonsiteua_sitios)
en engine/sites.json, conservando nombres, notas y balizas de sites_demo.json.

    python import_gee.py moonsiteua_sitios.geojson
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CAMPOS = ["precip_mm", "ndvi_max", "lst_media_c", "lst_amplitud_c", "mafico_ratio",
          "pendiente_deg", "altitud_m", "aod", "nieve_frac"]


def main(path: str) -> None:
    demo = json.loads((HERE / "sites_demo.json").read_text(encoding="utf-8"))
    gee = {f["properties"]["id"]: f["properties"]
           for f in json.loads(Path(path).read_text(encoding="utf-8"))["features"]}
    faltan = []
    for s in demo["sites"]:
        props = gee.get(s["id"], {})
        for c in CAMPOS:
            if props.get(c) is not None:
                s[c] = round(float(props[c]), 3)
            else:
                faltan.append(f"{s['id']}.{c}")
    demo["_doc"] = "Variables calculadas con Earth Engine (gee_analog_score.js). " \
                   "Campos sin dato conservan el valor estimado de la demo: " + (", ".join(faltan) or "ninguno")
    (HERE / "sites.json").write_text(json.dumps(demo, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"sites.json escrito. Campos sin dato de GEE: {len(faltan)}")


if __name__ == "__main__":
    main(sys.argv[1])
