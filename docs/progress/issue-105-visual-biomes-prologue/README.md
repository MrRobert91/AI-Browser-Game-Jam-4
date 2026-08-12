# Issue #105 — evidencia reproducible de biomas, detonación y prólogo

Entrega creada desde `origin/dev` `1f318b1` en `codex/issue-105-visual-biomes-prologue`.

## Evidencia visual

- `01-alice-on-screen.png`: Alice Boole aparece como textura de la pantalla 3D, con el mismo tratamiento de scanlines del briefing y sin retrato HTML superpuesto.
- `02-white-sphere-portal.png`: esfera blanca emisiva delante de la pantalla; la pared continúa cerrada y el texto indica que debe atravesarse la esfera.
- `03-visual-biomes.png` / `.webp`: cinco siluetas deterministas de árboles, ruinas y rocas; el suelo muestra bosque, ruina y agua profunda/somera.
- `04-bomb-detonating.png`: fase pública `DETONATING`, capturada durante los 0,7 s de ondas hemisféricas y anillos sin fuego.
- `prologue-portal-run.webm`: recorrido real desde el prólogo hasta la entrada por la esfera y el primer mundo fijado.
- `bomb-detonation-and-terminal.webm`: tres detonaciones completas, fractura y cierre por vidas.

Las imágenes y los vídeos proceden de Playwright sobre `dist`; no son mockups. Los WebM son VP8, 800×450, 25 FPS: 25,20 s para el prólogo y 32,16 s para el recorrido de bombas.

## Reproducción

```powershell
npm.cmd run build
$env:PLAYWRIGHT_EVIDENCE='1'
npm.cmd run test:e2e -- --project=chromium-16x10 --grep "canonical offline English|three consciousness bombs|evidence showcase"
```

El catálogo visual solo se activa con `?evidence=1&showcase=variants`; no modifica la partida normal. Los replays de bombas siguen siendo opt-in mediante `?wp5=preview&replay=wfc2-lives&evidence=1`.

## Cobertura automatizada

- Cinco índices visuales estables para cada definición de árbol, roca y ruina.
- Propagación de `distanceCurve` y `neighborBias`, afinidad cardinal y cierre suave de componentes de agua.
- Batching instanciado por geometría compuesta, límites de batches y colliders ampliados.
- Fase `DETONATING` de 0,7 s, una vida/fractura por contacto y voz terminal exclusiva.
- Alice en pantalla, ausencia del control de repetición, botón físico desactivado y entrada por volumen esférico.
- Recorridos EN/ES, assets locales, consola limpia y ejecución Chromium/Firefox.

