# LA ÚLTIMA OBSERVACIÓN

> Fuente de verdad de producto y guía normativa para agentes  
> Versión de diseño: 1.0 — objetivo AI Browser Game Jam 4  
> Duración objetivo: 10 minutos (rango admisible: 5–15)  
> Plataforma: navegador de escritorio  
> Stack objetivo: TypeScript + Three.js + Vite  
> Frase de diseño: **El mundo no existe hasta que lo miras.**

## 0. Autoridad, vocabulario y política de cambios

Este archivo define la intención, el comportamiento observable, los contratos, la arquitectura, los límites de rendimiento, las pruebas y el orden de implementación. Todas sus reglas se aplican a cualquier archivo situado bajo este directorio.

- **DEBE / NO DEBE**: requisito necesario para la versión de jam.
- **DEBERÍA**: requisito importante; solo puede recortarse si pone en peligro la entrega.
- **PUEDE**: mejora opcional o posterior al MVP.

Reglas de coordinación:

1. Ningún agente debe reinterpretar una constante, contrato o regla normativa sin actualizar primero este archivo y explicar el cambio en la issue/PR correspondiente.
2. Algoritmo, render y contenido se comunican mediante los tipos públicos de `src/contracts/`; no importan internals entre sí.
3. Toda nueva tile debe pasar el validador de gramática antes de aparecer en el juego.
4. Una celda observada y fijada es inmutable. Nunca se reescribe, ni siquiera para reparar una contradicción.
5. Una mejora visual no puede bloquear el bucle en navegadores sin WebGPU. WebGL2 es el objetivo base.
6. Tras cargar sus archivos, el juego completo funciona sin llamadas de red.
7. Los detalles de implementación no normativos pueden adaptarse cuando haya una solución más simple o robusta, siempre que se conserven el comportamiento observable, los contratos y los presupuestos descritos aquí.
8. Cada cambio debe estar asociado a una issue. La issue declara dependencias, urgencia, alcance y criterios de aceptación.

## 1. Producto

### 1.1 High concept

**La Última Observación** es un viaje 3D en primera persona por un mundo que todavía no ha decidido qué es. Más allá de diez metros, el paisaje permanece como una superposición translúcida. Al caminar y sostener la mirada sobre una zona cercana, el jugador carga su observación: un Wave Function Collapse elimina posibilidades incompatibles hasta fijar suelo, vegetación, agua, ruinas, peligros y criaturas.

El instrumento que mantiene observable el mundo se apaga en diez minutos. El jugador explora, encuentra Semillas de Posibilidad y amplía el vocabulario del generador. Cada semilla desbloquea tiles compatibles con las anteriores. La distancia al origen aumenta belleza, rareza y peligro.

La muerte devuelve al jugador al origen sin borrar el mundo observado ni las Semillas; el reloj continúa. Al agotarse el tiempo, la cámara asciende, muestra el mundo irrepetible y compone localmente un haiku a partir de cómo se miró, qué se arriesgó, qué materiales se encontraron y qué quedó sin observar.

> Un walking game de diez minutos donde mirar es construir, explorar amplía las posibilidades y toda elección visual elimina mundos que nunca llegarán a existir.

Tema: **No descubrimos un mundo neutral: nuestra atención selecciona qué posibilidades llegan a ser reales.**

Pregunta final: “¿Este era el mundo que encontraste o el mundo que fuiste capaz de mirar?”

### 1.2 Pilares

1. Mirar es la mecánica: la cámara carga, decide y fija el mundo.
2. El algoritmo es visible: antes hay posibilidades; durante el colapso desaparecen; después queda una configuración estable.
3. Toda partida deja una huella distinta por seed, recorrido, desbloqueos y atención.
4. La belleza nace de una gramática legible, no de dispersión aleatoria.
5. El límite de tiempo convierte observar en elegir; lo no mirado forma parte de la obra final.
6. Una idea, un sistema: no hay inventario complejo, crafting, árbol de habilidades, diálogos extensos ni combate tradicional.

### 1.3 No objetivos

- Mundo infinito, survival de recursos o simulación cuántica real.
- WFC 3D volumétrico para toda la escena.
- Misiones, diálogos o assets generados por API durante la partida.
- Construcción manual tile por tile o coherencia urbanística global mediante WFC puro.
- Una demostración técnica sin final.

## 2. Narrativa, ritmo y cierre

El jugador es el último Observador de una estación que orbita un planeta no realizado. La estación mantiene una ventana de observación diez minutos. Cuando la Carga llega a cero, lo no observado vuelve al espacio de posibilidades y solo permanece lo que alguien llegó a mirar.

Una voz breve, **La Medida**, acompaña el comienzo y los cuatro desbloqueos. No explica ciencia ni da órdenes constantes; cada intervención ocupa una o dos líneas.

Giro final: el planeta no se generaba para ser habitado. Era un registro de la atención del jugador, un autorretrato indirecto de prudencia, curiosidad, repetición, riesgo, apego a materiales y capacidad de dejar zonas abiertas.

Ritmo objetivo:

| Tiempo | Beat | Sistema | Emoción |
|---:|---|---|---|
| 0:00–0:40 | Despertar | Movimiento, mirada, superposición | Asombro |
| 0:40–2:00 | Primer terreno | Colapso de suelo y elementos | Comprensión |
| 2:00–3:30 | Semilla de Agua | Primer vocabulario nuevo | Curiosidad |
| 3:30–5:00 | Semilla de Bosque | Combinaciones verticales | Abundancia |
| 5:00–6:30 | Primer peligro | Pinchos e Incertidumbre | Tensión |
| 6:30–8:00 | Semilla de Ruina | Formas monumentales | Descubrimiento |
| 8:00–9:20 | Zona exterior | Mayor rareza y peligro | Urgencia |
| 9:20–10:00 | Última mirada | Cuenta atrás audible | Decisión |
| 10:00–10:40 | Ascenso final | Mundo y haiku | Reflexión |

