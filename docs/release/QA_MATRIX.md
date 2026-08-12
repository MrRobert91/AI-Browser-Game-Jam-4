# Matriz QA de navegadores

Tolerancia visual automatizada: `maxDiffPixelRatio = 0.035`, suficiente para pequeñas diferencias de raster WebGL sin aceptar cambios estructurales. Resoluciones objetivo: 1440×900 (16:10), 1280×720 (16:9) y 1920×1080 para navegador estable.

| Navegador | Resolución | Pointer Lock/pausa | audio tras gesto | recorrido/final | consola/red | Resultado 2026-08-06 |
|---|---:|---|---|---|---|---|
| Chromium Playwright | 1440×900 | automatizado | automatizado | automatizado | automatizado | **Pasa** |
| Firefox Playwright | 1280×720 | automatizado | automatizado | automatizado + comparación visual | automatizado | **Pasa** |
| Chrome estable 150 | 1920×1080 | automatizado | automatizado | automatizado | automatizado | **Pasa** tras corregir favicon local |
| Edge estable | 1920×1080 | — | — | — | — | **No disponible:** no hay ejecutable instalado |
| Chrome con GPU integrada física | 1920×1080 | — | — | — | — | **Pendiente externo:** el runner headless no acredita hardware/driver |

`npm run test:e2e` ejecuta Chromium y Firefox. `npm run test:e2e:desktop` usa el canal Chrome estable instalado. Las capturas, comparación Firefox y vídeo del recorrido están adjuntos en [`docs/progress/wp7-wp8-release/`](../progress/wp7-wp8-release/). Un navegador o hardware no disponible nunca se marca como aprobado.

## 2026-08-13 — final «Misión completada»

| Navegador | EN completo | ES completo | fallo de vídeo + voz | Resultado |
|---|---:|---:|---:|---|
| Chromium Playwright 1440×900 | 54,0 s | 54,2 s | pasa | **Pasa** |
| Firefox Playwright 1280×720 | 54,7 s | 53,8 s | pasa | **Pasa** |

Los seis recorridos reproducen la ascensión y los cuatro capítulos sin omitir,
verifican audio en progreso, captions, 1536 celdas, resultado único y fallback.
La grabación reproducible de Chromium vive en
[`docs/progress/issue-112-mission-complete/`](../progress/issue-112-mission-complete/).
