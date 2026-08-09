# Gate de comprensión narrativa QBista

Estado: **NO-GO humano — 0/5 sesiones registradas**.

La automatización verifica implementación, accesibilidad técnica y recorrido offline, pero no puede responder por comprensión humana. El epic #75 y la issue #83 deben permanecer abiertos hasta registrar al menos cinco sesiones reales y alcanzar los umbrales acordados.

## Protocolo sin inducción

Para cada sesión, registrar un identificador anónimo, navegador, resolución, duración aproximada, incidencias y respuestas literales a:

1. ¿Qué cree que hace un Colapsador?
2. ¿Puede elegir el resultado o solo la intervención?
3. ¿Qué representan los porcentajes?
4. ¿La historia afirma como hecho que la conciencia causa un colapso físico?
5. ¿Qué entendió del giro final?
6. ¿El humor burocrático mejora o rompe el tono?

No explicar QBism antes de responder. No registrar nombre, correo, voz, vídeo ni identificadores del dispositivo.

## Umbrales

- 4/5 distinguen intervención de resultado.
- 4/5 interpretan porcentajes como expectativas/probabilidades.
- 5/5 pueden leer los textos obligatorios con subtítulos.
- 5/5 terminan sin bloqueo por narración, audio o calibración.
- Si alguien interpreta la causalidad de la conciencia como hecho demostrado por el juego, revisar copy antes de GO.

## Registro

| Sesión | Navegador/resolución | Intervención ≠ resultado | Porcentajes = expectativas | No afirma causalidad | Giro entendido | Humor | Bloqueos |
|---|---|---:|---:|---:|---:|---:|---|
| Pendiente 1 | — | — | — | — | — | — | — |
| Pendiente 2 | — | — | — | — | — | — | — |
| Pendiente 3 | — | — | — | — | — | — | — |
| Pendiente 4 | — | — | — | — | — | — | — |
| Pendiente 5 | — | — | — | — | — | — | — |

## Evidencia automatizada

- Catálogo, unicidad, prioridad, fallback y orden: Vitest.
- Introducción, omisión y reintento: Playwright Chromium/Firefox y revisión visual real.
- Cuatro Semillas, muerte, Incertidumbre y final: replay E2E determinista.
- Voces: 20 MP3 locales verificados por firma y FFprobe; subtítulos permanecen si se desactivan.
- Red: el E2E falla ante cualquier origen distinto de `127.0.0.1:4173`; abortos locales benignos de rangos de audio no se presentan como fallo externo.
- Consola: cero errores en el recorrido canónico.

Las capturas y el vídeo reproducible se publican en `docs/progress/qbism-narrative/`.