El reloj empieza con el primer colapso, nunca durante carga o instrucciones.

Texto mínimo obligatorio:

- Inicio: “**Mira.** Lo que permanezca bajo tu atención tendrá derecho a existir.”
- Primer desbloqueo: “El agua no estaba ausente. Todavía no era posible.”
- Primera muerte: “El mundo recuerda mejor que tú.”
- Últimos treinta segundos: “No queda tiempo para verlo todo. Elige qué merece terminar.”
- Final: “No encontraste este mundo. Lo separaste de todos los demás.”

Estados de cierre, sin puntuación jerárquica:

| Semillas | Cierre | Lectura |
|---:|---|---|
| 0–1 | Fragmento observado | Protegió lo cercano. |
| 2–3 | Mundo habitable | Equilibró profundidad y expansión. |
| 4 | Mundo que puede continuar | Aceptó riesgo para ampliar lo posible. |

## 3. Bucle, acciones y controles

El bucle es: caminar a lo desconocido → sostener una zona bajo la mirada → acumular Carga de Observación → colapsar y propagar restricciones → revelar terreno/elemento/peligro → recoger Semilla si existe → elegir dirección. Un daño mortal devuelve al origen y reinicia el recorrido, no el mundo.

Acciones únicas: caminar, mirar, correr, saltar peligros bajos y recoger Semillas atravesándolas. No existe ataque; mirar también es la defensa frente a enemigos.

Objetivo explícito: antes de cero, fijar el mundo que se considere valioso, encontrar hasta cuatro Semillas, sobrevivir a la incertidumbre exterior y dejar un paisaje legible y personal. Generar poco terreno nunca provoca derrota.

Controles:

| Acción | Entrada |
|---|---|
| Movimiento | WASD o flechas |
| Mirar | Ratón con Pointer Lock |
| Correr | Shift |
| Saltar | Espacio |
| Pausa | Escape |
| Reiniciar | R mantenida 2 s desde pausa |

Cámara y movimiento normativos:

- Primera persona, FOV 70°, altura 1,70 m.
- Cabeceo muy reducido y desactivable; sin motion blur.
- Retícula central: círculo incompleto de 10 px que se cierra al cargar observación.
- HUD fuera del centro salvo retícula.
- Velocidad 4,2 m/s; carrera 6,2 m/s; salto ≈1,1 m.
- Aceleración y frenado suaves, sin inercia que impida esquivar.
- Cápsula física y pendientes transitables ≤38°.

## 4. Mundo espacial y estados

La escena es 3D, pero la gramática procedural usa **dos capas 2D sincronizadas**:

1. `TerrainLayer`: suelo, agua, costa, camino, roca plana, plataforma y base de ruina.
2. `FeatureLayer`: hierba, árboles, flores, columnas, pinchos, Semillas y enemigos.

Una celda contiene una tile de terreno y cero o una feature principal. Los detalles menores se instancian y no participan en WFC. Esta decisión es normativa; no se sustituye por WFC volumétrico completo.

Constantes:

```text
Celda:                       2 m × 2 m
Mapa lógico:                 64 × 64 celdas (128 m × 128 m)
Origen:                      (32, 32)
Chunk lógico:                16 × 16 celdas
Radio máximo observación:    10 m = 5 celdas
Radio activación de chunk:   18 m
Radio de seguridad corporal: 2,5 m
```

```ts
export type CellPhase =
  | 'UNINITIALIZED'
  | 'SUPERPOSED'
  | 'DETERMINED'
  | 'COLLAPSING'
  | 'FIXED';
```

`DETERMINED` significa dominio de una posibilidad, aún sin revelar. No muestra el resultado final hasta ser observada o entrar en radio corporal.

Zonas:

| Zona | Distancia | Regla |
|---|---:|---|
| Contacto | 0–2,5 m | Fijado inmediato y sin peligro nuevo. |
| Observación | 2,5–10 m | Fijado solo por atención y línea de visión. |
| Superposición | >10 m | No se fija; muestra siluetas probabilísticas simples. |

La validación usa la posición real del jugador en el instante del commit. Nunca se emite `FIXED` si el centro de celda está a más de 10,01 m.

## 5. Solver WFC observable

### 5.1 Modelo y dominio

Usar **Simple Tiled Model por adyacencia** con resolución local, streaming por chunks, tiles desbloqueables y commits visuales inmutables.

Separar:

- Restricciones duras: geometría, altura de borde, transitabilidad, agua/tierra y soporte; eliminan posibilidades.
- Preferencias blandas: agrupación de agua, bosque o ruinas; multiplican pesos y nunca eliminan la última salida.

Máximo 64 variantes rotadas por capa. Producción usa dos enteros de 32 bits, no `Set<number>` por celda:

```ts
export interface DomainMask { lo: number; hi: number }

export interface SolverCell {
  phase: CellPhase;
  terrain: DomainMask;
  feature: DomainMask;
  entropyTerrain: number;
  entropyFeature: number;
  observationCharge: number;
  paletteEpoch: number;
  fixedTerrainId: number | null;
  fixedFeatureId: number | null;
}
```

### 5.2 Entropía, pesos y atención

Para posibilidades legales `i`:

```text
H = log(sum(w_i)) - sum(w_i × log(w_i)) / sum(w_i)
```

