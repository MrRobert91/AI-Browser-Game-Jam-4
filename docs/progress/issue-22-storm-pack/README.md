# Issue #22 — Pack Tormenta autorizado

El stretch pack se incorpora después de la candidata `v0.1.0-rc.1` y conserva el contrato offline. Añade Charged Soil, Glass Ground, Scorched Meadow, Crystal, Spikes y Uncertainty Nest mediante seis proxies locales con LOD.

Scorched Meadow expone `OPEN_FLAT` en los cuatro lados. Los peligros solo son elegibles desde 38 m, respetan corredor/ancla y el pulso emisivo de Cristal dura 2,5 s; el modo de destellos reducidos lo vuelve constante.

## Gate ejecutado

- `npm run validate:tiles`: 7/7.
- `npm run validate:assets`: 2/2.
- `tests/unit/storm-pack.test.ts`: 2/2.
- `npm run test:sim:release`: 10.000 seeds, cinco rutas, 100 replays completos de 600 ticks; 0 dominios vacíos, 0 commits fuera de radio, 0 divergencias, fallback 0 %, `quantum_void_debug` 0 y 0 anclas inaccesibles.

La visualización completa se vuelve a capturar al cerrar la PR acumulativa, después de integrar también las expansiones posteriores.
