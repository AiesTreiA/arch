/**
 * themes.js — Sistema modular de Temáticas de Metaverso para ARCH.
 *
 * Permite definir, registrar y cambiar fácilmente la temática completa de un metaverso
 * (mundo exterior, mundo astral/II, 5 templos/estratos, trono final, iluminación 3D,
 * paleta UI y textos narrativos) sin tocar la lógica del motor ni del generador.
 */

export const DEFAULT_THEME_ID = 'mitologia_griega';

/**
 * Registro central de temáticas de metaverso.
 * @type {Record<string, object>}
 */
export const METAVERSE_THEMES = {
  mitologia_griega: {
    id: 'mitologia_griega',
    name: 'Mitología Griega',
    shortName: 'Hélade',
    badge: 'De la Tierra al Piso 22',
    title: 'La Hoguera del Aqueronte — Selección de Héroe 3D',
    intro:
      'Siete juramentos convergen en la Ribera del Aqueronte. Explora Grecia en la superficie, cruza el Inframundo y derrota a Hades en el Piso 22.',
    worldLabel: 'Tierra',
    ui: {
      accent: '#e5b869',
      accentStrong: '#facc15',
      glow: 'rgba(229, 184, 105, 0.35)',
      stageBg: 'radial-gradient(circle at 50% 42%, #292014 0%, #0b0f18 62%, #05070c 100%)',
    },
    overworldBiome: {
      id: 'helade',
      name: 'Hélade · Tierra de los Mitos',
      floor: '#4a7c3a',
      wall: '#6b5e50',
      accent: '#38bdf8',
      isOverworld: true,
      lighting: {
        clearColor: 0x163954,
        ambientColor: 0xe0f2fe,
        ambientIntensity: 1.45,
        dirColor: 0xfffbeb,
        dirIntensity: 1.95,
        heroLightIntensity: 1.1,
      },
    },
    astralBiome: {
      id: 'firmamento_titanes',
      name: 'Mundo II · El Firmamento de los Titanes',
      subtitle: 'Islas de mármol cósmico suspendidas, starlight y templos de los Titanes',
      floor: '#1e1b4b',
      wall: '#312e81',
      accent: '#38bdf8',
      particles: 'starlight',
      isOverworld: true,
      isNewWorld: true,
      lighting: {
        clearColor: 0x0b1026,
        ambientColor: 0x93c5fd,
        ambientIntensity: 1.35,
        dirColor: 0xe0f2fe,
        dirIntensity: 1.75,
        heroLightIntensity: 1.4,
      },
    },
    finalBiome: {
      id: 'trono_tartaro',
      name: 'Trono del Tártaro · Morada de Hades',
      floor: '#1f102c',
      wall: '#581c87',
      accent: '#f97316',
      particles: 'embers',
      isFinalFloor: true,
      lighting: {
        clearColor: 0x0c0614,
        ambientColor: 0xa78bfa,
        ambientIntensity: 1.05,
        dirColor: 0xfde68a,
        dirIntensity: 1.45,
        heroLightIntensity: 2.0,
        pillarColor: 0x7e22ce,
      },
    },
    dungeonBiomes: [
      {
        id: 'styx',
        templeId: 'bosque',
        name: 'Templo del Bosque · Arboledas de Pan',
        subtitle: 'Halls cubiertos de hiedra, raíces colosales y esporas de hada',
        floor: '#1b2a20',
        wall: '#263b2f',
        accent: '#34d399',
        particles: 'spores',
        lighting: {
          clearColor: 0x0a140d,
          ambientColor: 0x34d399,
          ambientIntensity: 0.95,
          dirColor: 0xa7f3d0,
          dirIntensity: 1.35,
        },
      },
      {
        id: 'creta',
        templeId: 'fuego',
        name: 'Templo del Fuego · Minas de Hefesto',
        subtitle: 'Ríos de magma, basalto volcánico y ascuas incandescentes',
        floor: '#211512',
        wall: '#451a14',
        accent: '#f97316',
        particles: 'embers',
        lighting: {
          clearColor: 0x140705,
          ambientColor: 0xf97316,
          ambientIntensity: 1.1,
          dirColor: 0xfed7aa,
          dirIntensity: 1.4,
        },
      },
      {
        id: 'agua',
        templeId: 'agua',
        name: 'Templo del Agua · Gruta de las Náyades',
        subtitle: 'Salas sumergidas de mármol turquesa y fuentes sagradas',
        floor: '#0e2636',
        wall: '#154e63',
        accent: '#38bdf8',
        particles: 'bubbles',
        lighting: {
          clearColor: 0x05131a,
          ambientColor: 0x38bdf8,
          ambientIntensity: 1.15,
          dirColor: 0xbae6fd,
          dirIntensity: 1.45,
        },
      },
      {
        id: 'hefesto',
        templeId: 'sombras',
        name: 'Templo de las Sombras · Catacumbas del Inframundo',
        subtitle: 'Criptas sepulcrales, cadenas colgantes y fuegos fatuos',
        floor: '#1b1329',
        wall: '#382352',
        accent: '#c084fc',
        particles: 'wisps',
        lighting: {
          clearColor: 0x0d0714,
          ambientColor: 0xc084fc,
          ambientIntensity: 0.9,
          dirColor: 0xe9d5ff,
          dirIntensity: 1.25,
        },
      },
      {
        id: 'tartaro',
        templeId: 'espiritu',
        name: 'Templo del Espíritu · Coloso de las Amazonas',
        subtitle: 'Arenas doradas del desierto, monolitos solares y obeliscos',
        floor: '#382714',
        wall: '#603f23',
        accent: '#facc15',
        particles: 'dust',
        lighting: {
          clearColor: 0x1a1208,
          ambientColor: 0xfacc15,
          ambientIntensity: 1.2,
          dirColor: 0xfef08a,
          dirIntensity: 1.5,
        },
      },
    ],
    overworldZones: [
      {
        id: 'aqueronte',
        name: 'Ribera del Aqueronte',
        subtitle: 'Campamento de la Sibila y muelle del barquero',
        fx: 0.2,
        fy: 0.72,
        radiusFrac: 0.16,
        color: '#60a5fa',
      },
      {
        id: 'arcadia',
        name: 'Bosques de Arcadia',
        subtitle: 'Praderas de asfódelos y arboledas de Pan',
        fx: 0.22,
        fy: 0.23,
        radiusFrac: 0.17,
        color: '#4ade80',
      },
      {
        id: 'delfos',
        name: 'Santuario de Delfos',
        subtitle: 'Explanada de mármol y Altar de Asclepio',
        fx: 0.54,
        fy: 0.46,
        radiusFrac: 0.14,
        color: '#facc15',
      },
      {
        id: 'egeo',
        name: 'Costa del Mar Egeo',
        subtitle: 'Playas doradas, aguas turquesas y ruinas',
        fx: 0.8,
        fy: 0.72,
        radiusFrac: 0.18,
        color: '#38bdf8',
      },
      {
        id: 'olimpo_pie',
        name: 'Ladera del Olimpo',
        subtitle: 'Meseta sagrada y descenso al Inframundo',
        fx: 0.8,
        fy: 0.2,
        radiusFrac: 0.16,
        color: '#f97316',
      },
    ],
  },

  valhalla_nordico: {
    id: 'valhalla_nordico',
    name: 'Valhalla Nórdico',
    shortName: 'Midgard',
    badge: 'De Midgard al Ragnarök',
    title: 'La Hoguera de Midgard — Selección de Einherjar 3D',
    intro:
      'Los Nueve Reinos tiemblan ante el Fimbulvetr. Recorre los fiordos de Midgard, desciende por las raíces de Yggdrasil y enfrenta el ocaso en el Piso 22.',
    worldLabel: 'Midgard',
    ui: {
      accent: '#7dd3fc',
      accentStrong: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.35)',
      stageBg: 'radial-gradient(circle at 50% 42%, #132538 0%, #09101a 62%, #05080f 100%)',
    },
    overworldBiome: {
      id: 'midgard',
      name: 'Midgard · Fiordos del Norte',
      floor: '#3f624d',
      wall: '#52606d',
      accent: '#7dd3fc',
      isOverworld: true,
      lighting: {
        clearColor: 0x0f2537,
        ambientColor: 0xbae6fd,
        ambientIntensity: 1.35,
        dirColor: 0xf1f5f9,
        dirIntensity: 1.85,
        heroLightIntensity: 1.25,
      },
    },
    astralBiome: {
      id: 'asgard_bifrost',
      name: 'Mundo II · Puente Bifröst de Asgard',
      subtitle: 'Salones dorados suspendidos en la aurora boreal',
      floor: '#172554',
      wall: '#312e81',
      accent: '#34d399',
      particles: 'starlight',
      isOverworld: true,
      isNewWorld: true,
      lighting: {
        clearColor: 0x091529,
        ambientColor: 0x6ee7b7,
        ambientIntensity: 1.35,
        dirColor: 0xfef3c7,
        dirIntensity: 1.75,
        heroLightIntensity: 1.4,
      },
    },
    finalBiome: {
      id: 'muspelheim_trono',
      name: 'Trono de Muspelheim · Ocaso de Surtr',
      floor: '#240f12',
      wall: '#7f1d1d',
      accent: '#fb923c',
      particles: 'embers',
      isFinalFloor: true,
      lighting: {
        clearColor: 0x120506,
        ambientColor: 0xf97316,
        ambientIntensity: 1.1,
        dirColor: 0xfef08a,
        dirIntensity: 1.5,
        heroLightIntensity: 2.0,
        pillarColor: 0x991b1b,
      },
    },
    dungeonBiomes: [
      {
        id: 'yggdrasil_raices',
        templeId: 'bosque',
        name: 'Raíces de Yggdrasil · Bosque Rúnico',
        subtitle: 'Robles milenarios, musgo brillante y niebla ancestral',
        floor: '#162822',
        wall: '#233d33',
        accent: '#34d399',
        particles: 'spores',
        lighting: {
          clearColor: 0x07130f,
          ambientColor: 0x34d399,
          ambientIntensity: 1.0,
          dirColor: 0xd1fae5,
          dirIntensity: 1.35,
        },
      },
      {
        id: 'nidavellir',
        templeId: 'fuego',
        name: 'Forjas de Nidavellir · Fragua Enana',
        subtitle: 'Yunques incandescentes, acero rúnico y lava',
        floor: '#241410',
        wall: '#4a1d14',
        accent: '#f97316',
        particles: 'embers',
        lighting: {
          clearColor: 0x160805,
          ambientColor: 0xf97316,
          ambientIntensity: 1.15,
          dirColor: 0xfed7aa,
          dirIntensity: 1.45,
        },
      },
      {
        id: 'jotunheim_hielo',
        templeId: 'agua',
        name: 'Glaciares de Jotunheim · Caverna Glacial',
        subtitle: 'Hielo eterno, estalactitas azules y vientos árticos',
        floor: '#0f2738',
        wall: '#1e4b66',
        accent: '#7dd3fc',
        particles: 'bubbles',
        lighting: {
          clearColor: 0x061521,
          ambientColor: 0x7dd3fc,
          ambientIntensity: 1.25,
          dirColor: 0xe0f2fe,
          dirIntensity: 1.5,
        },
      },
      {
        id: 'helheim',
        templeId: 'sombras',
        name: 'Brumas de Helheim · Salón de los Caídos',
        subtitle: 'Penumbras gélidas, estelas rúnicas y espectros',
        floor: '#15162b',
        wall: '#2e294e',
        accent: '#a78bfa',
        particles: 'wisps',
        lighting: {
          clearColor: 0x090a17,
          ambientColor: 0xa78bfa,
          ambientIntensity: 0.95,
          dirColor: 0xddd6fe,
          dirIntensity: 1.25,
        },
      },
      {
        id: 'vanaheim',
        templeId: 'espiritu',
        name: 'Santuario de Vanaheim · Ámbar Dorado',
        subtitle: 'Columnas de ámbar solar y reliquias de los Vanir',
        floor: '#332612',
        wall: '#5c411c',
        accent: '#fbbf24',
        particles: 'dust',
        lighting: {
          clearColor: 0x171107,
          ambientColor: 0xfbbf24,
          ambientIntensity: 1.2,
          dirColor: 0xfef3c7,
          dirIntensity: 1.45,
        },
      },
    ],
    overworldZones: [
      { id: 'kattegat', name: 'Puerto de Kattegat', subtitle: 'Muelles drakkar y hoguera del skald', fx: 0.2, fy: 0.72, radiusFrac: 0.16, color: '#7dd3fc' },
      { id: 'bosque_hierro', name: 'Bosque de Hierro', subtitle: 'Pinos nevados y piedras rúnicas', fx: 0.22, fy: 0.23, radiusFrac: 0.17, color: '#34d399' },
      { id: 'altar_odin', name: 'Altar de Odín', subtitle: 'Círculo de menhires y cuervos', fx: 0.54, fy: 0.46, radiusFrac: 0.14, color: '#fbbf24' },
      { id: 'fiordo_helado', name: 'Fiordo de Hielo', subtitle: 'Aguas árticas y acantilados', fx: 0.8, fy: 0.72, radiusFrac: 0.18, color: '#38bdf8' },
      { id: 'puerta_bifrost', name: 'Cumbre del Bifröst', subtitle: 'Portal al inframundo de Hel', fx: 0.8, fy: 0.2, radiusFrac: 0.16, color: '#a78bfa' },
    ],
  },

  ciber_olimpo: {
    id: 'ciber_olimpo',
    name: 'Ciber-Olimpo 2099',
    shortName: 'Neo-Olimpo',
    badge: 'Sector 01 al Núcleo 22',
    title: 'Terminal Aqueronte — Selección de Avatar 3D',
    intro:
      'Siete protocolos de combate convergen en la Red de Neo-Olimpo. Infiltra la superficie sintética, desciende por los servidores abisales y purga el Núcleo 22.',
    worldLabel: 'Sector',
    ui: {
      accent: '#22d3ee',
      accentStrong: '#f472b6',
      glow: 'rgba(34, 211, 238, 0.35)',
      stageBg: 'radial-gradient(circle at 50% 42%, #1d1035 0%, #090c1a 62%, #04050b 100%)',
    },
    overworldBiome: {
      id: 'neo_acropolis',
      name: 'Neo-Acrópolis · Distrito Neón',
      floor: '#1f2937',
      wall: '#374151',
      accent: '#22d3ee',
      isOverworld: true,
      lighting: {
        clearColor: 0x0b1120,
        ambientColor: 0x67e8f9,
        ambientIntensity: 1.3,
        dirColor: 0xf472b6,
        dirIntensity: 1.7,
        heroLightIntensity: 1.3,
      },
    },
    astralBiome: {
      id: 'hiper_red',
      name: 'Mundo II · Hiper-Red Orbital',
      subtitle: 'Nodos cuánticos flotantes y autopistas de fotones',
      floor: '#17153b',
      wall: '#2e236c',
      accent: '#f472b6',
      particles: 'starlight',
      isOverworld: true,
      isNewWorld: true,
      lighting: {
        clearColor: 0x09061c,
        ambientColor: 0xf472b6,
        ambientIntensity: 1.35,
        dirColor: 0x22d3ee,
        dirIntensity: 1.8,
        heroLightIntensity: 1.5,
      },
    },
    finalBiome: {
      id: 'nucleo_zero',
      name: 'Núcleo Zero · Mainframe de Hades-AI',
      floor: '#1a0b24',
      wall: '#6b21a8',
      accent: '#f43f5e',
      particles: 'embers',
      isFinalFloor: true,
      lighting: {
        clearColor: 0x0a0312,
        ambientColor: 0xf43f5e,
        ambientIntensity: 1.15,
        dirColor: 0x22d3ee,
        dirIntensity: 1.55,
        heroLightIntensity: 2.1,
        pillarColor: 0xdb2777,
      },
    },
    dungeonBiomes: [
      {
        id: 'bio_domo',
        templeId: 'bosque',
        name: 'Bio-Domo 04 · Jardín Sintético',
        subtitle: 'Flora bioluminiscente y circuitos orgánicos',
        floor: '#0f2922',
        wall: '#184438',
        accent: '#10b981',
        particles: 'spores',
        lighting: { clearColor: 0x051410, ambientColor: 0x10b981, ambientIntensity: 1.05, dirColor: 0x6ee7b7, dirIntensity: 1.4 },
      },
      {
        id: 'reactor_plasma',
        templeId: 'fuego',
        name: 'Reactor Hefesto · Plasma Crítico',
        subtitle: 'Turbinas térmicas, láseres y metal fundido',
        floor: '#261214',
        wall: '#521822',
        accent: '#fb7185',
        particles: 'embers',
        lighting: { clearColor: 0x140609, ambientColor: 0xfb7185, ambientIntensity: 1.15, dirColor: 0xfecdd3, dirIntensity: 1.45 },
      },
      {
        id: 'refrigerante',
        templeId: 'agua',
        name: 'Cámara Criogénica · Náyade-OS',
        subtitle: 'Conductos de nitrógeno líquido y cristales cian',
        floor: '#0a2333',
        wall: '#12435e',
        accent: '#22d3ee',
        particles: 'bubbles',
        lighting: { clearColor: 0x04121c, ambientColor: 0x22d3ee, ambientIntensity: 1.2, dirColor: 0xa5f3fc, dirIntensity: 1.5 },
      },
      {
        id: 'darknet',
        templeId: 'sombras',
        name: 'Subred Encriptada · Sector Nix',
        subtitle: 'Servidores oscuros, cortafuegos violeta y datos fantasma',
        floor: '#171029',
        wall: '#321e54',
        accent: '#c084fc',
        particles: 'wisps',
        lighting: { clearColor: 0x0a0614, ambientColor: 0xc084fc, ambientIntensity: 1.0, dirColor: 0xe9d5ff, dirIntensity: 1.35 },
      },
      {
        id: 'boveda_oro',
        templeId: 'espiritu',
        name: 'Bóveda Solar · Satélite Helios',
        subtitle: 'Paneles dorados, energía fotovoltaica y prismas',
        floor: '#2e220f',
        wall: '#543c16',
        accent: '#facc15',
        particles: 'dust',
        lighting: { clearColor: 0x140f06, ambientColor: 0xfacc15, ambientIntensity: 1.2, dirColor: 0xfef08a, dirIntensity: 1.5 },
      },
    ],
    overworldZones: [
      { id: 'terminal', name: 'Terminal Aqueronte', subtitle: 'Nodo de enlace y estación de recarga', fx: 0.2, fy: 0.72, radiusFrac: 0.16, color: '#22d3ee' },
      { id: 'parque_bio', name: 'Parque Bio-Sintético', subtitle: 'Invernaderos de neón verde', fx: 0.22, fy: 0.23, radiusFrac: 0.17, color: '#10b981' },
      { id: 'plaza_delfos', name: 'Plaza del Oráculo', subtitle: 'Torre holográfica central', fx: 0.54, fy: 0.46, radiusFrac: 0.14, color: '#facc15' },
      { id: 'bahia_datos', name: 'Bahía de Datos', subtitle: 'Muelle de fibra óptica y mar oscuro', fx: 0.8, fy: 0.72, radiusFrac: 0.18, color: '#38bdf8' },
      { id: 'torre_olimpo', name: 'Aguja del Olimpo', subtitle: 'Acceso al mainframe subterráneo', fx: 0.8, fy: 0.2, radiusFrac: 0.16, color: '#f472b6' },
    ],
  },

  abismo_cosmico: {
    id: 'abismo_cosmico',
    name: 'Abismo Cósmico',
    shortName: 'Cosmos',
    badge: 'De la Nebulosa al Horizonte 22',
    title: 'El Faro del Vacío — Selección de Viajero 3D',
    intro:
      'Siete arquetipos estelares despiertan en el borde de la galaxia. Cruza la nebulosa viviente, explora los templos gravitacionales y conquista la Singularidad 22.',
    worldLabel: 'Órbita',
    ui: {
      accent: '#c084fc',
      accentStrong: '#e879f9',
      glow: 'rgba(192, 132, 252, 0.38)',
      stageBg: 'radial-gradient(circle at 50% 42%, #24133a 0%, #0d0919 62%, #05030a 100%)',
    },
    overworldBiome: {
      id: 'nebulosa',
      name: 'Nebulosa de Orión · Bastión Estelar',
      floor: '#2b254a',
      wall: '#43386b',
      accent: '#c084fc',
      isOverworld: true,
      lighting: {
        clearColor: 0x0d081d,
        ambientColor: 0xd8b4fe,
        ambientIntensity: 1.35,
        dirColor: 0xfef3c7,
        dirIntensity: 1.8,
        heroLightIntensity: 1.3,
      },
    },
    astralBiome: {
      id: 'corona_celestial',
      name: 'Mundo II · Corona de las Galaxias',
      subtitle: 'Puentes de luz estelar y constelaciones vivas',
      floor: '#17153b',
      wall: '#312e81',
      accent: '#38bdf8',
      particles: 'starlight',
      isOverworld: true,
      isNewWorld: true,
      lighting: {
        clearColor: 0x070b1e,
        ambientColor: 0x93c5fd,
        ambientIntensity: 1.4,
        dirColor: 0xe0f2fe,
        dirIntensity: 1.85,
        heroLightIntensity: 1.45,
      },
    },
    finalBiome: {
      id: 'singularidad',
      name: 'Horizonte de Sucesos · Trono del Vacío',
      floor: '#160921',
      wall: '#581c87',
      accent: '#e879f9',
      particles: 'embers',
      isFinalFloor: true,
      lighting: {
        clearColor: 0x07020d,
        ambientColor: 0xe879f9,
        ambientIntensity: 1.1,
        dirColor: 0xfde68a,
        dirIntensity: 1.5,
        heroLightIntensity: 2.1,
        pillarColor: 0x9333ea,
      },
    },
    dungeonBiomes: [
      {
        id: 'jardin_etereo',
        templeId: 'bosque',
        name: 'Templo de Esmeralda · Cometa Vivo',
        subtitle: 'Cristales verdes espaciales y polvo estelar',
        floor: '#142923',
        wall: '#214237',
        accent: '#34d399',
        particles: 'spores',
        lighting: { clearColor: 0x06120e, ambientColor: 0x34d399, ambientIntensity: 1.0, dirColor: 0xa7f3d0, dirIntensity: 1.35 },
      },
      {
        id: 'estrella_roja',
        templeId: 'fuego',
        name: 'Templo Supernova · Estrella Enana',
        subtitle: 'Llamaradas solares y roca meteórica ardiente',
        floor: '#291312',
        wall: '#541e18',
        accent: '#fb923c',
        particles: 'embers',
        lighting: { clearColor: 0x160705, ambientColor: 0xfb923c, ambientIntensity: 1.15, dirColor: 0xfed7aa, dirIntensity: 1.45 },
      },
      {
        id: 'mar_eter',
        templeId: 'agua',
        name: 'Templo del Éter · Océano Lunar',
        subtitle: 'Mareas gravitacionales y obsidiana azulada',
        floor: '#0d2336',
        wall: '#194566',
        accent: '#38bdf8',
        particles: 'bubbles',
        lighting: { clearColor: 0x05111c, ambientColor: 0x38bdf8, ambientIntensity: 1.15, dirColor: 0xbae6fd, dirIntensity: 1.45 },
      },
      {
        id: 'grieta_vacio',
        templeId: 'sombras',
        name: 'Grieta del Vacío · Umbral Oscuro',
        subtitle: 'Materia oscura, ecos astrales y obeliscos',
        floor: '#19102b',
        wall: '#382257',
        accent: '#c084fc',
        particles: 'wisps',
        lighting: { clearColor: 0x0a0514, ambientColor: 0xc084fc, ambientIntensity: 0.95, dirColor: 0xe9d5ff, dirIntensity: 1.3 },
      },
      {
        id: 'astro_dorado',
        templeId: 'espiritu',
        name: 'Ciudadela Helios · Corona Áurea',
        subtitle: 'Polvo de estrellas doradas y templos solares',
        floor: '#332411',
        wall: '#5e411d',
        accent: '#facc15',
        particles: 'dust',
        lighting: { clearColor: 0x171006, ambientColor: 0xfacc15, ambientIntensity: 1.2, dirColor: 0xfef08a, dirIntensity: 1.5 },
      },
    ],
    overworldZones: [
      { id: 'faro_vacio', name: 'Faro del Vacío', subtitle: 'Santuario orbital de partida', fx: 0.2, fy: 0.72, radiusFrac: 0.16, color: '#c084fc' },
      { id: 'arboleda_cometa', name: 'Estela del Cometa', subtitle: 'Bosque de cristales estelares', fx: 0.22, fy: 0.23, radiusFrac: 0.17, color: '#34d399' },
      { id: 'observatorio', name: 'Observatorio Astral', subtitle: 'Altar de alineación cósmica', fx: 0.54, fy: 0.46, radiusFrac: 0.14, color: '#facc15' },
      { id: 'mar_nebulosa', name: 'Mar de Nebulosa', subtitle: 'Aguas luminiscentes', fx: 0.8, fy: 0.72, radiusFrac: 0.18, color: '#38bdf8' },
      { id: 'portal_singular', name: 'Puerta de la Singularidad', subtitle: 'Descenso hacia el horizonte', fx: 0.8, fy: 0.2, radiusFrac: 0.16, color: '#e879f9' },
    ],
  },
};

