import {
  CARDINAL_DIRECTIONS,
  type Direction,
  type FeatureTileDefinition,
  type ProxyAssetDescriptor,
  type TerrainTileDefinition,
} from '../contracts/tiles';

const TERRAIN_URL = new URL('../content/terrain.tiles.json', import.meta.url);
const FEATURE_URL = new URL('../content/features.tiles.json', import.meta.url);

type GalleryItem =
  | { readonly layer: 'terrain'; readonly definition: TerrainTileDefinition }
  | { readonly layer: 'feature'; readonly definition: FeatureTileDefinition };

export function isGrammarViewerMode(location = window.location): boolean {
  return new URLSearchParams(location.search).get('grammar') === '1';
}

export function renderGrammarViewer(root: HTMLElement): () => void {
  const abortController = new AbortController();
  root.innerHTML = `
    <main class="grammar-viewer" aria-labelledby="grammar-title">
      <header class="grammar-viewer__header">
        <div><p>HERRAMIENTA DE DESARROLLO // WP3</p><h1 id="grammar-title">Galería de gramática</h1></div>
        <a href="./">Volver al instrumento</a>
      </header>
      <section class="grammar-toolbar" aria-label="Filtros de galería">
        <label>Pack <select data-pack-filter><option value="all">Todos</option></select></label>
        <label>Capa <select data-layer-filter><option value="all">Ambas</option><option value="terrain">Terreno</option><option value="feature">Features</option></select></label>
        <button type="button" data-capture-gallery>Descargar captura SVG</button>
        <output data-gallery-summary aria-live="polite">Cargando gramática…</output>
      </section>
      <section class="grammar-grid" data-grammar-grid aria-busy="true"></section>
    </main>`;

  const grid = requiredElement<HTMLElement>(root, '[data-grammar-grid]');
  const packFilter = requiredElement<HTMLSelectElement>(
    root,
    '[data-pack-filter]',
  );
  const layerFilter = requiredElement<HTMLSelectElement>(
    root,
    '[data-layer-filter]',
  );
  const summary = requiredElement<HTMLOutputElement>(
    root,
    '[data-gallery-summary]',
  );
  const capture = requiredElement<HTMLButtonElement>(
    root,
    '[data-capture-gallery]',
  );

  void loadGallery(abortController.signal)
    .then(async (items) => {
      const packs = [...new Set(items.map((item) => item.definition.packId))];
      for (const pack of packs)
        packFilter.add(new Option(pack.toUpperCase(), pack));
      const render = (): void => {
        const filtered = items.filter(
          (item) =>
            (packFilter.value === 'all' ||
              item.definition.packId === packFilter.value) &&
            (layerFilter.value === 'all' || item.layer === layerFilter.value),
        );
        renderItems(grid, filtered, abortController.signal);
        summary.value = `${filtered.length} tiles · ${packs.length} packs · ${items.length} totales`;
        root.dataset.galleryReady = 'true';
        grid.ariaBusy = 'false';
      };
      packFilter.addEventListener('change', render, {
        signal: abortController.signal,
      });
      layerFilter.addEventListener('change', render, {
        signal: abortController.signal,
      });
      capture.addEventListener(
        'click',
        () => downloadGallerySnapshot(items, packFilter.value),
        { signal: abortController.signal },
      );
      render();
    })
    .catch((error: unknown) => {
      summary.value =
        error instanceof Error
          ? error.message
          : 'No se pudo cargar la gramática.';
      grid.ariaBusy = 'false';
    });
  return () => abortController.abort();
}

async function loadGallery(signal: AbortSignal): Promise<GalleryItem[]> {
  const [terrainResponse, featureResponse] = await Promise.all([
    fetch(TERRAIN_URL, { signal }),
    fetch(FEATURE_URL, { signal }),
  ]);
  if (!terrainResponse.ok || !featureResponse.ok)
    throw new Error('Los contratos de contenido no están disponibles.');
  const terrain = (await terrainResponse.json()) as TerrainTileDefinition[];
  const features = (await featureResponse.json()) as FeatureTileDefinition[];
  return [
    ...terrain.map((definition): GalleryItem => ({
      layer: 'terrain',
      definition,
    })),
    ...features.map((definition): GalleryItem => ({
      layer: 'feature',
      definition,
    })),
  ];
}

