"""Lista los textos visibles de la web (en español) que necesitan traducción.
Usa la misma regla de tokenización que build.mjs: un texto es lo que hay entre
delimitadores de HTML/JS (> < " ' ` { } $) y contiene alguna letra."""
import json, re
from pathlib import Path
RUN = re.compile(r'(?<=[>"\'`}])([^<>"\'`${}]*[A-Za-zÁÉÍÓÚÜáéíóúüñÑ¿¡][^<>"\'`${}]*)(?=[<"\'`$])')
CODIGO = re.compile(r'=>|\)\s*\.|\bconst\b|\bfunction\b|\breturn\b|;\s|\.\w+\(|^\s*[\w.-]+\s*$|^[#.]?[\w-]+:\s|var\(--|\bpx\b|^\s*[\w-]+=\s*$')
ES = re.compile(r'[áéíóúñÁÉÍÓÚÑ¿¡«»·]|\b(el|la|los|las|de|del|en|y|con|para|por|que|una?|tu|tus|es|al|se|sin|más|o)\b', re.I)
paginas = sorted(Path('.').glob('*.html'))
texto = '\n'.join(p.read_text(encoding='utf-8') for p in paginas if p.name != 'template.html')
vistos = {}
for m in RUN.finditer(texto):
    s = m.group(1).strip()
    if len(s) < 2 or CODIGO.search(s):
        continue
    if not ES.search(s) and not re.match(r'^[A-ZÁÉÍÓÚ][a-záéíóúñ]', s):
        continue
    vistos[s] = vistos.get(s, 0) + 1
Path('i18n/_pendientes.json').write_text(json.dumps(sorted(vistos), ensure_ascii=False, indent=0), encoding='utf-8')
print(len(vistos))
