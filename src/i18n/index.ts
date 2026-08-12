import type { Locale, LocalizedCatalog } from '../contracts/localization';

export const LOCALE_STORAGE_KEY = 'ultima-observacion.locale.v1';

export interface UiCopy {
  readonly htmlLang: string;
  readonly title: string;
  readonly titleLine1: string;
  readonly titleLine2: string;
  readonly description: string;
  readonly initializing: string;
  readonly languageTitle: string;
  readonly languageHint: string;
  readonly english: string;
  readonly spanish: string;
  readonly enterChamber: string;
  readonly systemBar: string;
  readonly waiting: string;
  readonly roomEyebrow: string;
  readonly roomStatement: string;
  readonly roomHint: string;
  readonly interactHint: string;
  readonly briefingPlaying: string;
  readonly briefingPaused: string;
  readonly resumeBriefing: string;
  readonly skipBriefing: string;
  readonly enterPortal: string;
  readonly possibilities: string;
  readonly superposed: string;
  readonly undetermined: string;
  readonly workerInitializing: string;
  readonly buildLocal: string;
  readonly window: string;
  readonly dailySeed: string;
  readonly randomObservation: string;
  readonly look: string;
  readonly calibrationFailed: string;
  readonly retryCalibration: string;
  readonly audioUnavailable: string;
  readonly audioRetry: string;
  readonly audioBlocked: string;
  readonly audioError: string;
  readonly physicsUnavailable: string;
  readonly firstCollapseStartsClock: string;
  readonly observing: string;
  readonly pause: string;
  readonly ending: string;
  readonly rebuilding: string;
  readonly pauseAria: string;
  readonly pauseInstrument: string;
  readonly continueObservation: string;
  readonly sensitivity: string;
  readonly invertY: string;
  readonly headBob: string;
  readonly reducedFlashes: string;
  readonly highContrast: string;
  readonly subtitles: string;
  readonly localVoices: string;
  readonly quality: string;
  readonly qualityAuto: string;
  readonly qualityLow: string;
  readonly qualityMedium: string;
  readonly qualityHigh: string;
  readonly masterVolume: string;
  readonly voiceVolume: string;
  readonly ambienceVolume: string;
  readonly effectsVolume: string;
  readonly restartHold: string;
  readonly seedsAria: string;
  readonly packLabels: Readonly<
    Record<'water' | 'forest' | 'ruin' | 'storm', string>
  >;
  readonly packStates: Readonly<Record<string, string>>;
  readonly resultEyebrow: string;
  readonly resultTitle: string;
  readonly profile: string;
  readonly profileLabels: Readonly<Record<string, string>>;
  readonly closures: Readonly<Record<string, string>>;
  readonly readings: Readonly<Record<string, string>>;
  readonly resultMetrics: readonly [string, string, string, string];
  readonly agencyNote: string;
  readonly copyRecord: string;
  readonly copied: string;
  readonly newObservation: string;
  readonly preparingPanorama: string;
  readonly downloadPanorama: string;
  readonly panoramaUnavailable: string;
  readonly localGallery: string;
  readonly galleryOnlyLocal: string;
  readonly download: string;
  readonly remove: string;
  readonly remoteConsent: string;
  readonly remoteDisclosure: string;
  readonly remoteCreate: string;
  readonly remoteRequesting: string;
  readonly remoteReceived: string;
  readonly remoteUnavailable: string;
  readonly bootInterrupted: string;
  readonly bootFailed: string;
  readonly retry: string;
}

