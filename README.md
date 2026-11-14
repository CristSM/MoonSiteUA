# MoonSiteUA

El concepto: Una plataforma gamificada de ciencia ciudadana que transforma la búsqueda de análogos lunares y marcianos en una exploración colaborativa global. Los usuarios actúan como "rovers humanos", recopilando datos sobre el terreno para validar zonas de interés predefinidas por datos satelitales o descubrir nuevos micro-análogos.

1. El Motor de Datos y el Mapa Interactivo
El núcleo de la plataforma es un mapa interactivo (segmentado por países para optimizar el rendimiento) que se alimenta de dos fuentes:

Capa Base (Datos Oficiales): Zonas "calientes" predefinidas a través de cruces de datos satelitales (NASA, ESA). Estas áreas aparecen en el mapa como "Zonas de Interés no exploradas".

Capa Comunitaria: Puntos de interés generados por los propios usuarios al descubrir entornos con similitudes geológicas o climáticas (formaciones basálticas, zonas kársticas, extremos térmicos).

2. Sistema de Validación Científica por Consenso (Crowd-Verification)
Para garantizar el rigor científico que exige el reto sin depender de verificaciones manuales centralizadas, el mapa utiliza un sistema de balizas semafóricas:

Baliza Gris (Descubrimiento): Un usuario sube los primeros datos in situ (temperatura, humedad, tipo de suelo). El punto existe, pero no tiene validez científica aún.

Baliza Naranja (En Verificación): Entre 2 y 3 usuarios independientes han acudido a las mismas coordenadas (con un margen de error GPS mínimo) y han reportado métricas consistentes.

Baliza Verde (Análogo Confirmado): Cuando de 5 a 10 exploradores validan los datos, la zona se consolida en la base de datos como un análogo terrestre legítimo.

3. Gamificación y Economía de Recompensas
El sistema de incentivos está diseñado para fomentar tanto la calidad de los datos como la retención del usuario a través de una economía dual:

Puntos de Exploración (Virtuales): Se obtienen por acciones comunes (validar un punto, subir fotos, medir temperatura). Sirven como moneda de cambio para cosméticos digitales dentro de la app.

Puntos de Misión (Físicos): Moneda premium muy escasa. Se otorgan al liderar expediciones validadas o completar objetivos de alto valor. Se canjean por merchandising oficial (pins, parches de misión, camisetas).

Insignias: Por ejemplo, el primer usuario en documentar un nuevo análogo validado recibe un título inmutable en el historial de ese nodo.

4. Construcción de Hábitats Virtuales (El Bucle Social)
Esta es la mecánica clave para generar comunidad. Cada análogo confirmado en el mundo real se convierte en una "Base Espacial" en el mundo virtual.

El Módulo Génesis: El descubridor original funda la base, eligiendo los dos colores corporativos de la misma y decorando el primer "módulo de habitabilidad" usando sus puntos virtuales (muebles, estaciones de trabajo, banderas).

Expansión Modular: Cada nuevo explorador que viaja físicamente a esa zona y valida datos, gana el derecho a acoplar su propio módulo a la base matriz, decorándolo a su gusto. Las bases más visitadas se convierten en gigantescas colonias virtuales colaborativas.

5. Sistema de Misiones Dirigidas (Bounties)
Para evitar que los usuarios recopilen datos irrelevantes, el sistema genera misiones dinámicas basadas en los huecos de información (Data Gaps).

Si un análogo en España tiene datos validados de temperatura y suelo, pero falta humedad, el sistema lanza un "Objetivo Local": Se buscan lecturas de higrómetro en las coordenadas X. Recompensa: Triple puntuación virtual.

Misiones globales como "Documenta 3 zonas kársticas este mes" mantienen la retención a largo plazo.

6. Arquitectura de Seguridad
Para evitar ataques Sybil (granjas de bots) y asegurar la trazabilidad sin comprometer datos personales sensibles (como el DNI):

Autenticación y Verificación Única (OAuth + OTP): Registro inicial a través de cuentas sociales (Google, Apple) blindado con una verificación obligatoria por SMS (One-Time Password). Vincular un número de teléfono único e irrepetible a cada perfil impide que un mismo usuario genere múltiples cuentas de correo para falsear validaciones, erradicando los ataques de bots y garantizando que cada explorador que sube datos al mapa es una persona real.

Validación de Proximidad Transparente (Modo Expedición offline): Dado que los análogos más puros (cuevas, cañones, desiertos remotos) suelen carecer de cobertura o señal de satélite, la recolección de datos in situ se realiza de forma asíncrona. Una vez que el usuario regresa a una zona con conexión, la plataforma lanza una notificación explícita solicitando acceso puntual al GPS para sincronizar. El sistema verifica entonces que el dispositivo se encuentra dentro de un radio geográfico lógico (geofencing ampliado) respecto a las coordenadas del análogo antes de autorizar la subida del paquete de datos. Esto evita envíos fraudulentos desde el sofá de casa o desde otros países, garantizando la veracidad científica mientras se respeta de forma absoluta la privacidad del explorador.

7. Escalación Robótica y Análisis Multiespectral (Validación Tier 3):
Para aquellas zonas que alcanzan un alto índice de interés geológico pero son catalogadas como demasiado peligrosas, extremas o inaccesibles para la exploración humana civil (cuevas profundas, chimeneas volcánicas, acantilados), el sistema bloquea el acceso público por seguridad. En su lugar, estas coordenadas excepcionales o altamente verificadas se derivan a un programa de "Misiones Automatizadas" en colaboración con universidades y agencias espaciales. Estas instituciones toman el relevo desplegando drones o rovers terrestres equipados con cámaras multiespectrales y sensores de alta precisión para analizar la composición exacta de rocas y tierra, completando el perfil del análogo sin poner en riesgo vidas humanas y cerrando la brecha entre la ciencia ciudadana y la investigación profesional.
