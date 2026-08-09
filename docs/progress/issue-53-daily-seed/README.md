# Issue #53 — Observación diaria offline

`?daily=1` deriva una seed de la fecha de calendario **UTC** con el PRNG/hash estable del proyecto. Dos jugadores en la misma fecha UTC obtienen el mismo entero de 32 bits sin consultar reloj remoto, API ni backend.

La portada enlaza al modo diario y, desde él, permite volver a una observación estándar con seed aleatoria criptográfica. La precedencia es: seed explícita, diaria, replay canónico y aleatoria. El resultado y su texto copiable etiquetan fecha UTC y seed cuando procede.

## Verificación

- Vitest congela derivación por fecha, frontera de medianoche UTC, seed explícita, replay y fuente aleatoria inyectable.
- Playwright recarga el modo diario y obtiene la misma seed/fecha; después confirma que `replay=wp5` conserva `A91F-42C0`.
- El modo no persiste identidad ni requiere red.
