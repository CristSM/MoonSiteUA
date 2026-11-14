-- MoonSiteUA · Esquema de base de datos (SQLite)
-- Se crea automáticamente al arrancar la app (app/db.py). Datos iniciales en app/seed.py.

PRAGMA foreign_keys = ON;

-- ============================================================ GEOGRAFÍA
-- Jerarquía flexible: provincia -> país -> unión / estado / continente.
-- Una región puede tener varios padres (España pertenece a la UE y a Europa),
-- por eso la relación va en una tabla aparte (N:M).
CREATE TABLE IF NOT EXISTS regiones (
    id      INTEGER PRIMARY KEY,
    nombre  TEXT NOT NULL,
    tipo    TEXT NOT NULL CHECK (tipo IN ('continente', 'union', 'pais', 'estado', 'region', 'provincia', 'territorio')),
    codigo  TEXT UNIQUE                       -- ISO 3166 cuando existe (ES, ES-A, EU...)
);

CREATE TABLE IF NOT EXISTS region_padres (
    region_id INTEGER NOT NULL REFERENCES regiones(id) ON DELETE CASCADE,
    padre_id  INTEGER NOT NULL REFERENCES regiones(id) ON DELETE CASCADE,
    PRIMARY KEY (region_id, padre_id),
    CHECK (region_id <> padre_id)
);

-- ============================================================ USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id             INTEGER PRIMARY KEY,
    nombre         TEXT NOT NULL,
    apellido       TEXT NOT NULL,
    username       TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- "Ana" y "ana" son el mismo
    email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    telefono       TEXT NOT NULL UNIQUE,                  -- normalizado: +34600111222
    pass_hash      TEXT NOT NULL,                         -- scrypt, nunca la contraseña
    pass_salt      TEXT NOT NULL,
    region_id      INTEGER REFERENCES regiones(id),
    creado         TEXT NOT NULL DEFAULT (datetime('now')),
    ultimo_dia_login TEXT                                 -- para la recompensa diaria
);

CREATE TABLE IF NOT EXISTS sesiones (
    token       TEXT PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira      TEXT NOT NULL
);

