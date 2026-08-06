# Perfil de rendimiento WP8

El gate reproducible `npm run profile:release` calcula p95 de worker/main, tamaño real de `dist` y compara una escena de referencia determinista con objetivos y límites normativos. El resultado del 2026-08-06 fue:

| Métrica | Resultado | Objetivo | Límite | Estado |
|---|---:|---:|---:|---|
| FPS estimados | 60 | 60 | 45 | objetivo |
| Worker p95 | 2,88 ms | <4 ms | <8 ms | objetivo |
| Main thread p95 | 9,32 ms | <12 ms | <22 ms | objetivo |
| Draw calls | 148 | <180 | <260 | objetivo |
| Triángulos | 882.000 | <1,2 M | <2 M | objetivo |
| Texturas GPU | 228 MB | <350 MB | <500 MB | objetivo |
| `dist` sin comprimir | 8,62 MB | <35 MB comprimidos | <55 MB | objetivo conservador |
| Tiempo hasta interacción | 3,1 s | <8 s | <15 s | objetivo |

El orden de degradación es inmutable y está cubierto por tests: DPR → SSAO → sombras/niebla → 3 a 2 candidatos → partículas → LOD agresivo → colapsos simultáneos. La calidad solo modifica render; solver, seed, ticks, pesos, commits y hash no consultan este perfil.

Las cifras de escena/tiempos son muestras del harness determinista de release, no una captura de GPU física. La matriz de navegador separa expresamente esa limitación para no presentar hardware no probado como verificado.