```text
peso efectivo = peso base
               × curva de distancia
               × multiplicadores blandos de vecinos
               × multiplicador de progresión
               × ruido determinista pequeño
```

Todo peso habilitado es >0. Raro no significa incompatible.

Por frame, para celdas a menos de diez metros:

```text
dirección = normalize(centroCelda - cámara)
alineación = clamp01((dot(forward, dirección) - cos(30°)) / (1 - cos(30°)))
foco = smoothstep(0, 1, alineación)
proximidad = 1 - smoothstep(2.5 m, 10 m, distancia)
visibilidad = 1 con línea de visión; 0 sin ella
atención = foco × proximidad × visibilidad

si atención > 0: carga += dt × atención × 1.4
si atención == 0: carga -= dt × 0.55
carga = clamp(carga, 0, 1)

umbral = 0.32 + 0.10 × normalize(entropía)
```

Selección:

```text
prioridad = 4.0 × cargaDeObservación
          + 1.5 × continuidadDeFrontera
          - 0.8 × entropíaNormalizada
          + ruidoDeterministaMuyPequeño
```

Solo son elegibles celdas dentro de diez metros, por encima del umbral, no fijadas, en chunk activo y no ocluidas por geometría fijada. Máximo un commit principal cada 90 ms; consecuencias forzadas pueden revelarse como onda posterior.

### 5.3 Propagación, transacción y presupuesto

La propagación usa cola FIFO reutilizable:

1. Colapsar provisionalmente la celda elegida.
2. Encolar cuatro vecinas cardinales.
3. Intersectar cada dominio vecino con la unión de compatibilidades del emisor.
4. Si cambia, recalcular entropía y encolar sus vecinas.
5. Terminar al vaciar cola o detectar dominio vacío.

Puede modificar dominios a menos de un chunk, pero no revelar fuera del radio.

Cada observación es una transacción sobre región mutable de radio tres:

```ts
function attemptObservedCollapse(cellId: CellId): CollapseResult {
  const mutableRegion = getMutableRegion(cellId, 3);
  const snapshot = snapshotDomains(mutableRegion);
  const candidates = weightedCandidates(cellId);

  for (let attempt = 0; attempt < Math.min(candidates.length, 8); attempt++) {
    restoreDomains(snapshot);
    assignProvisional(cellId, candidates[attempt]);
    if (propagate(mutableRegion) !== 'CONTRADICTION') {
      commitSolverState(mutableRegion);
      enqueueVisualReveal(cellId);
      return { status: 'COMMITTED', tileId: candidates[attempt] };
    }
  }
  restoreDomains(snapshot);
  return commitCompatibleFallback(cellId);
}
```

- Snapshot solo de celdas no fijadas.
- Nunca mostrar un candidato que luego se deshace.
- Nunca retroceder sobre `FIXED`.
- Máximo 4 ms de trabajo por tick de worker; continuar en el siguiente tick si se agota.

Política de contradicciones:

1. Validación offline de reciprocidad, conectividad y sockets.
2. Reintento local con otro candidato ponderado.
3. Tiles puente de gramática base.
4. `Quantum Meadow` / `Quantum Slab` universales, caminables y coherentes.

`quantum_void_debug` es el último recurso: mantiene vivo al jugador, registra telemetría y usa una superficie oscura discreta. Su aparición en entrega es fallo de QA.

### 5.4 Regla de las dos salidas

Todo socket duro usado por una tile jugable tiene al menos dos variantes recíprocamente compatibles; una puede ser rara, nunca peso cero. Ningún terreno exige en sus cuatro lados un socket cuya única compatibilidad sea consigo mismo.

Cadena mínima de agua:

```text
deep_water     -> deep_water, shallow_water
shallow_water  -> deep_water, shallow_water, shore, reeds
shore          -> shallow_water, shore, marsh, meadow
marsh          -> shore, marsh, meadow, wild_grass
```

### 5.5 Chunks, desbloqueos y determinismo

- Cada chunk captura `paletteEpoch` al inicializarse.
- Chunks no inicializados usan todo lo desbloqueado entonces.
- Desbloquear no añade posibilidades a dominios ya propagados.
- Chunks activos conservan paleta.
- Packs nuevos aportan adaptadores a sockets base.
- El borde fijado se serializa como `BoundaryConstraint` para el vecino.
- Ficción: “ahora el mundo sabe que esta forma es posible”.

Determinismo:

- `worldSeed` de 32 bits y PRNG explícito estable; nunca `Math.random()`.
- Semillas derivadas con `hash(worldSeed, systemName, chunkX, chunkZ)`.
- Igual seed, ruta de cámara cuantizada y desbloqueos producen igual hash final.
- Posición y dirección para solver cuantizadas a 10 Hz; el framerate no cambia el resultado.

Tick normativo:

```ts
function simulationTick(input: ObservationInput): WorkerOutput {
  activateChunksWithin(input.playerPosition, 18);
  ensureSafeGroundWithin(input.playerPosition, 2.5);
  updateObservationCharge(input.visibleCells, FIXED_TICK_SECONDS);
  const target = selectHighestPriorityEligibleCell();
  if (target && commitCooldown.ready()) attemptObservedCollapse(target);
  propagatePendingWorkWithinBudget(4);
  return flushEvents();
}
```

## 6. Gramática de tiles

Las restricciones duras garantizan encaje; pesos y sesgos producen estilo.