/**
 * Registra o sobrescribe una temática de metaverso de forma modular.
 * @param {object} themeDef Definición completa de temática.
 * @returns {object} La temática registrada.
 */
export function registerMetaverseTheme(themeDef) {
  if (!themeDef || !themeDef.id) {
    throw new Error('registerMetaverseTheme requiere un objeto con propiedad `id`.');
  }
  METAVERSE_THEMES[themeDef.id] = themeDef;
  return themeDef;
}

/**
 * Obtiene una temática de metaverso por su ID, con fallback a `mitologia_griega`.
 */
export function getMetaverseTheme(themeId = DEFAULT_THEME_ID) {
  return METAVERSE_THEMES[themeId] || METAVERSE_THEMES[DEFAULT_THEME_ID];
}

/**
 * Lista todas las temáticas de metaverso disponibles.
 */
export function listMetaverseThemes() {
  return Object.values(METAVERSE_THEMES);
}

/**
 * Resuelve la configuración de iluminación 3D para un bioma dado.
 * Permite que cada metaverso defina su propia atmósfera sin condicionales rígidos en el renderizador.
 */
export function resolveBiomeLighting(biome, theme = null) {
  if (biome?.lighting) return biome.lighting;
  const t = theme || getMetaverseTheme(DEFAULT_THEME_ID);
  if (biome?.isNewWorld && t.astralBiome?.lighting) return t.astralBiome.lighting;
  if (biome?.isOverworld && t.overworldBiome?.lighting) return t.overworldBiome.lighting;
  if (biome?.isFinalFloor && t.finalBiome?.lighting) return t.finalBiome.lighting;

  const temple = biome?.templeId || biome?.id;
  const matched = t.dungeonBiomes?.find((b) => b.id === biome?.id || b.templeId === temple);
  if (matched?.lighting) return matched.lighting;

  return {
    clearColor: 0x07090f,
    ambientColor: 0x8b9bb4,
    ambientIntensity: 0.95,
    dirColor: 0xfef3c7,
    dirIntensity: 1.35,
    heroLightIntensity: 1.8,
  };
}

/**
 * Aplica las variables CSS y metadatos de la temática activa al documento (en navegador).
 */
export function applyThemeToDocument(themeOrId) {
  if (typeof document === 'undefined') return null;
  const theme = typeof themeOrId === 'string' ? getMetaverseTheme(themeOrId) : themeOrId || getMetaverseTheme();
  const root = document.documentElement;
  if (!root) return theme;
  root.dataset.metaverseTheme = theme.id;
  if (theme.ui) {
    if (theme.ui.accent) root.style.setProperty('--gold', theme.ui.accent);
    if (theme.ui.accentStrong) root.style.setProperty('--theme-accent-strong', theme.ui.accentStrong);
    if (theme.ui.glow) root.style.setProperty('--theme-glow', theme.ui.glow);
    if (theme.ui.stageBg) root.style.setProperty('--theme-stage-bg', theme.ui.stageBg);
  }
  return theme;
}
