# WP4 — Mundo observable y vertical slice

Evidencia producida el 2026-08-05 sobre el build de producción local de la rama
`codex/wp4-observable-world-vertical-slice`, a 1280×720 y con la seed canónica
`A91F-42C0`.

## Recorrido verificado

- `01-calibration.webp`: estado previo, con posibilidades low-poly y CTA de
  calibración.
- `02-collapse.webp`: primera fijación corporal y alternativas superpuestas.
- `04-water-unlock.webp`: unlock futuro de Agua y línea canónica de La Medida.
- `05-death.webp`: muerte canónica; el mundo ya fijado sigue visible.
- `06-respawn-persistence.webp`: retorno al origen conservando terreno y
  features.
- `07-ending-ascent.webp`: cámara ascendente; la superposición desaparece y lo
  observado conserva color.
- `05-final.webp`: cierre, haiku local y seed copiable.
- `wp4-vertical-slice.webm`: montaje VP9 de 18 s con los hitos anteriores. Es
  una secuencia de capturas reales del replay, no una sesión humana de #29.

## Reproducción

```powershell
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 4173
```

Abrir `http://127.0.0.1:4173/?replay=canonical`. El slice normal mantiene la
duración de 90 s. Para capturar un punto concreto sin alterar el comportamiento
de producción se admite, solo junto a `evidence=1`, un offset `start` entre 0 y
89 y un multiplicador `speed`; por ejemplo:

```text
/?replay=canonical&evidence=1&start=28&speed=1
```

La inspección no registró errores ni warnings de aplicación. `ffprobe` verificó
el WebM a 1280×720, 18 s y 307145 bytes.

![Calibración](./01-calibration.webp)

![Agua disponible para el mundo futuro](./04-water-unlock.webp)

![Persistencia después del respawn](./06-respawn-persistence.webp)

![Ascenso final](./07-ending-ascent.webp)

[Ver vídeo del vertical slice (WebM, 18 s)](./wp4-vertical-slice.webm)
