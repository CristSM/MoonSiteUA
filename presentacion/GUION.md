# Guion de la presentación (3–4 minutos)

Cada bloque corresponde a una diapositiva. Dentro de la presentación, la tecla `N` muestra el bloque de la diapositiva actual.

## 1 · Portada

Buenos días. Somos el grupo MoonSiteUA y os vamos a presentar nuestros resultados buscando localizaciones terrestres análogas a las bases lunares y marcianas, así como a los sitios de aterrizaje.

## 2 · Método: medimos la Tierra como se mide la Luna

Nuestro método se basa en discretizar toda la superficie terrestre en celdas de unos cinco kilómetros de lado, casi ocho millones en total. Partiendo de los datos proporcionados por la NASA y sus agencias colaboradoras, calculamos en cada celda parámetros representativos como la aridez, la pendiente o los minerales, con el relieve medido a unos 400 metros de detalle, para poder decidir de manera objetiva qué sitios merecen ser estudiados.

Siendo realistas, hay parámetros que no pueden simularse en nuestro planeta, como la iluminación poco difusa del polo sur lunar o la abrasividad del regolito.

## 3 · Método: de cada celda, un índice de similitud

Las características más relevantes de cada terreno se comparan una a una con las mismas características de más de mil puntos de interés de la Luna y Marte. Con ello obtenemos un vector con una puntuación para cada parámetro, que finalmente se pondera para obtener un indicador de similitud.

Esa ponderación se repite 200 veces variando los pesos de cada característica, para asegurarnos de que nuestra elección de pesos no sesga los resultados.

## 4 · Validación y novedad

Los resultados se validan con los sitios que las agencias espaciales usan en el día a día. Los más utilizados, como Atacama o los Valles Secos de la Antártida, quedan por encima del percentil 99 de nuestro método, y la mayoría de los demás, por encima del 95.

Para asegurarnos de la novedad de nuestra propuesta usamos OpenAlex: revisamos cuántos estudios publicados tratan ya cada lugar como análogo y ponderamos de forma inversa a ese número de artículos.

## 5 · Resultados: tres lugares por descubrir

De esta manera hemos detectado tres lugares que están en lo más alto de nuestro método, con un índice de similitud de entre 80 y 88 sobre 100, y que apenas se han estudiado: los montes Pensacola, en la Antártida, similares al polo sur lunar; el macizo volcánico del Nabro, en Eritrea, como análogo de las cuevas y tubos de lava marcianos; y Burj Umar Idris, en Argelia, como sitio de interés astrobiológico. De los dos últimos no hemos encontrado ni un solo artículo que los estudie como análogos.

## 6 · Puente: el satélite no lo ve todo

Sin embargo, estos datos espaciales tienen limitaciones. No pueden decirnos qué cuevas tienen interés científico y cuáles no. Por ello, hemos ideado la siguiente propuesta.

## 7 · Vídeo de fondo (40 s)

La exploración espacial no debe ser un monopolio: es algo de la humanidad para la humanidad, y las personas debemos permanecer en el centro de ella.

A día de hoy muy poca gente puede llegar a sentirse parte de estas misiones espaciales, y eso debe cambiar.

Proponemos que la validación y la exploración de estos sitios las lleven a cabo personas.

Nuestro concepto de app se basa en recompensar a los usuarios que decidan visitar estos sitios y documentar los datos que la NASA necesite, como la pendiente, la temperatura o la humedad, haciendo así partícipes a las personas de la carrera espacial.

Nuestro método se encarga de proponer los lugares de estudio, que después deberán validarse in situ.

Como esto puede conllevar riesgos, será necesario acreditar experiencia en espeleología o montañismo para poder acceder a las coordenadas de los sitios más complejos.

## 8 · La web, en vivo

Y ahora os enseñamos la web en vivo.

## 9 · Código QR

Si queréis entrar en la web, podéis hacerlo con este código QR. Muchas gracias.

---

## Cambios respecto al guion original

- «Píxeles de medio kilómetro de lado» pasa a «celdas de unos cinco kilómetros de lado», con el relieve medido a unos 400 metros. La rejilla es de 0,05° (unos 5,5 km).
- «Todos ellos en el percentil 95» pasa a «los más utilizados por encima del 99 y la mayoría de los demás por encima del 95». Superan el 95 solo 6 de 14 análogos lunares, 25 de 32 de cuevas y 16 de 29 de Marte.
- «Percentil 80 y superior» pasa a «índice de similitud de entre 80 y 88 sobre 100» (79,9; 88,2 y 86,2). Los tres están en el 0,1 % más parecido de la Tierra.
- «Tres lugares poco estudiados» se matiza: de Nabro y de Burj Umar Idris hay 0 artículos; de los montes Pensacola la novedad no se pudo evaluar porque el punto no tiene topónimo.
- «Penascola Mountain» pasa a «montes Pensacola».
- «Densidad de citas» pasa a «número de artículos», que es lo que se cuenta.