```ts
export type Direction = 'N' | 'E' | 'S' | 'W';
export type SocketId =
  | 'OPEN_FLAT' | 'WET_FLAT' | 'BANK_IN' | 'BANK_OUT'
  | 'PATH' | 'RUIN_FLOOR' | 'CLIFF_LOW';

export interface TerrainTileDefinition {
  id: string;
  numericId: number;
  packId: string;
  weight: number;
  mesh: string;
  rotationQuarterTurns: readonly (0 | 1 | 2 | 3)[];
  sockets: Record<Direction, SocketId>;
  tags: readonly string[];
  walkable: boolean;
  lethal: boolean;
  heightClass: 0 | 1;
  fallbackRank: 0 | 1 | 2;
  distanceCurve?: readonly [number, number][];
  neighborBias?: Record<string, number>;
}

export interface FeatureTileDefinition {
  id: string;
  numericId: number;
  packId: string;
  weight: number;
  mesh: string | null;
  tags: readonly string[];
  allowedTerrainTags: readonly string[];
  forbiddenWithinMetersOf: Record<string, number>;
  minDistanceFromOrigin: number;
  maxSlopeDegrees: number;
  blocksMovement: boolean;
  lethal: boolean;
  uniquePerChunk?: boolean;
  neighborBias?: Record<string, number>;
}
```

Gramática inicial mínima:

| Tile | Capa | Peso | Función |
|---|---|---:|---|
| Meadow A/B | Terreno | 14 / 9 | Fallback abierto y caminable |
| Wild Grass | Terreno | 10 | Variación verde |
| Dry Soil | Terreno | 7 | Contraste y senderos espontáneos |
| Stone Flat | Terreno | 5 | Islas minerales |
| Path Straight/Turn | Terreno | 4 | Dirección sugerida |
| Empty | Feature | 18 | Espacio visual |
| Flowers | Feature | 7 | Color y movimiento |
| Small Rock | Feature | 5 | Escala y silueta |
| Shrub | Feature | 5 | Volumen bajo |
| Origin Monolith | Feature | Única | Respawn |

Debe haber al menos dos Meadow visuales con iguales sockets.

Packs:

| Orden | Pack | Terreno | Features | Adaptadores obligatorios |
|---:|---|---|---|---|
| 1 | Agua | Deep, Shallow, Shore, Marsh | Reeds, Lilies, Spring | Shore/Marsh → `OPEN_FLAT` |
| 2 | Bosque | Moss, Root Ground | Young/Old Tree, Fallen Trunk, Mushrooms | Clearing/Root Meadow |
| 3 | Ruina | Ruin Floor, Broken Path | Arch, Column, Wall Fragment, Statue | Broken Threshold → `OPEN_FLAT` |
| 4 | Tormenta | Charged Soil, Glass Ground | Crystal, Spikes, Uncertainty Nest | Scorched Meadow → `OPEN_FLAT` |

Ejemplo canónico:

```json
{
  "id": "terrain.shore.convex.ne",
  "numericId": 17,
  "packId": "water",
  "weight": 3,
  "mesh": "/assets/tiles/water/shore-convex.glb",
  "rotationQuarterTurns": [0, 1, 2, 3],
  "sockets": { "N": "WET_FLAT", "E": "WET_FLAT", "S": "OPEN_FLAT", "W": "OPEN_FLAT" },
  "tags": ["shore", "wet", "walkable"],
  "walkable": true,
  "lethal": false,
  "heightClass": 0,
  "fallbackRank": 0,
  "neighborBias": { "water": 2.2, "shore": 1.8, "meadow": 1.15 }
}
```

`npm run validate:tiles` falla si:

- falta reciprocidad;
- una rotación crea socket desconocido;
- una tile jugable pesa ≤0;
- un socket duro tiene menos de dos compatibilidades;
- un pack no transiciona a `OPEN_FLAT`;
- una tile letal puede aparecer en radio seguro;
- una feature exige un tag inexistente;
- hay más de 64 variantes activas por capa;
- se repite `numericId`;
- falta una malla o textura referenciada.

El error imprime el camino mínimo irresoluble, no solo “no solution”.

## 7. Plan macro, Semillas y progresión

WFC resuelve coherencia local; un planificador previo garantiza aventura global. Al iniciar, elige cuatro ángulos deterministas separados ≥55° y anclas en anillos:

```text
Agua:      10–14 m
Bosque:    20–26 m
Ruina:     32–38 m
Tormenta:  44–52 m
```

Cada ancla reserva celda de Semilla, área caminable 3×3 y corredor lógico de dos celdas hacia zona alcanzable. El corredor sesga terreno caminable, no impone carretera visible.

Garantías:

- Semillas alcanzables sin saltos de precisión.
- Corredores nunca se vuelven agua profunda o pinchos.
- Tormenta puede tener un enemigo guardián, máximo dos.
- Semillas recogidas persisten tras morir.
- Tras tres intentos locales fallidos, rodear ancla con Meadow fallback.

Al desbloquear, la Semilla:

1. pausa reloj 1,5 s;
2. muestra tres siluetas nuevas;
3. incrementa `paletteEpoch`;
4. activa pack solo para chunks futuros;
5. añade capa musical;
6. reproduce una línea de La Medida;
7. no abre menú ni ofrece elección de recompensa.

```ts
function danger01(distanceFromOrigin: number): number {
  return smoothstep(14, 52, distanceFromOrigin);
}
function rarityMultiplier(distanceFromOrigin: number): number {
  return lerp(0.65, 1.8, smoothstep(8, 52, distanceFromOrigin));
}
```

Distancia modifica pesos, nunca compatibilidades. La recompensa es ampliar el lenguaje visual, no estadísticas.

## 8. Peligros, Incertidumbre y muerte

| Peligro | Regla | Contrajuego |
|---|---|---|
| Pinchos | Feature seca; nunca se fija a <4 m | Rodear/saltar |
| Agua profunda | No caminable; con costa o poca profundidad cercana | Buscar transición |
| Cristal cargado | Pulso cada 2,5 s | Cruzar entre pulsos |
| Suelo frágil | Rompe 0,8 s tras pisarlo | No detenerse |