function renderItems(
  grid: HTMLElement,
  items: readonly GalleryItem[],
  signal: AbortSignal,
): void {
  grid.replaceChildren();
  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'grammar-card';
    card.dataset.pack = item.definition.packId;
    card.dataset.layer = item.layer;
    const rotations =
      item.layer === 'terrain'
        ? item.definition.rotationQuarterTurns
        : ([0] as const);
    let rotationIndex = 0;
    card.innerHTML = `
      <div class="grammar-proxy" data-proxy><div class="grammar-proxy__shape" data-proxy-shape></div><span data-proxy-state>CARGANDO</span></div>
      <div class="grammar-card__meta">
        <p>${escapeHtml(item.layer.toUpperCase())} // ${escapeHtml(item.definition.packId.toUpperCase())}</p>
        <h2>${escapeHtml(item.definition.id)}</h2>
        <p class="grammar-card__tags">${item.definition.tags.map(escapeHtml).join(' · ')}</p>
        <dl><dt>numericId</dt><dd>${item.definition.numericId}</dd><dt>peso</dt><dd>${item.definition.weight}</dd><dt>rotación</dt><dd data-rotation>${rotations[0] ?? 0} × 90°</dd></dl>
        ${item.layer === 'terrain' ? '<pre data-sockets></pre>' : `<pre>terrain: ${escapeHtml(item.definition.allowedTerrainTags.join(', '))}</pre>`}
        <button type="button" data-rotate ${rotations.length < 2 ? 'disabled' : ''}>Siguiente rotación</button>
      </div>`;
    const shape = requiredElement<HTMLElement>(card, '[data-proxy-shape]');
    const state = requiredElement<HTMLElement>(card, '[data-proxy-state]');
    const rotationLabel = requiredElement<HTMLElement>(card, '[data-rotation]');
    const sockets = card.querySelector<HTMLElement>('[data-sockets]');
    const renderRotation = (): void => {
      const rotation = rotations[rotationIndex] ?? 0;
      shape.style.setProperty('--tile-rotation', `${rotation * 90}deg`);
      rotationLabel.textContent = `${rotation} × 90°`;
      if (item.layer === 'terrain' && sockets !== null)
        sockets.textContent = formatSockets(item.definition, rotation);
    };
    card.querySelector<HTMLButtonElement>('[data-rotate]')?.addEventListener(
      'click',
      () => {
        rotationIndex = (rotationIndex + 1) % rotations.length;
        renderRotation();
      },
      { signal },
    );
    renderRotation();
    if (item.definition.mesh === null) {
      state.textContent = 'EMPTY';
      shape.dataset.shape = 'empty';
    } else {
      void fetch(item.definition.mesh, { signal })
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json() as Promise<ProxyAssetDescriptor>;
        })
        .then((proxy) => {
          shape.dataset.shape = proxy.shape;
          shape.style.setProperty('--proxy-color', proxy.color);
          shape.style.setProperty('--proxy-accent', proxy.accent);
          shape.style.setProperty(
            '--proxy-height',
            `${Math.min(1, proxy.bounds.height / 5)}`,
          );
          state.textContent = proxy.shape.toUpperCase();
        })
        .catch(() => {
          state.textContent = 'ASSET ERROR';
          card.dataset.assetError = 'true';
        });
    }
    grid.append(card);
  }
}

function formatSockets(
  tile: TerrainTileDefinition,
  rotation: 0 | 1 | 2 | 3,
): string {
  const rotated = {} as Record<Direction, string>;
  for (let index = 0; index < CARDINAL_DIRECTIONS.length; index += 1) {
    const direction = CARDINAL_DIRECTIONS[index];
    const source = CARDINAL_DIRECTIONS[(index - rotation + 4) % 4];
    if (direction !== undefined && source !== undefined)
      rotated[direction] = tile.sockets[source];
  }
  return CARDINAL_DIRECTIONS.map(
    (direction) => `${direction}: ${rotated[direction]}`,
  ).join('\n');
}

function downloadGallerySnapshot(
  items: readonly GalleryItem[],
  pack: string,
): void {
  const filtered = items.filter(
    (item) => pack === 'all' || item.definition.packId === pack,
  );
  const columns = 4;
  const cardWidth = 270;
  const cardHeight = 150;
  const rows = Math.max(1, Math.ceil(filtered.length / columns));
  const cards = filtered
    .map((item, index) => {
      const x = (index % columns) * cardWidth;
      const y = Math.floor(index / columns) * cardHeight + 70;
      return `<g transform="translate(${x} ${y})"><rect x="8" y="8" width="254" height="134" rx="8" fill="#10232a" stroke="#315861"/><text x="22" y="38" fill="#91cfc2" font-size="11">${escapeXml(item.definition.packId.toUpperCase())} // ${escapeXml(item.layer.toUpperCase())}</text><text x="22" y="65" fill="#effff9" font-size="14">${escapeXml(item.definition.id)}</text><text x="22" y="91" fill="#91aaa5" font-size="10">${escapeXml(item.definition.tags.slice(0, 4).join(' · '))}</text><text x="22" y="119" fill="#c8fff2" font-size="10">ID ${item.definition.numericId} · W ${item.definition.weight}</text></g>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${columns * cardWidth}" height="${rows * cardHeight + 80}" viewBox="0 0 ${columns * cardWidth} ${rows * cardHeight + 80}"><rect width="100%" height="100%" fill="#071018"/><text x="16" y="38" fill="#effff9" font-family="sans-serif" font-size="22">LA ULTIMA OBSERVACION // GRAMMAR ${escapeXml(pack.toUpperCase())}</text>${cards}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `grammar-${pack}.svg`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function requiredElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (element === null)
    throw new Error(`Grammar viewer is missing ${selector}.`);
  return element;
}

function escapeHtml(value: string): string {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/gu,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[character] ?? character,
  );
}
