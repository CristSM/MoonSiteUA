# Presentación de MoonSiteUA

Abrir `index.html` en Chrome o Edge (doble clic). Necesita conexión para cargar las tipografías; sin conexión se ven con una letra de reserva.

## Teclas

- `→`, espacio o clic: siguiente. `←`: anterior.
- `F`: pantalla completa.
- `N`: muestra u oculta el guion de la diapositiva.

## Diapositivas

1. Portada.
2. Método: celdas, parámetros y lo que la Tierra no puede imitar.
3. Método: comparar, puntuar, ponderar y repetir (200 sorteos).
4. Validación con análogos conocidos y novedad con OpenAlex.
5. Resultados: los tres lugares, con foto real y relieve del gemelo.
6. Puente: el satélite no lo ve todo.
7. Vídeo de fondo (`fondo.mp4`, 40 s, sin sonido). Empieza solo al entrar y se queda en el último fotograma.
8. La web, en vivo.
9. Código QR de la web (`img/qr.png`, apunta a https://cristsm.github.io/MoonSiteUA/).

## Fotos (dominio público)

| Archivo | Qué es | Fuente |
|---|---|---|
| `img/pensacola.jpg` | Macizo Dufek, montes Pensacola (Antártida), desde un vuelo de Operation IceBridge, 2018 | NASA / John Sonntag. https://commons.wikimedia.org/wiki/File:Dufek_Massif_and_Cordiner_Peaks.jpg |
| `img/nabro.jpg` | Volcán Nabro (Eritrea), foto de astronauta desde la ISS, enero de 2011 | NASA Johnson Space Center / NASA Earth Observatory. https://commons.wikimedia.org/wiki/File:Nabro_Volcano_Before_2011_Eruption.JPG |
| `img/burj.jpg` | Burj Umar Idris (Argelia), 26,60–26,95° N · 5,93–6,53° E, imagen Landsat del 10-mar-2024 | NASA Harmonized Landsat Sentinel-2 (HLS L30), servida por NASA GIBS |
| `img/af_*.png` | Relieve sombreado del sitio y de su gemelo | Analog Finder (Copernicus DEM, LRO LOLA, MGS MOLA) |

Las obras de la NASA no tienen derechos de autor en Estados Unidos; conviene mantener el crédito que aparece en cada foto.

## Cómo se regenera el vídeo de fondo

Con el servidor de la web en `localhost:8000` y, en la carpeta `video/`:

```bash
python -m http.server 8123
```

```bash
PAGINA=fondo.html DUR=40 SALIDA=../presentacion/fondo.mp4 node render.mjs es
```

Los textos y los tiempos están en `video/fondo.html`.