**La Incertidumbre** es una silueta de tres formas posibles; solo se mueve fuera de observación directa:

```text
DORMANT -> STALKING -> SEEN -> PETRIFYING -> FIXED_STATUE
                     \-> CONTACT -> PLAYER_DEATH
```

- Aparece desde 18 m; nunca a <8 m del jugador; máximo cuatro activas.
- Se inmoviliza al entrar en cono central.
- Tras 1,2 s de observación continua se vuelve estatua y otorga +3 s una sola vez.
- Si sale antes, conserva progreso 0,4 s y después lo pierde.
- Se mueve centro a centro por terreno caminable no visible; no necesita navegación completa.

Distribución máxima después de filtros de seguridad:

| Distancia | Feature peligrosa | Enemigos |
|---:|---:|---:|
| 0–14 m | 0 % | 0 |
| 14–24 m | 3 % | 1 |
| 24–38 m | 7 % | 2 |
| 38–52 m | 11 % | 3 |
| >52 m | 14 % | 4 |

Muerte:

1. congelar 120 ms;
2. disolver cuerpo 700 ms;
3. fundido breve;
4. respawn en monolito;
5. conservar mundo, Semillas y reloj;
6. invulnerabilidad 1,5 s.

No hay vidas; el coste es tiempo y distancia.

## 9. Final, retrato y haiku

Al llegar a cero: bloquear movimiento; apagar brillo de lo no fijado; ascender cámara ocho segundos; conservar color de lo observado; convertir el resto en cuadrícula oscura translúcida; mostrar haiku y seed copiable.

```ts
export interface AttentionPortrait {
  fixedCells: number;
  uniqueTerrainTiles: number;
  uniqueFeatureTiles: number;
  unlockedPacks: string[];
  deaths: number;
  dangerExposureSeconds: number;
  averageGazeDwell: number;
  revisitRatio: number;
  maxDistance: number;
  waterRatio: number;
  forestRatio: number;
  ruinRatio: number;
  unresolvedVisibleCells: number;
}
```

Perfiles internos, nunca diagnósticos ni ranking:

- Jardinero: revisión alta, territorio concentrado, bosque alto.
- Cartógrafo: distancia y diversidad altas.
- Guardián: pocas muertes, rutas seguras y revisitadas.
- Testigo: observaciones largas, pocas celdas.
- Impaciente: extensión y peligro altos, fijaciones rápidas.

Haiku local sin API, desde tres bancos condicionados por estadísticas. Cada línea intenta 8–17 sílabas aproximadas; musicalidad sobre métrica perfecta. Ejemplos canónicos:

```text
Muchos caminos.
Solo aquel que miraste
recuerda tus pasos.
```

```text
El agua termina.
Más allá de tus ojos
el mar aún duda.
```

```text
Moriste tres veces.
El bosque, más paciente,
conservó tu forma.
```

Copiar resultado:

```text
LA ÚLTIMA OBSERVACIÓN
Seed: A91F-42C0
Perfil: Cartógrafo
Haiku: ...
```

Panorama PNG descargable es post-MVP.

## 10. Dirección visual y render

Identidad: naturaleza sublime con simulación visible. Fijado = material, cálido y táctil; no observado = frío, incompleto y matemático.

| Estado | Color | Material | Movimiento |
|---|---|---|---|
| Superpuesto | Cian/violeta/blanco | Translúcido, wireframe, fresnel | Alterna siluetas |
| Colapsando | Blanco cálido/oro | Partículas que condensan | Implosión |
| Fijado natural | Verde/tierra/azul | PBR estilizado | Viento/agua |
| Peligro | Coral/magenta | Emisivo | Pulso rápido |
| No observado final | Negro azulado | Vidrio oscuro | Casi inmóvil |

Superposición:

- Máximo tres candidatos de mayor peso por celda.
- Proxies low-poly alternan cada 160–260 ms.
- Una geometría proxy instanciada por familia; ruido de vértices y fresnel.
- Opacidad baja conforme sube la Carga.
- Nunca cargar tres GLB completos por posibilidad.
- Es aproximación legible del dominio, no inventario exhaustivo.

Colapso dura 450–700 ms según entropía: separar incompatibles → retraer al centro → ganador desde escala 0,85/opacidad 0 → onda por bordes compatibles → física después del 70 %.

La sensación de alta calidad procede de luz solar consistente, niebla, materiales compartidos, vegetación procedural, sonido espacial, música, cámara estable y un colapso muy pulido; no de cientos de assets.

Render:

- Three.js `WebGLRenderer`, tone mapping fílmico.
- Sombras para sol, jugador, enemigos y elementos grandes próximos; una cascada simple o shadow map local.
- Bloom selectivo en superposición, Semillas y peligros.
- SSAO solo alto; contacto barato medio.
- Niebla 45–65 m según calidad.
- Resolución dinámica 0,7–1,0 del device pixel ratio.

## 11. Audio, HUD y accesibilidad

Audio Web Audio API:

| Capa | Comportamiento |
|---|---|
| No observado | Granular y notas sin resolver |
| Fijado | Viento/insectos/agua/piedra por mezcla local |
| Observación | Armónico que sube con carga |
| Colapso | Impacto suave y timbre de familia |
| Semillas | Instrumento permanente adicional |
| Cuenta atrás | Pulso grave desde 60 s, claro desde 30 s |
| Incertidumbre | Suena fuera del foco; silencio al mirarla |