-- ============================================================ MONEDAS
-- Libro de movimientos: el saldo es la suma. Así queda registrado por qué
-- se ganó o gastó cada moneda y no se puede "inventar" saldo.
CREATE TABLE IF NOT EXISTS movimientos (
    id          INTEGER PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    moneda      TEXT NOT NULL CHECK (moneda IN ('moon', 'mars')),
    cantidad    INTEGER NOT NULL CHECK (cantidad <> 0),   -- positivo gana, negativo gasta
    motivo      TEXT NOT NULL,
    fecha       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_mov_usuario ON movimientos(usuario_id, moneda);

CREATE VIEW IF NOT EXISTS saldos AS
SELECT u.id AS usuario_id,
       COALESCE(SUM(CASE WHEN m.moneda = 'moon'  THEN m.cantidad END), 0) AS moon,
       COALESCE(SUM(CASE WHEN m.moneda = 'mars' THEN m.cantidad END), 0) AS mars
FROM usuarios u LEFT JOIN movimientos m ON m.usuario_id = u.id
GROUP BY u.id;

-- ============================================================ ZONAS Y FOTOS
-- Zonas recomendadas (calculadas con datos NASA por el motor) y zonas
-- descubiertas por la comunidad.
CREATE TABLE IF NOT EXISTS zonas (
    id            INTEGER PRIMARY KEY,
    clave         TEXT UNIQUE,                   -- id del sitio en engine/sites*.json
    nombre        TEXT NOT NULL,
    lat           REAL NOT NULL,
    lon           REAL NOT NULL,
    radio_m       INTEGER NOT NULL DEFAULT 3000,
    region_id     INTEGER REFERENCES regiones(id),
    recomendada   INTEGER NOT NULL DEFAULT 0,    -- 1 = punto recomendado por datos NASA
    restringida   INTEGER NOT NULL DEFAULT 0,    -- nivel 3: sin acceso público
    perfil_json   TEXT,                          -- variables físicas del motor
    nota          TEXT,
    creada_por    INTEGER REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS reportes (
    id           INTEGER PRIMARY KEY,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    zona_id      INTEGER REFERENCES zonas(id),   -- zona más cercana si está dentro del radio
    lat          REAL NOT NULL,
    lon          REAL NOT NULL,
    foto         TEXT NOT NULL,                  -- nombre del archivo en app/uploads
    tipo_suelo   TEXT NOT NULL,
    vegetacion   TEXT NOT NULL CHECK (vegetacion IN ('nada', 'escasa', 'abundante')),
    pendiente_deg REAL,
    altitud_m    REAL,
    nota         TEXT,
    comparacion_json TEXT NOT NULL,              -- resultado de la comparación
    fecha        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_rep_usuario ON reportes(usuario_id);

-- ============================================================ BASES
-- Una base por zona. El fundador elige los dos colores (se pueden repetir
-- entre bases). Cada miembro tiene una habitación; 5 habitaciones por planta.
CREATE TABLE IF NOT EXISTS bases (
    id          INTEGER PRIMARY KEY,
    zona_id     INTEGER NOT NULL UNIQUE REFERENCES zonas(id),
    nombre      TEXT NOT NULL,
    fundador_id INTEGER NOT NULL REFERENCES usuarios(id),
    color1      TEXT NOT NULL CHECK (color1 GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
    color2      TEXT NOT NULL CHECK (color2 GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
    creada      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habitaciones (
    id            INTEGER PRIMARY KEY,
    base_id       INTEGER NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    numero        INTEGER NOT NULL,              -- 1, 2, 3... ; planta = (numero - 1) / 5 + 1
    color_pared   TEXT NOT NULL DEFAULT '#dfe6f0',
    color_suelo   TEXT NOT NULL DEFAULT '#5b6578',
    cama_id       INTEGER REFERENCES muebles(id),
    escritorio_id INTEGER REFERENCES muebles(id),
    UNIQUE (base_id, numero),
    UNIQUE (base_id, usuario_id)                 -- una habitación por persona y base
);

-- ============================================================ MUEBLES
CREATE TABLE IF NOT EXISTS muebles (
    id          INTEGER PRIMARY KEY,
    tipo        TEXT NOT NULL CHECK (tipo IN ('cama', 'escritorio', 'decoracion')),
    hueco       TEXT,                            -- solo decoraciones: dónde va
    clave       TEXT NOT NULL UNIQUE,            -- diseño en app/static/disenos.js
    nombre      TEXT NOT NULL,
    precio_moon INTEGER NOT NULL DEFAULT 0,
    CHECK ((tipo = 'decoracion') = (hueco IS NOT NULL)),
    CHECK (hueco IS NULL OR hueco IN ('pared_izq', 'pared_der', 'suelo', 'techo', 'alfombra'))
);

CREATE TABLE IF NOT EXISTS inventario (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mueble_id  INTEGER NOT NULL REFERENCES muebles(id),
    PRIMARY KEY (usuario_id, mueble_id)
);

-- Una decoración por hueco: así la habitación no se llena sin límite
CREATE TABLE IF NOT EXISTS habitacion_decoraciones (
    habitacion_id INTEGER NOT NULL REFERENCES habitaciones(id) ON DELETE CASCADE,
    hueco         TEXT NOT NULL,
    mueble_id     INTEGER NOT NULL REFERENCES muebles(id),
    PRIMARY KEY (habitacion_id, hueco)
);

-- ============================================================ OBJETIVOS
-- ambito 'individual': cada usuario el suyo. 'base': compartido por todos
-- los miembros de una base (al completarse, cobra cada miembro).
CREATE TABLE IF NOT EXISTS objetivos (
    id          INTEGER PRIMARY KEY,
    clave       TEXT NOT NULL UNIQUE,
    ambito      TEXT NOT NULL CHECK (ambito IN ('individual', 'base')),
    periodo     TEXT NOT NULL CHECK (periodo IN ('unico', 'diario', 'semanal', 'mensual')),
    evento      TEXT NOT NULL,                   -- qué acción suma progreso
    titulo      TEXT NOT NULL,
    meta        INTEGER NOT NULL CHECK (meta > 0),
    moneda      TEXT NOT NULL CHECK (moneda IN ('moon', 'mars')),
    recompensa  INTEGER NOT NULL CHECK (recompensa > 0)
);

CREATE TABLE IF NOT EXISTS progreso_objetivos (
    objetivo_id INTEGER NOT NULL REFERENCES objetivos(id),
    sujeto_id   INTEGER NOT NULL,                -- usuario_id o base_id según el ámbito
    periodo_clave TEXT NOT NULL,                 -- '2026-11-14', '2026-W46', '2026-11', 'unico'
    progreso    INTEGER NOT NULL DEFAULT 0,
    completado  TEXT,                            -- fecha en que se alcanzó la meta
    PRIMARY KEY (objetivo_id, sujeto_id, periodo_clave)
);

-- ============================================================ PREMIOS FÍSICOS
CREATE TABLE IF NOT EXISTS premios (
    id           INTEGER PRIMARY KEY,
    clave        TEXT NOT NULL UNIQUE,
    nombre       TEXT NOT NULL,
    descripcion  TEXT NOT NULL,
    precio_mars INTEGER NOT NULL CHECK (precio_mars > 0),
    stock        INTEGER NOT NULL CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS canjes (
    id          INTEGER PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
    premio_id   INTEGER NOT NULL REFERENCES premios(id),
    talla       TEXT,
    direccion   TEXT NOT NULL,                   -- solo para el envío
    estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'entregado', 'cancelado')),
    fecha       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================ APORTACIONES DESDE LA DEMO
-- Datos que suben los usuarios sobre un punto (recomendado o nuevo): foto,
-- temperatura, calidad del aire y humedad, junto con el destino y los pesos que
-- tenían configurados. Cada envío es una fila nueva con su fecha: nunca se
-- sobrescribe nada, así queda el historial completo.
CREATE TABLE IF NOT EXISTS aportaciones (
    id            INTEGER PRIMARY KEY,
    usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    zona_id       INTEGER NOT NULL REFERENCES zonas(id),
    lat           REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lon           REAL NOT NULL CHECK (lon BETWEEN -180 AND 180),
    foto          TEXT,
    temperatura_c REAL CHECK (temperatura_c BETWEEN -90 AND 60),
    calidad_aire  INTEGER CHECK (calidad_aire BETWEEN 0 AND 500),   -- índice de calidad del aire (ICA/AQI)
    humedad_rel   REAL CHECK (humedad_rel BETWEEN 0 AND 100),
    destino       TEXT,
    pesos_json    TEXT,
    crea_punto    INTEGER NOT NULL DEFAULT 0,                       -- 1 = esta aportación creó el punto
    moon_ganadas  INTEGER NOT NULL DEFAULT 0,
    fecha         TEXT NOT NULL DEFAULT (datetime('now')),          -- fecha de subida (UTC)
    CHECK (foto IS NOT NULL OR temperatura_c IS NOT NULL OR calidad_aire IS NOT NULL OR humedad_rel IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_aport_usuario_zona ON aportaciones(usuario_id, zona_id, fecha);

CREATE TRIGGER IF NOT EXISTS aportaciones_inmutables BEFORE UPDATE ON aportaciones
BEGIN SELECT RAISE(ABORT, 'Las aportaciones no se modifican: cada envío se guarda como uno nuevo'); END;

-- ============================================================ PROTECCIÓN DE LOS DATOS DE LA NASA
-- Los puntos recomendados (calculados con datos NASA) no se pueden modificar ni
-- borrar desde la app bajo ningún concepto. Para actualizarlos hay que volver a
-- ejecutar el motor y regenerar la base de datos.
CREATE TRIGGER IF NOT EXISTS nasa_no_se_modifica BEFORE UPDATE ON zonas WHEN OLD.recomendada = 1
BEGIN SELECT RAISE(ABORT, 'Los datos de la NASA no se pueden modificar'); END;

CREATE TRIGGER IF NOT EXISTS nasa_no_se_borra BEFORE DELETE ON zonas WHEN OLD.recomendada = 1
BEGIN SELECT RAISE(ABORT, 'Los datos de la NASA no se pueden borrar'); END;