export const UI_COPY: LocalizedCatalog<UiCopy> = {
  en: {
    htmlLang: 'en',
    title: 'The Last Observation',
    titleLine1: 'The Last',
    titleLine2: 'Observation',
    description:
      'The Last Observation — a 3D browser game about a world that exists when you look at it.',
    initializing: 'Initializing observation instrument…',
    languageTitle: 'Select operational language',
    languageHint: 'The choice will be stored locally. English is the default.',
    english: 'English',
    spanish: 'Español',
    enterChamber: 'Enter Silence Chamber',
    systemBar: 'STATION // OBSERVATION WINDOW',
    waiting: 'STANDBY',
    roomEyebrow: 'AGENCY // SILENCE CHAMBER 7-C',
    roomStatement:
      'Last certified Collapser detected. Field body ready for assignment.',
    roomHint: 'WASD to move · mouse to look · E or click to interact',
    interactHint: 'E / CLICK // START MANDATORY BRIEFING',
    briefingPlaying: 'MANDATORY BRIEFING // PLAYING',
    briefingPaused: 'BRIEFING PAUSED',
    resumeBriefing: 'Resume',
    skipBriefing: 'Skip briefing',
    enterPortal: 'Enter the white sphere to begin',
    possibilities: 'POSSIBILITIES',
    superposed: 'SUPERPOSED',
    undetermined: 'UNDETERMINED',
    workerInitializing: 'CONTRACT // INITIALIZING',
    buildLocal: 'BUILD LOCAL',
    window: 'WINDOW',
    dailySeed: 'DAILY UTC',
    randomObservation: 'New random observation',
    look: 'LOOK',
    calibrationFailed: 'Gaze capture failed. Click to retry.',
    retryCalibration: 'Retry calibration',
    audioUnavailable: 'Audio unavailable · subtitles remain active',
    audioRetry: 'Retry voice',
    audioBlocked: 'Voice playback blocked',
    audioError: 'Voice asset error',
    physicsUnavailable: 'The field body could not initialize. Reload to retry.',
    firstCollapseStartsClock: 'Ready · the first collapse starts the clock',
    observing: 'OBSERVING',
    pause: 'PAUSED',
    ending: 'CLOSING',
    rebuilding: 'RECONSTRUCTING',
    pauseAria: 'Pause and options',
    pauseInstrument: 'INSTRUMENT PAUSED',
    continueObservation: 'Continue observation',
    sensitivity: 'Sensitivity',
    invertY: 'Invert Y axis',
    headBob: 'Reduced head bob',
    reducedFlashes: 'Reduced flashes',
    highContrast: 'High-contrast superposition',
    subtitles: 'Subtitles',
    localVoices: 'Local voices',
    quality: 'Quality',
    qualityAuto: 'Automatic',
    qualityLow: 'Low',
    qualityMedium: 'Medium',
    qualityHigh: 'High',
    masterVolume: 'Master volume',
    voiceVolume: 'Voice',
    ambienceVolume: 'Ambience',
    effectsVolume: 'Effects',
    restartHold: 'Restart · hold R for 2 s',
    seedsAria: 'Possibility Seeds',
    packLabels: {
      water: 'Water',
      forest: 'Forest',
      ruin: 'Ruin',
      storm: 'Storm',
    },
    packStates: {
      LOCKED: 'locked',
      AVAILABLE: 'available',
      COLLECTED: 'collected',
    },
    resultEyebrow: 'AGENT UPDATE RECORD',
    resultTitle:
      'You thought The Measure was recording the world. It was recording what kind of world you could make real.',
    profile: 'Profile',
    profileLabels: {
      Jardinero: 'Gardener',
      Cartógrafo: 'Cartographer',
      Guardián: 'Guardian',
      Testigo: 'Witness',
      Impaciente: 'Impatient',
    },
    closures: {
      'Fragmento observado': 'Observed fragment',
      'Mundo habitable': 'Habitable world',
      'Mundo que puede continuar': 'A world that may continue',
    },
    readings: {
      'Protegió lo cercano.': 'Protected what was close.',
      'Equilibró profundidad y expansión.': 'Balanced depth and expansion.',
      'Aceptó riesgo para ampliar lo posible.':
        'Accepted risk to enlarge the possible.',
    },
    resultMetrics: ['RESULTS', 'FORMS', 'INTERVENTIONS', 'DISTANCE'],
    agencyNote:
      'AGENCY // Record closed without recognition of cosmological causality or automatic right to body reimbursement.',
    copyRecord: 'Copy record',
    copied: 'Record copied',
    newObservation: 'New observation',
    preparingPanorama: 'Preparing panorama…',
    downloadPanorama: 'Download panorama PNG',
    panoramaUnavailable: 'Panorama unavailable',
    localGallery: 'Local gallery',
    galleryOnlyLocal:
      'Only in this browser. Each entry stores PNG, seed, profile and haiku.',
    download: 'Download',
    remove: 'Delete',
    remoteConsent: ' Send rounded profile and statistics for a remote variant',
    remoteDisclosure:
      'Does not send seed, route, panorama, local haiku or identifiers. One HTTPS request; 4 s timeout. The local haiku remains official.',
    remoteCreate: 'Create remote variant',
    remoteRequesting: 'Requesting a variant…',
    remoteReceived:
      'Remote variant received. It does not replace the local haiku.',
    remoteUnavailable:
      'The remote variant is unavailable. The local haiku is preserved.',
    bootInterrupted: 'OBSERVATION INTERRUPTED',
    bootFailed: 'The instrument could not start.',
    retry: 'Retry',
  },
  es: {
    htmlLang: 'es',
    title: 'La Última Observación',
    titleLine1: 'La Última',
    titleLine2: 'Observación',
    description:
      'La Última Observación — juego 3D de navegador sobre un mundo que existe al mirarlo.',
    initializing: 'Inicializando instrumento de observación…',
    languageTitle: 'Selecciona el idioma operativo',
    languageHint:
      'La elección se guardará localmente. El valor inicial es inglés.',
    english: 'English',
    spanish: 'Español',
    enterChamber: 'Entrar en la Cámara de Silencio',
    systemBar: 'ESTACIÓN // VENTANA DE OBSERVACIÓN',
    waiting: 'EN ESPERA',
    roomEyebrow: 'AGENCIA // CÁMARA DE SILENCIO 7-C',
    roomStatement:
      'Último Colapsador certificado detectado. Cuerpo de campo listo para asignación.',
    roomHint:
      'WASD para moverte · ratón para mirar · E o clic para interactuar',
    interactHint: 'E / CLIC // INICIAR BRIEFING OBLIGATORIO',
    briefingPlaying: 'BRIEFING OBLIGATORIO // EN CURSO',
    briefingPaused: 'BRIEFING EN PAUSA',
    resumeBriefing: 'Reanudar',
    skipBriefing: 'Omitir briefing',
    enterPortal: 'Entra en la esfera blanca para comenzar',
    possibilities: 'POSIBILIDADES',
    superposed: 'SUPERPUESTA',
    undetermined: 'INDETERMINADA',
    workerInitializing: 'CONTRATO // INICIALIZANDO',
    buildLocal: 'BUILD LOCAL',
    window: 'VENTANA',
    dailySeed: 'DIARIA UTC',
    randomObservation: 'Nueva observación aleatoria',
    look: 'MIRA',
    calibrationFailed:
      'No se pudo capturar la mirada. Haz clic para reintentar.',
    retryCalibration: 'Reintentar calibración',
    audioUnavailable: 'Audio no disponible · los subtítulos siguen activos',
    audioRetry: 'Reintentar voz',
    audioBlocked: 'Reproducción de voz bloqueada',
    audioError: 'Error en el asset de voz',
    physicsUnavailable:
      'El cuerpo de campo no pudo iniciar. Recarga para reintentar.',
    firstCollapseStartsClock: 'Lista · el primer colapso iniciará el reloj',
    observing: 'OBSERVANDO',
    pause: 'PAUSA',
    ending: 'CIERRE',
    rebuilding: 'RECONSTRUYENDO',
    pauseAria: 'Pausa y opciones',
    pauseInstrument: 'INSTRUMENTO EN PAUSA',
    continueObservation: 'Continuar observación',
    sensitivity: 'Sensibilidad',
    invertY: 'Invertir eje Y',
    headBob: 'Cabeceo reducido',
    reducedFlashes: 'Destellos reducidos',
    highContrast: 'Superposición de alto contraste',
    subtitles: 'Subtítulos',
    localVoices: 'Voces locales',
    quality: 'Calidad',
    qualityAuto: 'Automática',
    qualityLow: 'Baja',
    qualityMedium: 'Media',
    qualityHigh: 'Alta',
    masterVolume: 'Volumen maestro',
    voiceVolume: 'Voz',
    ambienceVolume: 'Ambiente',
    effectsVolume: 'Efectos',
    restartHold: 'Reiniciar · mantén R durante 2 s',
    seedsAria: 'Semillas de Posibilidad',
    packLabels: {
      water: 'Agua',
      forest: 'Bosque',
      ruin: 'Ruina',
      storm: 'Tormenta',
    },
    packStates: {
      LOCKED: 'bloqueada',
      AVAILABLE: 'disponible',
      COLLECTED: 'recogida',
    },
    resultEyebrow: 'EXPEDIENTE DE ACTUALIZACIÓN DEL AGENTE',
    resultTitle:
      'Creías que La Medida estaba registrando el mundo. Estaba registrando qué clase de mundo eras capaz de hacer real.',
    profile: 'Perfil',
    profileLabels: {
      Jardinero: 'Jardinero',
      Cartógrafo: 'Cartógrafo',
      Guardián: 'Guardián',
      Testigo: 'Testigo',
      Impaciente: 'Impaciente',
    },
    closures: {
      'Fragmento observado': 'Fragmento observado',
      'Mundo habitable': 'Mundo habitable',
      'Mundo que puede continuar': 'Mundo que puede continuar',
    },
    readings: {
      'Protegió lo cercano.': 'Protegió lo cercano.',
      'Equilibró profundidad y expansión.':
        'Equilibró profundidad y expansión.',
      'Aceptó riesgo para ampliar lo posible.':
        'Aceptó riesgo para ampliar lo posible.',
    },
    resultMetrics: ['RESULTADOS', 'FORMAS', 'INTERVENCIONES', 'DISTANCIA'],
    agencyNote:
      'AGENCIA // Expediente cerrado sin reconocimiento de causalidad cosmológica ni derecho automático a reembolso corporal.',
    copyRecord: 'Copiar registro',
    copied: 'Registro copiado',
    newObservation: 'Nueva observación',
    preparingPanorama: 'Preparando panorama…',
    downloadPanorama: 'Descargar panorama PNG',
    panoramaUnavailable: 'Panorama no disponible',
    localGallery: 'Galería local',
    galleryOnlyLocal:
      'Solo en este navegador. Cada entrada conserva PNG, seed, perfil y haiku.',
    download: 'Descargar',
    remove: 'Borrar',
    remoteConsent:
      ' Enviar perfil y estadísticas redondeadas para una variante remota',
    remoteDisclosure:
      'No envía seed, ruta, panorama, haiku local ni identificadores. Una petición HTTPS; timeout 4 s. El haiku local sigue siendo el expediente oficial.',
    remoteCreate: 'Crear variante remota',
    remoteRequesting: 'Solicitando una variante…',
    remoteReceived: 'Variante remota recibida. No sustituye el haiku local.',
    remoteUnavailable:
      'La variante remota no está disponible. El haiku local se conserva.',
    bootInterrupted: 'OBSERVACIÓN INTERRUMPIDA',
    bootFailed: 'El instrumento no pudo iniciar.',
    retry: 'Reintentar',
  },
};

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es';
}

export function loadLocale(storage: Storage = window.localStorage): Locale {
  try {
    const value = storage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : 'en';
  } catch {
    return 'en';
  }
}

export function saveLocale(
  locale: Locale,
  storage: Storage = window.localStorage,
): void {
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Persistence is an enhancement; gameplay remains available.
  }
}

export function uiCopy(locale: Locale): UiCopy {
  return UI_COPY[locale];
}

export function applyDocumentLocale(locale: Locale): void {
  const copy = uiCopy(locale);
  document.documentElement.lang = copy.htmlLang;
  document.title = copy.title;
  document
    .querySelector<HTMLMetaElement>('meta[name="description"]')
    ?.setAttribute('content', copy.description);
}