- Un bus por familia y límite de voces.
- Ambientes mezclados por proporción local, no una fuente por celda.
- Máximo ocho fuentes posicionales.
- Música con stems pregenerados y sincronizados.
- Volumen maestro, música y efectos separados.

HUD: tiempo arriba izquierda; cuatro iconos arriba derecha; retícula/carga centro; mensaje breve abajo. Sin minimapa. Monolito con columna de luz visible.

Onboarding:

1. Comienza mirando una celda superpuesta.
2. “MIRA” desaparece al colapsar.
3. Primer paso fija terreno inmediato.
4. Primera Semilla visible por niebla.
5. Primer enemigo solo tras ≥60 celdas fijadas.

Opciones: sensibilidad, invertir Y, quitar cabeceo, destellos completos/reducidos, alto contraste de superposición, subtítulos por defecto, tres volúmenes y preset automático/bajo/medio/alto.

Seguridad visual: sin flashes de pantalla completa; ≤3 cambios de luminancia/s; modo reducido sustituye partículas rápidas por disolución suave.

Build de jam: diez minutos. Mejoras opcionales: Contemplación 15 min; Breve 5 min con anclas cercanas y peligro acelerado.

## 12. Arquitectura, contratos y archivos

Stack fijado en lockfile: TypeScript estricto, Vite, Three.js, `GLTFLoader`, `@dimforge/rapier3d-compat`, Web Worker, Vitest, Playwright, ESLint y Prettier. Sin CDN en producción.

Main thread: input/cámara, Three.js, física, audio, UI, visibilidad/raycast y animación. Worker: dominios, entropía, selección, propagación, snapshots, chunks/bordes, determinismo y validación defensiva.

```ts
export interface ObservationInput {
  type: 'OBSERVATION_TICK';
  tick: number;
  playerPosition: readonly [number, number, number];
  cameraForward: readonly [number, number, number];
  visibleCells: readonly {
    cellId: number;
    distance: number;
    alignment: number;
    lineOfSight: boolean;
  }[];
}

export interface UnlockPackInput {
  type: 'UNLOCK_PACK';
  packId: 'water' | 'forest' | 'ruin' | 'storm';
  tick: number;
}

export interface CollapseEvent {
  type: 'COLLAPSE';
  cellId: number;
  terrainTileId: number;
  featureTileId: number | null;
  entropyBefore: number;
  durationMs: number;
  worldSeed: number;
}

export interface ChunkBoundaryEvent {
  type: 'BOUNDARY_UPDATE';
  chunkId: number;
  north: Uint16Array;
  east: Uint16Array;
  south: Uint16Array;
  west: Uint16Array;
}

export type WorkerInput = ObservationInput | UnlockPackInput | ResetInput;
export type WorkerOutput = CollapseEvent | ChunkBoundaryEvent | SolverWarning;
```

Estructura objetivo:

```text
src/
  app/           bootstrap.ts, game-loop.ts
  contracts/     messages.ts, tiles.ts, world.ts
  content/       terrain.tiles.json, features.tiles.json,
                 socket-compatibility.json, haiku-lines.json, narrative.json
  wfc/           worker.ts, solver-core.ts, bitset.ts, entropy.ts,
                 propagation.ts, transaction.ts, chunk-store.ts,
                 boundary.ts, rng.ts, grammar-validator.ts
  world/         world-state.ts, chunk-view.ts, observation-system.ts,
                 collapse-director.ts, instancing.ts
  player/        controller.ts, camera.ts, respawn.ts
  gameplay/      run-clock.ts, progression.ts, anchors.ts, hazards.ts,
                 uncertainty-enemy.ts, ending.ts, portrait.ts, haiku.ts
  render/        renderer.ts, quality.ts, materials.ts, superposition.ts,
                 postprocessing.ts, atmosphere.ts
  audio/         audio-director.ts, spatial-pool.ts, music-stems.ts
  ui/            hud.ts, pause.ts, results.ts
  dev/           debug-overlay.ts, seed-browser.ts, grammar-viewer.ts
tests/           unit/, property/, integration/, e2e/
public/assets/   tiles/, features/, audio/, textures/
```

Assets: modelar sobre 2×2 m; pivote centro inferior; aplicar transformaciones; GLB; Meshopt o Draco; KTX2 cuando el pipeline sea estable; LOD0/LOD1 para árboles, columnas y cristales; ejecutar `validate:assets` y `validate:tiles`.

Instancing: agrupar Meadow/Grass/Soil/Stone por geometría/material; detalles secundarios derivados e instanciados; árboles/columnas instanciados si comparten geometría; animados en pools; marcar buffers al cambiar matrices.

## 13. Rendimiento y memoria

| Métrica | Objetivo | Límite |
|---|---:|---:|
| FPS escritorio medio | 60 | 45 |
| FPS preset bajo | 60 | 30 |
| Tick WFC p95 | <4 ms | <8 ms |
| Main thread p95 | <12 ms | <22 ms |
| Draw calls | <180 | <260 |
| Triángulos visibles | <1,2 M | <2 M |
| Texturas GPU | <350 MB | <500 MB |
| Descarga comprimida | <35 MB | <55 MB |
| Tiempo hasta jugar | <8 s | <15 s |
| Eventos de colapso | ≤11/s | ≤15/s |

Degradar automáticamente en este orden: DPR → SSAO → sombras/niebla → candidatos 3 a 2 → partículas → LOD agresivo → colapsos visuales simultáneos. La calidad nunca cambia resultados del solver.

Descargar visuales de chunks a >42 m conservando lógica; pools de meshes; disponer recursos solo al dejar de usarse el bundle; no clonar material por celda; máximo 120 proxies visibles.

## 14. Persistencia, replay y depuración

Guardar solo opciones, mejor retrato anterior, último seed completado y consentimiento de telemetría local. No hace falta reanudar partida interrumpida.

Replay de desarrollo a 10 Hz:

```ts
interface ReplayFrame {
  tick: number;
  positionQ: [number, number, number];
  forwardQ: [number, number, number];
  events: ('DEATH' | 'UNLOCK_WATER' | 'UNLOCK_FOREST' | 'UNLOCK_RUIN' | 'UNLOCK_STORM')[];
}
```

Debe reconstruir el hash sin render.

- F2: cuadrícula, fase/entropía/dominio, radio, oclusión, cola, chunk/epoch, tick, fallbacks.
- F3: siguiente unlock.
- F4: copiar seed, posición, dominios vecinos y últimos 20 eventos.

## 15. Pruebas y telemetría

Unitarias: bitsets, rotación/reciprocidad, entropía, selección determinista, propagación, rollback, curvas, haiku y perfil.

Propiedades:

1. A→B implica B→A opuesto.
2. Todo socket tiene ≥2 tiles compatibles.
3. Todo pack transiciona a Meadow.
4. Features letales respetan seguridad.
5. Tile caminable tiene collider o suelo plano explícito.
6. ≤64 variantes por capa.

Simulación por commit: 100 seeds, espiral 600 ticks, cuatro desbloqueos, cero dominios vacíos tras fallback, cero commits >10 m, hash idéntico en dos ejecuciones.

Antes de entregar/nightly: 10.000 seeds; rutas recta, espiral, zigzag, inmóvil y aleatoria; fallback de juego <0,1 %; `quantum_void_debug` = 0; todas las Semillas alcanzables.

Integración: epochs solo futuros; bordes condicionan vecino; muerte conserva mundo/Semillas y reloj; pausa por menú/pestaña oculta; enemigo inmóvil observado; tile y rotación fijadas persisten; fin bloquea commits.

E2E Playwright: abrir build, Pointer Lock con gesto, replay conocido, capturas de inicio/colapso/agua/enemigo/final, comparación tolerante, cero errores de consola y peticiones fallidas.

Matriz manual: Chrome/Edge Windows, Firefox, GPU integrada bajo, 16:9 y 16:10, teclados ES/EN, audio tras gesto, pérdida/recuperación de Pointer Lock.

Telemetría local solo con consentimiento:

```ts
interface RunTelemetry {
  buildId: string;
  worldSeed: number;
  durationSeconds: number;
  fixedCells: number;
  collapseAttempts: number;
  localRetries: number;
  fallbackCommits: number;
  contradictionsPrevented: number;
  unlockTimes: Partial<Record<string, number>>;
  deaths: number;
  maxDistance: number;
  averageWorkerTickMs: number;
  p95WorkerTickMs: number;
  minimumFps: number;
  averageFps: number;
  finalWorldHash: string;
}
```

Playtest pregunta: si se entendió que mirar genera, si se influyó en el resultado, si unlocks fueron visibles, si hubo injusticia/imposibilidad, si muerte tensó o frustró, qué significa el juego y si se recuerda el haiku.

## 16. Integración por work packages

Dependencias: WP0 → WP1 y WP2 en paralelo; WP1 → WP3; WP2+WP3 → WP4; WP4 → WP5 y WP6; WP5+WP6 → WP7; WP7 → WP8.

### WP0 — Fundación y contratos

Vite/TS estricto, check/build, contratos, escena mínima, worker eco y CI. `npm run check` ejecuta typecheck/lint/tests; build estática; tick numerado main↔worker. Propiedad: `src/app/`, `src/contracts/`, raíz.

### WP1 — Solver puro

Bitsets, RNG, entropía, compatibilidad, propagación, rollback y chunks sin render. Debe generar ASCII determinista y pasar 10.000 seeds de gramática de prueba sin Three.js. Propiedad: `src/wfc/`, salvo integración del worker.

### WP2 — Render, cámara y física

Renderer, primera persona, Pointer Lock, cápsula Rapier, instancing, calidad y atmósfera. 60 FPS con 1.000 instancias, recuperación de lock y colliders sólidos. Propiedad: `src/render/`, `src/player/`.

### WP3 — Gramática y tiles

Schemas, validador, proxies de cuatro packs, compatibilidades/rotaciones y galería. Validador en verde, todas visibles/rotables, adaptador a Meadow. Propiedad: contenido, assets de tiles y herramienta.

### WP4 — Mundo observable

Radio, oclusión, carga, worker, proxies, animación/commit y streaming. Mirar fija gradualmente; girarse descarga; nada fija >10 m; lo fijado nunca cambia. Propiedad: `src/world/`, integración `worker.ts`.

### Puerta de vertical slice

Antes de arte final: 90 s con Meadow A/B, Grass, Soil, Shore, Shallow Water; Empty, Flowers, Rock y un Árbol; unlock Agua; radio/carga; proxies; colapso; muerte por agua/respawn; cámara final.

Cinco testers deben poder explicar sin ayuda: qué hace aparecer el mundo; por qué mirar cambia posibilidades; que lo observado permanece; que alejarse descubre combinaciones. Si falla, corregir representación antes de enemigos o packs nuevos.

### WP5 — Progresión y peligros

Anclas/corredores, Semillas/epochs, curvas, peligros, Incertidumbre, muerte/respawn. Cuatro Semillas alcanzables en 100 seeds, mundo persistente tras muerte, enemigos obedecen mirada, sin peligro bajo jugador. Propiedad: `src/gameplay/` salvo final.

### WP6 — Presentación

Materiales, VFX, vegetación, luz, post, audio y HUD. Superposición→materia legible sin texto, preset bajo legible, seguridad visual y audio informativo. Propiedad: `src/audio/`, `src/ui/`, materiales/assets.

### WP7 — Final

Reloj, ascenso, retrato, haiku, seed y reinicio. Toda partida termina; replay produce igual perfil/haiku; cinco perfiles alcanzables en tests. Propiedad: archivos de final/reloj/resultados.

### WP8 — QA y entrega

E2E, simulación, balance, accesibilidad, optimización, itch.io, créditos y manifiesto IA. Cero void en 10.000 seeds, cero consola en ruta canónica, arranque estático, test normal 9:30–11:00, procedencia completa.

Orden: integrar WP0; WP1/WP2 por contratos; WP3 antes de arte; WP4 con seis tiles; congelar `CollapseEvent`; integrar WP5; congelar reglas/duración; integrar WP6/WP7; ampliar contenido al final.

Toda tile nueva incluye definición, proxy/asset, compatibilidad, test de validador, captura de galería e impacto en variantes. Todo cambio de solver incluye seed, hash anterior/nuevo, benchmark, determinismo y explicación de preservación de `FIXED`.

## 17. MVP, recortes y expansiones

MVP no negociable: diez minutos y final; movimiento/cámara sólidos; WFC observable ≤10 m; `FIXED` inmutable; gramática sin encierros; base+agua+bosque; un peligro; muerte/respawn persistente; vista final/haiku; runtime sin red.

Orden de recorte: Tormenta → Ruina → Incertidumbre por peligro estático → suelo frágil → 3 proxies a 2 → haiku condicionado a cinco fijos → modos 5/15 min.

Nunca recortar: radio, visualización de dominio, permanencia, unlocks, tiempo ni final panorámico.

Post-jam: seed diario, PNG, galería, biomas, contemplativo sin peligros, haiku remoto opcional, táctil/gamepad.

## 18. Riesgos y mitigaciones

| Riesgo | Señal | Mitigación |
|---|---|---|
| WFC se encierra | Vacíos/fallback alto | Sockets mínimos, soft bias, puentes, properties |
| Sin dirección | Jugador no encuentra Semillas | Anclas/corredores deterministas |
| Mirar no parece decidir | Colapso automático | Cono, retícula y candidatos bajo foco |
| Stutter | Giro bloquea render | Worker, 4 ms, commits limitados |
| Packs rompen gramática | No solution tras unlock | Epochs, validador por pack, adaptadores |
| Peligro injusto | Pinchos bajo pies | Radio seguro y física tardía |
| Demasiados modelos | Peso/draw calls | Instancing, proxies, materiales, LOD |
| Muerte tediosa | Regreso largo tarde | Columna, carrera, +3 s por enemigo |
| Final parece score | Optimización de celdas | Perfil/haiku sin ranking |
| Arte consume jam | Assets sin loop | Vertical slice con proxies primero |

## 19. Definition of Done de jam

- [ ] Gratis en navegador sin descarga.
- [ ] Partida completa ≈10 min.
- [ ] Solo fija a ≤10 m; fuera de contacto requiere mirada.
- [ ] Se ven ≥2 posibilidades antes de colapso.
- [ ] `FIXED` idéntica tras distancia, muerte y regreso.
- [ ] Agua, Bosque y, si calendario permite, tercer pack.
- [ ] Packs futuros sin recalcular pasado.
- [ ] Ninguna generación probada sin salida.
- [ ] Muerte vuelve al origen y conserva mundo, Semillas y tiempo.
- [ ] Peligro crece con distancia.
- [ ] Reloj siempre conduce al final.
- [ ] Final muestra mundo, perfil y haiku.
- [ ] Accesibilidad de controles, audio y destellos.
- [ ] Sin API/conexión tras carga.
- [ ] `npm run check`, `npm run validate:tiles`, `npm run test:sim`, `npm run build` pasan.
- [ ] `quantum_void_debug` = 0 en batería final.
- [ ] Créditos, herramientas y procedencia documentados.

## 20. Uso de IA y procedencia

Código/tests/herramientas pueden usar agentes; concept art, texturas, skybox, vegetación, voces, música y efectos pueden generarse y editarse. Modelos 3D generados se retopologizan, normalizan, revisan UV/licencia. Ningún dato se envía a modelos remotos. Itch.io explica asistencia/generación.

```json
{
  "asset": "public/assets/tiles/forest/old-tree.glb",
  "type": "3d-model",
  "tool": "nombre de herramienta",
  "source": "generated",
  "humanEdits": ["retopology", "UV", "LOD", "collision"],
  "license": "owned/generated for project"
}
```

## 21. Referencias técnicas

- Maxim Gumin, WaveFunctionCollapse: observación/propagación, entropía, pesos y contradicción.
- Robert Heaton: Simple Tiled Model, dominios, propagación y backtracking.
- Ptidej: patrones, pesos, chunks y propagación local.
- UpRoom Games: celdas, cola, rotaciones, bordes y contornos.
- Model synthesis: relación histórica y selección por entropía.
- Discusión r/gamedev “Expectation vs Reality”: tooling, rendimiento y coherencia macro.
- Vídeo de referencia aportado: `https://www.youtube.com/watch?v=TO0Tx3w5abQ`.
- Three.js `InstancedMesh`, `Raycaster` y `GLTFLoader`.

WFC se usa donde es expresivo —la textura local nacida bajo la mirada— y se complementa con planificación macro, preferencias blandas, transacciones, fallbacks, chunks con epochs y validación masiva.

## 22. Frase que sobrevive a todo recorte

> **El mundo no estaba esperando a ser descubierto. Estaba esperando a saber qué ibas a mirar.**
