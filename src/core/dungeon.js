/**
 * dungeon.js — Generador procedural de mundo exterior griego (Piso 1) y mazmorras del Inframundo (Pisos 2–22).
 * Tipos de celda navegables: 0 = obstáculo/acantilado/muro/agua profunda, 1 = suelo caminable,
 * 2 = altar curativo de Asclepio, 3 = escaleras/portal de descenso, 4 = escaleras de ascenso.
 */
import { createRng } from './rng.js';

export const TILE_WALL = 0;
export const TILE_FLOOR = 1;
export const TILE_SHRINE = 2;
export const TILE_STAIRS = 3;
export const TILE_STAIRS_UP = 4;

export const FINAL_FLOOR = 22;

export function isFinalFloorLevel(level) {
  if (level === -3 || level === 3 || level === 22 || level === FINAL_FLOOR) return true;
  if (typeof level === 'string') {
    const s = level.toLowerCase();
    return s === '-3' || s === '3' || s === '22' || s.includes('final') || s.includes('hades') || s.includes('tartaro');
  }
  return false;
}

export const OVERWORLD_BIOME = {
  id: 'helade',
  name: 'Hélade · Tierra de los Mitos',
  floor: '#4a7c3a',
  wall: '#6b5e50',
  accent: '#38bdf8',
  isOverworld: true,
};

export const ASTRAL_BIOME = {
  id: 'firmamento_titanes',
  name: 'Mundo II · El Firmamento de los Titanes',
  subtitle: 'Islas de mármol cósmico suspendidas, starlight y templos de los Titanes',
  floor: '#1e1b4b',
  wall: '#312e81',
  accent: '#38bdf8',
  particles: 'starlight',
  isOverworld: true,
  isNewWorld: true,
};

export const FINAL_BIOME = {
  id: 'trono_tartaro',
  name: 'Trono del Tártaro · Morada de Hades',
  floor: '#1f102c',
  wall: '#581c87',
  accent: '#f97316',
  particles: 'embers',
  isFinalFloor: true,
};

export const BIOMES = [
  {
    id: 'styx',
    templeId: 'bosque',
    name: 'Templo del Bosque · Arboledas de Pan',
    subtitle: 'Halls cubiertos de hiedra, raíces colosales y esporas de hada',
    floor: '#1b2a20',
    wall: '#263b2f',
    accent: '#34d399',
    particles: 'spores',
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
  },
];

export const OVERWORLD_ZONES = [
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
    fx: 0.76,
    fy: 0.75,
    radiusFrac: 0.17,
    color: '#38bdf8',
  },
  {
    id: 'tartaro_gate',
    name: 'Fauces del Tártaro',
    subtitle: 'Desfiladero del Monte Otris · Descenso al Hades',
    fx: 0.8,
    fy: 0.21,
    radiusFrac: 0.15,
    color: '#f97316',
  },
];

function roomsOverlap(a, b, pad = 2) {
  return (
    a.x - pad < b.x + b.w &&
    a.x + a.w + pad > b.x &&
    a.y - pad < b.y + b.h &&
    a.y + a.h + pad > b.y
  );
}

function carveRect(grid, x, y, w, h, value = TILE_FLOOR) {
  for (let gy = y; gy < y + h; gy++) {
    for (let gx = x; gx < x + w; gx++) {
      if (gy > 0 && gy < grid.length - 1 && gx > 0 && gx < grid[0].length - 1) {
        grid[gy][gx] = value;
      }
    }
  }
}

export function carveCircle(grid, cx, cy, radius, value = TILE_FLOOR) {
  const r2 = radius * radius;
  const h = grid.length;
  const w = grid[0].length;
  for (let gy = Math.max(1, Math.floor(cy - radius)); gy <= Math.min(h - 2, Math.ceil(cy + radius)); gy++) {
    for (let gx = Math.max(1, Math.floor(cx - radius)); gx <= Math.min(w - 2, Math.ceil(cx + radius)); gx++) {
      const d2 = (gx - cx) * (gx - cx) + (gy - cy) * (gy - cy);
      if (d2 <= r2) {
        grid[gy][gx] = value;
      }
    }
  }
}

function carveCorridor(grid, x1, y1, x2, y2, rng, corridorWidth = 2) {
  const horizFirst = rng.chance(0.5);
  const carveStep = (x, y) => {
    carveRect(grid, x, y, corridorWidth, corridorWidth, TILE_FLOOR);
  };
  let cx = x1;
  let cy = y1;
  if (horizFirst) {
    while (cx !== x2) {
      carveStep(cx, cy);
      cx += cx < x2 ? 1 : -1;
    }
    while (cy !== y2) {
      carveStep(cx, cy);
      cy += cy < y2 ? 1 : -1;
    }
  } else {
    while (cy !== y2) {
      carveStep(cx, cy);
      cy += cy < y2 ? 1 : -1;
    }
    while (cx !== x2) {
      carveStep(cx, cy);
      cx += cx < x2 ? 1 : -1;
    }
  }
  carveStep(x2, y2);
}

/** Garantiza por BFS un camino caminable entre dos puntos, abriendo sendero o puente si hiciera falta. */
function ensurePathConnected(grid, terrain, x1, y1, x2, y2) {
  const height = grid.length;
  const width = grid[0].length;
  const startKey = `${x1},${y1}`;
  const goalKey = `${x2},${y2}`;
  const queue = [[x1, y1]];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (`${cx},${cy}` === goalKey) return;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx <= 0 || nx >= width - 1 || ny <= 0 || ny >= height - 1) continue;
      if (grid[ny][nx] === TILE_WALL) continue;
      const key = `${nx},${ny}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }

  // No estaba conectado aún: tallar camino orgánico + puente sobre agua
  let cx = x1;
  let cy = y1;
  const carveTile = (tx, ty) => {
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const px = tx + ox;
        const py = ty + oy;
        if (px <= 1 || px >= width - 2 || py <= 1 || py >= height - 2) continue;
        if (grid[py][px] === TILE_WALL) {
          const prevT = terrain?.[py]?.[px];
          grid[py][px] = TILE_FLOOR;
          if (terrain?.[py]) {
            terrain[py][px] = prevT === 'water' || prevT === 'shallow_water' ? 'bridge' : 'dirt';
          }
        }
      }
    }
  };

  while (cx !== x2 || cy !== y2) {
    carveTile(cx, cy);
    if (cx !== x2) cx += cx < x2 ? 1 : -1;
    else if (cy !== y2) cy += cy < y2 ? 1 : -1;
  }
  carveTile(x2, y2);
}

/**
 * Genera el Nivel 1 sobre la tierra: mundo abierto vivo de la Antigua Grecia
 * con pasto, caminos de tierra, agua animada, puentes, bosques, playa, ruinas y zonas míticas.
 */
function generateOverworld({ width = 48, height = 48, seed = 'arch-1' } = {}) {
  const rng = createRng(`${seed}:overworld:1`);
  const grid = Array.from({ length: height }, () => Array(width).fill(TILE_FLOOR));
  const explored = Array.from({ length: height }, () => Array(width).fill(0));
  const terrain = Array.from({ length: height }, () => Array(width).fill('grass'));
  const elevation = Array.from({ length: height }, () => Array(width).fill(0));
  const zoneGrid = Array.from({ length: height }, () => Array(width).fill('helen_wilds'));

  const zones = OVERWORLD_ZONES.map((z) => {
    const cx = Math.max(4, Math.min(width - 5, Math.round(z.fx * (width - 1))));
    const cy = Math.max(4, Math.min(height - 5, Math.round(z.fy * (height - 1))));
    const radius = Math.max(3, Math.round(Math.min(width, height) * z.radiusFrac));
    return {
      ...z,
      cx,
      cy,
      radius,
      x: Math.max(2, cx - radius),
      y: Math.max(2, cy - radius),
      w: Math.min(width - 4, radius * 2 + 1),
      h: Math.min(height - 4, radius * 2 + 1),
    };
  });

  const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const aqueronte = zoneById.aqueronte;
  const arcadia = zoneById.arcadia;
  const delfos = zoneById.delfos;
  const egeo = zoneById.egeo;
  const tartaroGate = zoneById.tartaro_gate;

  // 1. Base de terreno natural: praderas, pasto variado, acantilados perimetrales y costas
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n1 = Math.sin(x * 0.28 + rng.next() * 0.01) + Math.cos(y * 0.24);
      const n2 = Math.sin((x + y) * 0.17);
      const elevNoise = Math.sin(x * 0.22) * Math.cos(y * 0.22) * 0.06;

      // Bordes exteriores: mar al sur-este, riscos montañosos al norte-oeste
      const isSeaEdge =
        (x >= width - 2 && y > height * 0.45) ||
        (y >= height - 2 && x > width * 0.38);

      if (x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2) {
        grid[y][x] = TILE_WALL;
        terrain[y][x] = isSeaEdge ? 'water' : 'cliff';
        elevation[y][x] = isSeaEdge ? -0.22 : 0.65;
        continue;
      }

      // Asignar zona geográfica más cercana dentro de radio
      let assigned = null;
      let bestDist = Infinity;
      for (const z of zones) {
        const d = Math.hypot(x - z.cx, y - z.cy);
        if (d <= z.radius + 1.5 && d < bestDist) {
          bestDist = d;
          assigned = z.id;
        }
      }
      if (assigned) zoneGrid[y][x] = assigned;

      // Terreno base por zona o campiña
      if (assigned === 'arcadia') {
        terrain[y][x] = n1 + n2 > -0.2 ? 'meadow' : 'grass';
        elevation[y][x] = elevNoise + 0.04;
      } else if (assigned === 'delfos') {
        const distD = Math.hypot(x - delfos.cx, y - delfos.cy);
        if (distD <= Math.max(2.6, delfos.radius * 0.68)) {
          terrain[y][x] = 'marble';
          elevation[y][x] = 0.12;
        } else {
          terrain[y][x] = 'grass';
          elevation[y][x] = 0.05;
        }
      } else if (assigned === 'egeo') {
        terrain[y][x] = 'sand';
        elevation[y][x] = -0.04;
      } else if (assigned === 'tartaro_gate') {
        const distT = Math.hypot(x - tartaroGate.cx, y - tartaroGate.cy);
        terrain[y][x] = distT <= Math.max(2.6, tartaroGate.radius * 0.68) ? 'rock' : 'dirt';
        elevation[y][x] = 0.1 + elevNoise * 0.5;
      } else if (assigned === 'aqueronte') {
        terrain[y][x] = Math.hypot(x - aqueronte.cx, y - aqueronte.cy) <= 3.2 ? 'dirt' : 'grass';
        elevation[y][x] = 0.01 + elevNoise * 0.3;
      } else {
        terrain[y][x] = n1 > 0.35 ? 'meadow' : 'grass';
        elevation[y][x] = elevNoise;
      }
    }
  }

  // 2. Río Aqueronte sinuoso de norte a sur + Bahía del Mar Egeo en el sureste
  const riverCenterXAt = (y) =>
    Math.round(width * 0.38 + Math.sin(y * 0.19) * (width * 0.075) + Math.cos(y * 0.09) * (width * 0.03));

  for (let y = 2; y < height - 2; y++) {
    const rcx = riverCenterXAt(y);
    for (let x = rcx - 3; x <= rcx + 3; x++) {
      if (x <= 1 || x >= width - 2) continue;
      const dist = Math.abs(x - rcx);
      if (dist <= 1) {
        terrain[y][x] = 'water';
        grid[y][x] = TILE_WALL; // Cauce profundo no caminable (salvo puentes)
        elevation[y][x] = -0.22;
      } else if (dist === 2) {
        // Orillas arenosas o vados poco profundos
        terrain[y][x] = (x + y) % 3 === 0 ? 'shallow_water' : 'sand';
        grid[y][x] = TILE_FLOOR;
        elevation[y][x] = terrain[y][x] === 'shallow_water' ? -0.1 : -0.04;
      }
    }
  }

  // Bahía del Mar Egeo en la esquina sureste
  for (let y = Math.floor(height * 0.62); y < height - 2; y++) {
    for (let x = Math.floor(width * 0.56); x < width - 2; x++) {
      const seaWave = Math.sin(x * 0.25) * 1.4 + Math.cos(y * 0.25) * 1.4;
      const coastDist =
        (x - width * 0.72) / (width * 0.28) + (y - height * 0.72) / (height * 0.28) + seaWave * 0.05;
      if (coastDist > 0.55) {
        terrain[y][x] = 'water';
        grid[y][x] = TILE_WALL;
        elevation[y][x] = -0.22;
        zoneGrid[y][x] = 'egeo';
      } else if (coastDist > 0.25) {
        terrain[y][x] = 'shallow_water';
        grid[y][x] = TILE_FLOOR;
        elevation[y][x] = -0.1;
        zoneGrid[y][x] = 'egeo';
      } else if (coastDist > -0.15) {
        terrain[y][x] = 'sand';
        grid[y][x] = TILE_FLOOR;
        elevation[y][x] = -0.03;
        zoneGrid[y][x] = 'egeo';
      }
    }
  }

  // 3. Dos Puentes griegos sobre el Río Aqueronte
  const bridgeYs = [Math.round(height * 0.48), Math.round(height * 0.25)];
  for (const by of bridgeYs) {
    const rcx = riverCenterXAt(by);
    for (let dy = -1; dy <= 1; dy++) {
      const py = by + dy;
      if (py <= 1 || py >= height - 2) continue;
      for (let px = rcx - 3; px <= rcx + 3; px++) {
        if (px <= 1 || px >= width - 2) continue;
        grid[py][px] = TILE_FLOOR;
        if (terrain[py][px] === 'water' || terrain[py][px] === 'shallow_water' || Math.abs(px - rcx) <= 2) {
          terrain[py][px] = 'bridge';
          elevation[py][px] = 0.04;
        }
      }
    }
  }

  // 4. Senderos de tierra batida conectando todas las regiones y el Santuario de Delfos
  const paintRoad = (x1, y1, x2, y2) => {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const swayX = Math.round(Math.sin(t * Math.PI * 2) * 1.4);
      const swayY = Math.round(Math.cos(t * Math.PI * 2) * 1.1);
      const rx = Math.round(x1 + (x2 - x1) * t) + swayX;
      const ry = Math.round(y1 + (y2 - y1) * t) + swayY;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const px = rx + ox;
          const py = ry + oy;
          if (px <= 2 || px >= width - 3 || py <= 2 || py >= height - 3) continue;
          const cur = terrain[py][px];
          if (cur === 'water' || cur === 'bridge' || cur === 'marble') continue;
          grid[py][px] = TILE_FLOOR;
          terrain[py][px] = 'dirt';
          elevation[py][px] = Math.max(0, elevation[py][px]);
        }
      }
    }
  };

  const b1x = riverCenterXAt(bridgeYs[0]);
  const b2x = riverCenterXAt(bridgeYs[1]);
  paintRoad(aqueronte.cx, aqueronte.cy, b1x - 3, bridgeYs[0]);
  paintRoad(b1x + 3, bridgeYs[0], delfos.cx, delfos.cy);
  paintRoad(aqueronte.cx, aqueronte.cy, arcadia.cx, arcadia.cy);
  paintRoad(arcadia.cx, arcadia.cy, b2x - 3, bridgeYs[1]);
  paintRoad(b2x + 3, bridgeYs[1], tartaroGate.cx, tartaroGate.cy);
  paintRoad(delfos.cx, delfos.cy, tartaroGate.cx, tartaroGate.cy);
  // Camino costero hacia playa Egeo (borde seguro de arena)
  const beachChestX = Math.max(Math.floor(width * 0.56), Math.min(width - 6, egeo.cx - 3));
  const beachChestY = Math.max(Math.floor(height * 0.52), Math.min(height - 6, egeo.cy - 4));
  paintRoad(delfos.cx, delfos.cy, beachChestX, beachChestY);

  // 5. Garantizar zonas despejadas para Spawn, Sibila, Altar de Delfos, Cofres y Entrada al Tártaro
  const clearZoneCenter = (zx, zy, r = 2, tileType = 'dirt') => {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        const px = zx + ox;
        const py = zy + oy;
        if (px <= 1 || px >= width - 2 || py <= 1 || py >= height - 2) continue;
        grid[py][px] = TILE_FLOOR;
        if (terrain[py][px] === 'water' || terrain[py][px] === 'cliff') {
          terrain[py][px] = tileType;
          elevation[py][px] = tileType === 'marble' ? 0.12 : 0.02;
        }
      }
    }
  };

  clearZoneCenter(aqueronte.cx, aqueronte.cy, 3, 'dirt');
  clearZoneCenter(arcadia.cx, arcadia.cy, 2, 'meadow');
  clearZoneCenter(delfos.cx, delfos.cy, 3, 'marble');
  clearZoneCenter(beachChestX, beachChestY, 2, 'sand');
  clearZoneCenter(tartaroGate.cx, tartaroGate.cy, 3, 'rock');

  // Colocar Altar de Asclepio en Delfos y Entrada al Tártaro en el Noreste
  grid[delfos.cy][delfos.cx] = TILE_SHRINE;
  const shrine = { x: delfos.cx, y: delfos.cy, used: false };

  grid[tartaroGate.cy][tartaroGate.cx] = TILE_STAIRS;
  const stairs = { x: tartaroGate.cx, y: tartaroGate.cy };

  const npc = {
    name: 'Sibila de Cumas',
    x: aqueronte.cx + 1.5,
    y: aqueronte.cy - 0.5,
    talked: false,
  };

  const spawn = { x: aqueronte.cx + 0.5, y: aqueronte.cy + 0.5 };

  // Cofres antiguos en Arcadia y Costa del Egeo
  const chests = [
    { x: arcadia.cx + 0.5, y: arcadia.cy + 0.5, opened: false },
    { x: beachChestX + 0.5, y: beachChestY + 0.5, opened: false },
  ];

  // 5b. Fuente de la Gran Hada de Arcadia (Zelda OoT Great Fairy Fountain)
  const fairyFountains = [
    {
      id: 'fairy-arcadia',
      x: arcadia.cx - 2.5,
      y: arcadia.cy - 3.5,
      used: false,
      name: 'Fuente de la Gran Hada de Arcadia',
    },
  ];
  clearZoneCenter(Math.floor(arcadia.cx - 2.5), Math.floor(arcadia.cy - 3.5), 1, 'meadow');

  // Vasijas de cerámica (Zelda breakable pots) en el mundo exterior
  const pots = [
    { id: 'pot-ow-1', x: delfos.cx + 2.5, y: delfos.cy - 1.5, broken: false },
    { id: 'pot-ow-2', x: delfos.cx + 2.5, y: delfos.cy + 1.5, broken: false },
    { id: 'pot-ow-3', x: delfos.cx - 2.5, y: delfos.cy - 1.5, broken: false },
    { id: 'pot-ow-4', x: aqueronte.cx - 1.5, y: aqueronte.cy + 1.5, broken: false },
    { id: 'pot-ow-5', x: aqueronte.cx + 2.5, y: aqueronte.cy + 2.5, broken: false },
    { id: 'pot-ow-6', x: arcadia.cx + 1.5, y: arcadia.cy + 2.5, broken: false },
    { id: 'pot-ow-7', x: arcadia.cx - 1.5, y: arcadia.cy - 1.5, broken: false },
    { id: 'pot-ow-8', x: beachChestX + 1.5, y: beachChestY - 1.5, broken: false },
    { id: 'pot-ow-9', x: beachChestX - 1.5, y: beachChestY + 1.5, broken: false },
    { id: 'pot-ow-10', x: tartaroGate.cx - 2.5, y: tartaroGate.cy - 1.5, broken: false },
    { id: 'pot-ow-11', x: tartaroGate.cx - 2.5, y: tartaroGate.cy + 1.5, broken: false },
  ];

  // Maleza y arbustos cortables (Zelda choppable grass/bushes)
  const bushes = [
    { id: 'bush-ow-1', x: arcadia.cx - 1.5, y: arcadia.cy + 1.5, cut: false },
    { id: 'bush-ow-2', x: arcadia.cx + 2.0, y: arcadia.cy - 1.5, cut: false },
    { id: 'bush-ow-3', x: arcadia.cx - 3.0, y: arcadia.cy + 0.5, cut: false },
    { id: 'bush-ow-4', x: aqueronte.cx + 1.5, y: aqueronte.cy - 3.5, cut: false },
    { id: 'bush-ow-5', x: aqueronte.cx - 2.5, y: aqueronte.cy - 2.0, cut: false },
    { id: 'bush-ow-6', x: delfos.cx - 3.5, y: delfos.cy + 2.0, cut: false },
    { id: 'bush-ow-7', x: delfos.cx + 3.5, y: delfos.cy - 2.5, cut: false },
    { id: 'bush-ow-8', x: beachChestX + 2.5, y: beachChestY + 1.5, cut: false },
    { id: 'bush-ow-9', x: tartaroGate.cx + 2.0, y: tartaroGate.cy - 2.5, cut: false },
  ];

  // 6. Árboles espesos / rocas escenográficas con colisión ligera + Props vivos
  const sceneryProps = [];
  const keyPoints = [
    { x: aqueronte.cx, y: aqueronte.cy, r: 4.5 },
    { x: arcadia.cx, y: arcadia.cy, r: 3.5 },
    { x: delfos.cx, y: delfos.cy, r: 3.2 },
    { x: beachChestX, y: beachChestY, r: 3.2 },
    { x: tartaroGate.cx, y: tartaroGate.cy, r: 4.0 },
  ];

  // Columnas dóricas alrededor del Santuario de Delfos
  for (const [ox, oy] of [
    [-2, -2],
    [2, -2],
    [-2, 2],
    [2, 2],
  ]) {
    const px = delfos.cx + ox;
    const py = delfos.cy + oy;
    if (px > 2 && px < width - 3 && py > 2 && py < height - 3) {
      grid[py][px] = TILE_WALL;
      terrain[py][px] = 'marble';
      sceneryProps.push({ x: px + 0.5, y: py + 0.5, kind: 'column', scale: 1.05 });
    }
  }

  // Muelle del Aqueronte y barca cerca de la Sibila (en la orilla del río al este del campamento)
  const dockY = aqueronte.cy;
  const riverBankX = riverCenterXAt(dockY) - 2;
  if (riverBankX > 2 && riverBankX < width - 4) {
    sceneryProps.push({ x: riverBankX + 0.4, y: dockY + 0.5, kind: 'dock', scale: 1 });
    sceneryProps.push({ x: riverBankX + 1.25, y: dockY + 1.05, kind: 'boat', scale: 1 });
  }

  // Árboles, flores, rocas y juncos por el paisaje
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const t = terrain[y][x];
      const nearKey = keyPoints.some((kp) => Math.hypot(x - kp.x, y - kp.y) <= kp.r);

      if (t === 'cliff') {
        if (rng.chance(0.55)) {
          sceneryProps.push({ x: x + 0.5, y: y + 0.5, kind: 'boulder', scale: 0.9 + rng.next() * 0.5 });
        }
        continue;
      }

      if (t === 'shallow_water' && rng.chance(0.28)) {
        sceneryProps.push({
          x: x + 0.25 + rng.next() * 0.5,
          y: y + 0.25 + rng.next() * 0.5,
          kind: 'reed',
          scale: 0.8 + rng.next() * 0.4,
        });
      }

      if (grid[y][x] !== TILE_FLOOR || nearKey) continue;

      if (t === 'meadow') {
        if (rng.chance(0.18)) {
          sceneryProps.push({
            x: x + 0.2 + rng.next() * 0.6,
            y: y + 0.2 + rng.next() * 0.6,
            kind: 'flower',
            scale: 0.85 + rng.next() * 0.35,
          });
        } else if (rng.chance(0.085)) {
          // Árboles sólidos formando arboledas de Arcadia sin tapar caminos
          grid[y][x] = TILE_WALL;
          terrain[y][x] = 'forest';
          sceneryProps.push({
            x: x + 0.5,
            y: y + 0.5,
            kind: rng.chance(0.55) ? 'olive' : 'cypress',
            scale: 0.9 + rng.next() * 0.45,
          });
        }
      } else if (t === 'grass') {
        if (rng.chance(0.065)) {
          grid[y][x] = TILE_WALL;
          terrain[y][x] = rng.chance(0.25) ? 'cliff' : 'forest';
          sceneryProps.push({
            x: x + 0.5,
            y: y + 0.5,
            kind: terrain[y][x] === 'cliff' ? 'boulder' : rng.chance(0.5) ? 'cypress' : 'olive',
            scale: 0.85 + rng.next() * 0.45,
          });
        } else if (rng.chance(0.08)) {
          sceneryProps.push({
            x: x + 0.2 + rng.next() * 0.6,
            y: y + 0.2 + rng.next() * 0.6,
            kind: 'flower',
            scale: 0.8 + rng.next() * 0.3,
          });
        }
      } else if (t === 'sand' && rng.chance(0.04)) {
        sceneryProps.push({
          x: x + 0.5,
          y: y + 0.5,
          kind: rng.chance(0.4) ? 'broken_column' : 'boulder',
          scale: 0.85 + rng.next() * 0.3,
        });
      } else if (t === 'rock' && rng.chance(0.07)) {
        grid[y][x] = TILE_WALL;
        terrain[y][x] = 'cliff';
        sceneryProps.push({
          x: x + 0.5,
          y: y + 0.5,
          kind: rng.chance(0.35) ? 'broken_column' : 'boulder',
          scale: 0.95 + rng.next() * 0.4,
        });
      }
    }
  }

  const abyssStairs = {
    id: 'foso-tartaro',
    x: aqueronte.cx + 3,
    y: aqueronte.cy - 3,
    targetFloor: -1,
    label: '▼ Foso del Tártaro (Piso -1 · Camino a Hades)',
    hint: 'Descender directamente al Tártaro (Piso -1)',
    isDeadEndBranch: false,
  };
  grid[abyssStairs.y][abyssStairs.x] = TILE_STAIRS;
  terrain[abyssStairs.y][abyssStairs.x] = 'rock';

  const secondaryStairs = {
    id: 'gruta-egeo',
    x: beachChestX + 2,
    y: beachChestY + 2,
    targetFloor: '1-cripta',
    label: '⚔ Gruta Prohibida del Egeo (Sin Salida)',
    hint: 'Entrar a la Cripta Secreta del Egeo (Sin bajada)',
    isDeadEndBranch: true,
  };
  grid[secondaryStairs.y][secondaryStairs.x] = TILE_STAIRS;
  terrain[secondaryStairs.y][secondaryStairs.x] = 'sand';

  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), stairs.x, stairs.y);
  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), abyssStairs.x, abyssStairs.y);
  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), secondaryStairs.x, secondaryStairs.y);
  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), shrine.x, shrine.y);
  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(fairyFountains[0].x), Math.floor(fairyFountains[0].y));
  for (const c of chests) {
    ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(c.x), Math.floor(c.y));
  }

  // Asegurar baldosas clave tras cualquier re-carving
  grid[shrine.y][shrine.x] = TILE_SHRINE;
  grid[stairs.y][stairs.x] = TILE_STAIRS;
  grid[abyssStairs.y][abyssStairs.x] = TILE_STAIRS;
  grid[secondaryStairs.y][secondaryStairs.x] = TILE_STAIRS;
  grid[Math.floor(spawn.y)][Math.floor(spawn.x)] = TILE_FLOOR;

  stairs.targetFloor = 2;
  stairs.label = '▼ Descenso al Inframundo (Piso 2)';
  stairs.hint = 'Descender al Piso 2';
  stairs.isDeadEndBranch = false;

  const stairsList = [
    stairs,
    abyssStairs,
    secondaryStairs,
  ];

  // 8. Spawns de enemigos temáticos por zona geográfica
  const enemySpawns = [];
  const tryAddEnemy = (gx, gy, kind, tier = 'normal') => {
    const tx = Math.max(2, Math.min(width - 3, Math.round(gx)));
    const ty = Math.max(2, Math.min(height - 3, Math.round(gy)));
    if (grid[ty][tx] === TILE_FLOOR) {
      enemySpawns.push({ x: tx + 0.5, y: ty + 0.5, kind, tier, level: 1 });
    }
  };

  // Camino norte hacia Arcadia (fuera del campamento seguro de la Sibila): Hoplitas Caídos
  tryAddEnemy(aqueronte.cx + 1, aqueronte.cy - 11, 'skeleton', 'normal');
  tryAddEnemy(aqueronte.cx - 2, aqueronte.cy - 13, 'skeleton', 'normal');

  // Bosques de Arcadia: Sátiros y Arpías custodiando el cofre del bosque
  tryAddEnemy(arcadia.cx + 2, arcadia.cy + 1, 'satyr', 'champion');
  tryAddEnemy(arcadia.cx - 2, arcadia.cy + 2, 'satyr', 'normal');
  tryAddEnemy(arcadia.cx + 3, arcadia.cy - 2, 'harpy', 'normal');

  // Costa del Mar Egeo: Arpías y Hoplitas costeros
  tryAddEnemy(beachChestX - 2, beachChestY - 1, 'harpy', 'champion');
  tryAddEnemy(beachChestX + 2, beachChestY - 2, 'skeleton', 'normal');

  // Santuario exterior y puente: Sátiros / Esqueletos
  tryAddEnemy(delfos.cx - 4, delfos.cy, 'skeleton', 'normal');
  tryAddEnemy(delfos.cx + 4, delfos.cy - 2, 'satyr', 'normal');

  // Fauces del Tártaro: Minotauro Guardián y escolta delante del portal al inframundo
  tryAddEnemy(tartaroGate.cx - 2, tartaroGate.cy + 2, 'minotaur', 'boss');
  tryAddEnemy(tartaroGate.cx - 3, tartaroGate.cy + 1, 'skeleton', 'normal');
  tryAddEnemy(tartaroGate.cx - 1, tartaroGate.cy + 3, 'harpy', 'normal');

  // 9. Fauna ambiental viva (mariposas en praderas, luciérnagas junto al río)
  const ambientCritters = [];
  for (let i = 0; i < 16; i++) {
    ambientCritters.push({
      kind: i % 3 === 0 ? 'firefly' : 'butterfly',
      x: i % 3 === 0 ? riverCenterXAt(height * 0.4 + i) - 1.5 : arcadia.cx + (rng.next() - 0.5) * 10,
      y: i % 3 === 0 ? Math.min(height - 4, aqueronte.cy - 2 + (rng.next() - 0.5) * 8) : arcadia.cy + (rng.next() - 0.5) * 10,
      color: i % 3 === 0 ? 0xfef08a : i % 2 === 0 ? 0xfbbf24 : 0x7dd3fc,
      phase: rng.next() * Math.PI * 2,
    });
  }

  return {
    width,
    height,
    level: 1,
    isOverworld: true,
    isFinalFloor: false,
    biome: OVERWORLD_BIOME,
    grid,
    terrain,
    elevation,
    zoneGrid,
    zones,
    sceneryProps,
    ambientCritters,
    explored,
    rooms: zones,
    spawn,
    npc,
    stairs,
    stairsList,
    stairsUp: null,
    shrine,
    chests,
    enemySpawns,
    pots,
    bushes,
    fairyFountains,
  };
}

/**
 * Genera el Mundo II (El Firmamento de los Titanes), un nuevo mundo celestial tras derrotar a Hades.
 */
export function generateNewWorld({ width = 48, height = 48, seed = 'arch-world2' } = {}) {
  const rng = createRng(`${seed}:newworld:2`);
  const grid = Array.from({ length: height }, () => Array(width).fill(TILE_FLOOR));
  const explored = Array.from({ length: height }, () => Array(width).fill(0));
  const terrain = Array.from({ length: height }, () => Array(width).fill('astral_grass'));
  const elevation = Array.from({ length: height }, () => Array(width).fill(0.1));
  const zoneGrid = Array.from({ length: height }, () => Array(width).fill('firmamento_wilds'));

  const zones = [
    {
      id: 'templo_astral',
      name: 'Santuario del Alba Primordial',
      subtitle: 'Explanada astral de los Titanes y campamento estelar',
      cx: Math.round(width * 0.22),
      cy: Math.round(height * 0.72),
      radius: 6,
      color: '#38bdf8',
    },
    {
      id: 'islas_firmamento',
      name: 'Meseta de Hiperbórea Flotante',
      subtitle: 'Islas de mármol suspendidas entre auroras cósmicas',
      cx: Math.round(width * 0.25),
      cy: Math.round(height * 0.25),
      radius: 6,
      color: '#c084fc',
    },
    {
      id: 'valle_cronos',
      name: 'Valle de los Titanes Durmientes',
      subtitle: 'Monolitos estelares y obeliscos de Cronos',
      cx: Math.round(width * 0.75),
      cy: Math.round(height * 0.28),
      radius: 6,
      color: '#facc15',
    },
    {
      id: 'portal_cosmos',
      name: 'Puerta de la Eternidad',
      subtitle: 'Vórtice infinito hacia las constelaciones primigenias',
      cx: Math.round(width * 0.76),
      cy: Math.round(height * 0.74),
      radius: 6,
      color: '#f43f5e',
    },
  ];

  // Riscos perimetrales cósmicos y asignación de zonas
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2) {
        grid[y][x] = TILE_WALL;
        terrain[y][x] = 'cliff';
        elevation[y][x] = 0.8;
        continue;
      }
      for (const z of zones) {
        if (Math.hypot(x - z.cx, y - z.cy) <= z.radius) {
          zoneGrid[y][x] = z.id;
          if (z.id === 'templo_astral') {
            terrain[y][x] = 'crystal_marble';
            elevation[y][x] = 0.15;
          } else if (z.id === 'islas_firmamento') {
            terrain[y][x] = 'astral_grass';
            elevation[y][x] = 0.2;
          } else if (z.id === 'valle_cronos') {
            terrain[y][x] = 'cosmic_rock';
            elevation[y][x] = 0.1;
          } else {
            terrain[y][x] = 'aether_dirt';
          }
        }
      }
    }
  }

  // Río de Starlight cósmico en el centro
  for (let y = 3; y < height - 3; y++) {
    const rx = Math.round(width * 0.5 + Math.sin(y * 0.25) * 4);
    for (let dx = -2; dx <= 2; dx++) {
      const px = rx + dx;
      if (px > 2 && px < width - 3) {
        if (Math.abs(dx) <= 1) {
          terrain[y][px] = 'starlight_water';
          grid[y][px] = TILE_WALL;
        } else {
          terrain[y][px] = 'crystal_marble';
          grid[y][px] = TILE_FLOOR;
        }
      }
    }
  }

  // Puentes cósmicos sobre el río de starlight
  const bridgeYs = [Math.round(height * 0.35), Math.round(height * 0.65)];
  for (const by of bridgeYs) {
    const rx = Math.round(width * 0.5 + Math.sin(by * 0.25) * 4);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const px = rx + dx;
        const py = by + dy;
        if (px > 1 && px < width - 2 && py > 1 && py < height - 2) {
          grid[py][px] = TILE_FLOOR;
          terrain[py][px] = 'bridge';
        }
      }
    }
  }

  const spawn = { x: zones[0].cx + 0.5, y: zones[0].cy + 0.5 };
  const stairs = { x: zones[3].cx, y: zones[3].cy };
  grid[stairs.y][stairs.x] = TILE_STAIRS;

  const secondaryStairs = {
    x: zones[1].cx,
    y: zones[1].cy,
    targetFloor: 'm2-cripta',
    label: '⚔ Cámara Astral de Cronos (Sin Salida)',
    hint: 'Entrar a la Bóveda de Cronos (Sin bajada)',
    isDeadEndBranch: true,
  };
  grid[secondaryStairs.y][secondaryStairs.x] = TILE_STAIRS;

  const stairsList = [
    {
      id: 'abismo-cosmos',
      x: stairs.x,
      y: stairs.y,
      targetFloor: 'abismo-cosmos',
      label: '▼ Puerta de la Eternidad',
      hint: 'Avanzar al Abismo Celestial',
      isDeadEndBranch: false,
    },
    secondaryStairs,
  ];

  const shrine = { x: zones[2].cx, y: zones[2].cy, used: false };
  grid[shrine.y][shrine.x] = TILE_SHRINE;

  const npc = {
    name: 'Sibila Cósmica del Alba',
    x: zones[0].cx + 1.5,
    y: zones[0].cy - 0.5,
    talked: false,
  };

  const chests = [
    { x: zones[1].cx + 2.5, y: zones[1].cy + 1.5, opened: false },
    { x: zones[2].cx - 2.5, y: zones[2].cy - 1.5, opened: false },
    { x: zones[3].cx - 2.5, y: zones[3].cy + 1.5, opened: false },
  ];

  const fairyFountains = [
    {
      id: 'fairy-astral',
      x: zones[1].cx - 2.5,
      y: zones[1].cy - 2.5,
      used: false,
      name: 'Gran Hada del Firmamento Cósmico',
    },
  ];

  const pots = [
    { id: 'pot-m2-1', x: zones[0].cx + 2.5, y: zones[0].cy + 1.5, broken: false },
    { id: 'pot-m2-2', x: zones[2].cx + 1.5, y: zones[2].cy - 2.5, broken: false },
  ];
  const bushes = [
    { id: 'bush-m2-1', x: zones[0].cx - 2.5, y: zones[0].cy - 1.5, cut: false },
    { id: 'bush-m2-2', x: zones[1].cx + 1.5, y: zones[1].cy + 2.5, cut: false },
  ];

  const enemySpawns = [
    { x: zones[1].cx + 1, y: zones[1].cy - 1, kind: 'satyr', tier: 'champion', level: 5 },
    { x: zones[1].cx - 1, y: zones[1].cy + 2, kind: 'harpy', tier: 'champion', level: 5 },
    { x: zones[2].cx + 2, y: zones[2].cy + 1, kind: 'skeleton', tier: 'champion', level: 6 },
    { x: zones[2].cx - 2, y: zones[2].cy - 1, kind: 'satyr', tier: 'champion', level: 6 },
    { x: zones[3].cx - 2, y: zones[3].cy - 2, kind: 'minotaur', tier: 'boss', level: 7 },
  ];

  const ambientCritters = [];
  for (let i = 0; i < 14; i++) {
    ambientCritters.push({
      kind: 'firefly',
      x: zones[0].cx + (rng.next() - 0.5) * 12,
      y: zones[0].cy + (rng.next() - 0.5) * 12,
      color: 0x38bdf8,
      phase: rng.next() * Math.PI * 2,
    });
  }

  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), stairs.x, stairs.y);
  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), secondaryStairs.x, secondaryStairs.y);
  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), shrine.x, shrine.y);
  for (const c of chests) {
    ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(c.x), Math.floor(c.y));
  }

  grid[stairs.y][stairs.x] = TILE_STAIRS;
  grid[secondaryStairs.y][secondaryStairs.x] = TILE_STAIRS;
  grid[shrine.y][shrine.x] = TILE_SHRINE;
  grid[Math.floor(spawn.y)][Math.floor(spawn.x)] = TILE_FLOOR;

  return {
    width,
    height,
    level: 'mundo-2',
    isOverworld: true,
    isNewWorld: true,
    isFinalFloor: false,
    biome: ASTRAL_BIOME,
    grid,
    terrain,
    elevation,
    zoneGrid,
    zones,
    sceneryProps: [],
    ambientCritters,
    explored,
    rooms: zones,
    spawn,
    npc,
    stairs,
    stairsList,
    stairsUp: null,
    shrine,
    chests,
    enemySpawns,
    pots,
    bushes,
    fairyFountains,
  };
}

/**
 * Genera una planta procedural conectada con geometrías ricas y variadas:
 *  - Grandes Plazas Abiertas (16x16 a 20x20 con columnas)
 *  - Salas circulares/rotundas y pasillos anchos
 *  - Múltiples bajadas en cada piso (algunas hacia pisos sin bajada)
 *  - Monstruo Final Hades en el Piso -3 (o 22) en el Trono del Tártaro
 */
export function generateDungeon({ width = 44, height = 44, level = 1, seed = 'arch-1', parentFloor = null, isDeadEnd: forceDeadEnd = false } = {}) {
  if (level === 1) {
    return generateOverworld({ width, height, seed });
  }
  if (level === 'mundo-2' || level === 'world2' || level === 100) {
    return generateNewWorld({ width, height, seed });
  }

  const isFinal = isFinalFloorLevel(level);
  const isDeadEnd = Boolean(
    forceDeadEnd ||
    (typeof level === 'string' &&
      (level.includes('cripta') || level.includes('fragua') || level.includes('boveda') || level.includes('dead')))
  );

  const numLv = typeof level === 'number' ? level : parseInt(level, 10);
  const absLevel = Math.max(1, Math.abs(Number.isFinite(numLv) ? numLv : (isFinal ? 3 : 2)));
  const rng = createRng(`${seed}:floor:${level}`);
  const grid = Array.from({ length: height }, () => Array(width).fill(TILE_WALL));
  const explored = Array.from({ length: height }, () => Array(width).fill(0));
  const rooms = [];

  // Variabilidad geométrica: Plazas abiertas, arenas de Hades, criptas de bóveda o salas circulares
  let layoutType = 'grand_plaza';
  if (isFinal) {
    layoutType = 'throne_arena';
  } else if (isDeadEnd) {
    layoutType = 'vault_crypt';
  } else {
    const archetypes = ['grand_plaza', 'circular_sanctum', 'organic_caverns', 'crossroad'];
    layoutType = archetypes[absLevel % archetypes.length];
  }

  if (layoutType === 'throne_arena') {
    // Piso -3: Colosal Trono de Hades (20x20 open arena con columnas de obsidiana y braseros)
    const throneW = 20;
    const throneH = 20;
    const tx = Math.floor((width - throneW) / 2);
    const ty = Math.floor((height - throneH) / 2);
    carveRect(grid, tx, ty, throneW, throneH, TILE_FLOOR);
    const throneRoom = {
      x: tx, y: ty, w: throneW, h: throneH, cx: Math.floor(tx + throneW / 2), cy: Math.floor(ty + throneH / 2), isThrone: true
    };

    // Columnas de obsidiana simétricas dentro del Trono de Hades
    for (const [colX, colY] of [
      [tx + 4, ty + 5], [tx + throneW - 5, ty + 5],
      [tx + 4, ty + throneH - 6], [tx + throneW - 5, ty + throneH - 6],
    ]) {
      grid[colY][colX] = TILE_WALL;
    }

    // Antecámara de entrada
    const enterW = 10;
    const enterH = 8;
    const ex = tx;
    const ey = Math.max(2, ty - enterH - 2);
    carveRect(grid, ex, ey, enterW, enterH, TILE_FLOOR);
    const enterRoom = {
      x: ex, y: ey, w: enterW, h: enterH, cx: Math.floor(ex + enterW / 2), cy: Math.floor(ey + enterH / 2)
    };
    carveCorridor(grid, enterRoom.cx, enterRoom.cy, throneRoom.cx, throneRoom.y, rng, 3);
    rooms.push(enterRoom, throneRoom);
  } else if (layoutType === 'vault_crypt') {
    // Piso sin bajada (Cripta / Bóveda cerrada): Gran cámara central de tesoro y cámaras de guardias
    const vaultSize = 14;
    const vx = Math.floor((width - vaultSize) / 2);
    const vy = Math.floor((height - vaultSize) / 2);
    carveRect(grid, vx, vy, vaultSize, vaultSize, TILE_FLOOR);
    const vaultRoom = {
      x: vx, y: vy, w: vaultSize, h: vaultSize, cx: Math.floor(vx + vaultSize / 2), cy: Math.floor(vy + vaultSize / 2), isVault: true
    };
    rooms.push(vaultRoom);

    // 3 cámaras satélite
    const offsets = [[-10, 0], [10, 0], [0, 10]];
    for (const [ox, oy] of offsets) {
      const cx = Math.max(3, Math.min(width - 9, vaultRoom.cx + ox - 4));
      const cy = Math.max(3, Math.min(height - 9, vaultRoom.cy + oy - 4));
      const rw = rng.int(7, 9);
      const rh = rng.int(7, 9);
      carveRect(grid, cx, cy, rw, rh, TILE_FLOOR);
      const r = { x: cx, y: cy, w: rw, h: rh, cx: Math.floor(cx + rw / 2), cy: Math.floor(cy + rh / 2) };
      carveCorridor(grid, vaultRoom.cx, vaultRoom.cy, r.cx, r.cy, rng, 3);
      rooms.push(r);
    }
  } else {
    // Geometría diversa: Plazas abiertas gigantes (16x16 a 18x18), salas circulares y amplios corredores
    const targetRooms = Math.min(10, 6 + (absLevel % 4));
    // 1. Sala monumental abierta (Gran Plaza de 16x16 a 18x18)
    const plazaW = rng.int(15, 18);
    const plazaH = rng.int(15, 18);
    const px = rng.int(3, Math.max(4, width - plazaW - 4));
    const py = rng.int(3, Math.max(4, height - plazaH - 4));
    carveRect(grid, px, py, plazaW, plazaH, TILE_FLOOR);
    // Columnas interiores en la plaza que dejan enormes pasillos de combate abiertos
    for (const [ox, oy] of [
      [px + 3, py + 3], [px + plazaW - 4, py + 3],
      [px + 3, py + plazaH - 4], [px + plazaW - 4, py + plazaH - 4],
    ]) {
      grid[oy][ox] = TILE_WALL;
    }
    const plazaRoom = {
      x: px, y: py, w: plazaW, h: plazaH, cx: Math.floor(px + plazaW / 2), cy: Math.floor(py + plazaH / 2), isPlaza: true
    };
    rooms.push(plazaRoom);

    // 2. Salas adicionales (circulares o rectangulares amplias)
    for (let attempt = 0; attempt < 160 && rooms.length < targetRooms; attempt++) {
      const isCircular = layoutType === 'circular_sanctum' && rng.chance(0.65);
      const rw = rng.int(7, 11);
      const rh = rng.int(7, 11);
      const rx = rng.int(2, Math.max(3, width - rw - 3));
      const ry = rng.int(2, Math.max(3, height - rh - 3));
      const candidate = {
        x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2)
      };
      if (!rooms.some((r) => roomsOverlap(r, candidate, 2))) {
        if (isCircular) {
          carveCircle(grid, candidate.cx, candidate.cy, Math.floor(Math.min(rw, rh) / 2));
        } else {
          carveRect(grid, candidate.x, candidate.y, candidate.w, candidate.h, TILE_FLOOR);
        }
        const prev = rooms[rooms.length - 1];
        carveCorridor(grid, prev.cx, prev.cy, candidate.cx, candidate.cy, rng, 3);
        rooms.push(candidate);
      }
    }
  }

  if (rooms.length === 0) {
    const fallback = { x: 4, y: 4, w: width - 8, h: height - 8, cx: Math.floor(width / 2), cy: Math.floor(height / 2) };
    carveRect(grid, fallback.x, fallback.y, fallback.w, fallback.h, TILE_FLOOR);
    rooms.push(fallback);
  }

  const startRoom = rooms[0];
  let exitRoom = rooms[rooms.length - 1];
  let bestDist = -1;
  for (const r of rooms) {
    const d = Math.hypot(r.cx - startRoom.cx, r.cy - startRoom.cy);
    if (d > bestDist) {
      bestDist = d;
      exitRoom = r;
    }
  }

  // Escalera de ascenso
  const stairsUp = {
    x: Math.max(startRoom.x, startRoom.cx - 2),
    y: startRoom.cy,
  };
  grid[stairsUp.y][stairsUp.x] = TILE_STAIRS_UP;

  let stairs = null;
  const stairsList = [];

  if (isDeadEnd) {
    // PISO SIN BAJADA (Cripta / Bóveda cerrada): no tiene escaleras hacia abajo
    stairs = null;
  } else {
    // PISO CON BAJADA
    grid[exitRoom.cy][exitRoom.cx] = TILE_STAIRS;
    let nextMainFloor;
    if (level === -1) nextMainFloor = -2;
    else if (level === -2) nextMainFloor = -3;
    else if (typeof level === 'number' && level > 0) nextMainFloor = level + 1;
    else nextMainFloor = -3;

    stairs = {
      x: exitRoom.cx,
      y: exitRoom.cy,
      targetFloor: nextMainFloor,
      label: nextMainFloor === -3 ? '▼ Tártaro (Piso -3 · Hades)' : `▼ Descenso (Piso ${nextMainFloor})`,
      hint: nextMainFloor === -3 ? 'Descender al Trono del Tártaro (Piso -3 · Monstruo Final)' : `Descender al Piso ${nextMainFloor}`,
      isDeadEndBranch: false,
    };
    stairsList.push(stairs);

    // Agregar SEGUNDA BAJADA hacia un piso que NO tiene bajada (Cripta/Bóveda sin salida)
    if (!isFinal && rooms.length >= 3) {
      const sideRoom = rooms.find((r) => r !== startRoom && r !== exitRoom) || rooms[1];
      const sideTarget = `${level}-cripta`;
      const sideX = Math.min(sideRoom.x + sideRoom.w - 2, Math.max(sideRoom.x + 1, sideRoom.cx + 2));
      const sideY = sideRoom.cy;
      grid[sideY][sideX] = TILE_STAIRS;
      const sideStairs = {
        x: sideX,
        y: sideY,
        targetFloor: sideTarget,
        label: '⚔ Cripta Oculta (Sin Salida)',
        hint: 'Entrar a Cripta Profunda (Piso sin bajada)',
        isDeadEndBranch: true,
      };
      stairsList.push(sideStairs);
    }
  }

  let shrine = null;
  if (rooms.length >= 3) {
    const midRoom = rooms[Math.floor(rooms.length / 2)];
    if (midRoom !== exitRoom) {
      grid[midRoom.cy][midRoom.cx] = TILE_SHRINE;
      shrine = { x: midRoom.cx, y: midRoom.cy, used: false };
    }
  }

  const enemySpawns = [];
  const chests = [];
  const archetypePool = ['skeleton', 'harpy', 'satyr'];

  for (let idx = 1; idx < rooms.length; idx++) {
    const r = rooms[idx];
    const isBossRoom = r === exitRoom;
    const count = isBossRoom ? (isFinal ? 4 : rng.int(3, 4)) : rng.int(2, 5 + Math.min(2, absLevel - 1));
    for (let i = 0; i < count; i++) {
      const ex = rng.int(r.x + 1, r.x + r.w - 2);
      const ey = rng.int(r.y + 1, r.y + r.h - 2);
      if (stairs && ex === stairs.x && ey === stairs.y && !isBossRoom) continue;

      if (isFinal && isBossRoom && i === 0) {
        // MONSTRUO FINAL HADES EN PISO -3 (o 22)
        const bx = ex === exitRoom.cx ? Math.max(r.x + 2, ex - 1) : ex;
        enemySpawns.push({
          x: bx + 0.5,
          y: ey + 0.5,
          kind: 'hades',
          tier: 'boss',
          isFinalBoss: true,
          level: absLevel,
        });
      } else if (isDeadEnd && r.isVault && i === 0) {
        // Jefe Guardián de la Cripta sin salida
        enemySpawns.push({
          x: ex + 0.5,
          y: ey + 0.5,
          kind: 'minotaur',
          tier: 'boss',
          level: absLevel + 1,
        });
      } else {
        const isBoss = isBossRoom && i === 0;
        const isChampion = !isBoss && rng.chance(Math.min(0.5, 0.22 + absLevel * 0.02));
        enemySpawns.push({
          x: ex + 0.5,
          y: ey + 0.5,
          kind: isBoss ? 'minotaur' : rng.pick(archetypePool),
          tier: isBoss ? 'boss' : isChampion ? 'champion' : 'normal',
          level: absLevel,
        });
      }
    }
    if (isDeadEnd || (!isBossRoom && rng.chance(0.45))) {
      chests.push({
        x: r.cx + 0.5,
        y: r.cy + 0.5,
        opened: false,
      });
    }
  }

  if (chests.length === 0 && rooms.length >= 2) {
    const chestRoom = rooms[1] !== exitRoom ? rooms[1] : rooms[0];
    chests.push({
      x: chestRoom.cx + 0.5,
      y: chestRoom.cy + 0.5,
      opened: false,
    });
  }
  if (isDeadEnd && chests.length < 2) {
    const vRoom = rooms.find((r) => r.isVault) || rooms[0];
    chests.push({
      x: vRoom.cx + 1.5,
      y: vRoom.cy - 1.5,
      opened: false,
    });
  }

  // Vasijas rompibles de cerámica y maleza en mazmorras
  const pots = [];
  const bushes = [];
  for (let idx = 0; idx < rooms.length; idx++) {
    const r = rooms[idx];
    if (r.w >= 4 && r.h >= 4) {
      pots.push({
        id: `pot-${level}-${idx}-1`,
        x: r.x + 1.5,
        y: r.y + 1.5,
        broken: false,
      });
      if (r.w >= 6 && rng.chance(0.65)) {
        pots.push({
          id: `pot-${level}-${idx}-2`,
          x: r.x + r.w - 1.5,
          y: r.y + 1.5,
          broken: false,
        });
      }
    }
    if (r !== exitRoom && r !== startRoom && rng.chance(0.45)) {
      bushes.push({
        id: `bush-${level}-${idx}`,
        x: r.cx + (rng.chance(0.5) ? 1.5 : -1.5),
        y: r.cy + (rng.chance(0.5) ? 1.5 : -1.5),
        cut: false,
      });
    }
  }

  const npc = {
    name: isFinal ? 'Oráculo de Perséfone' : isDeadEnd ? 'Alma de Hoplita Atrapado' : 'Sombra de Tiresias',
    x: Math.min(startRoom.x + startRoom.w - 1.5, startRoom.cx + 1.5),
    y: startRoom.cy + 0.5,
    talked: false,
  };

  let biome;
  if (isFinal) {
    biome = FINAL_BIOME;
  } else if (isDeadEnd) {
    biome = {
      ...BIOMES[3],
      name: 'Cripta Sepulcral de los Caídos (Sin Salida)',
      subtitle: 'Cámara mortuoria cerrada · Riquezas y guardianes de las sombras',
    };
  } else if (typeof level === 'number' && level < 0) {
    const idx = Math.min(BIOMES.length - 1, Math.max(0, Math.abs(level) - 1));
    biome = BIOMES[idx];
  } else if (typeof level === 'number' && level >= 2 && level <= FINAL_FLOOR) {
    biome = BIOMES[Math.min(BIOMES.length - 1, Math.floor((level - 2) / 4))];
  } else {
    const baseBiome = BIOMES[(absLevel - 2) % BIOMES.length];
    biome = { ...baseBiome, name: `${baseBiome.name} (Abismo)` };
  }

  // Fuentes de las Grandes Hadas en pisos clave (cada 5 pisos)
  const fairyFountains = [];
  if ((level % 5 === 0 || absLevel % 5 === 0) && rooms.length >= 3) {
    const fRoom = rooms[1] !== exitRoom ? rooms[1] : rooms[0];
    fairyFountains.push({
      id: `fairy-${level}`,
      x: fRoom.cx + 0.5,
      y: fRoom.cy + 0.5,
      used: false,
      name: `Gran Hada del ${biome.name}`,
    });
  }

  return {
    width,
    height,
    level,
    parentFloor,
    isOverworld: false,
    isFinalFloor: isFinal,
    isDeadEnd,
    biome,
    grid,
    explored,
    rooms,
    spawn: { x: startRoom.cx + 0.5, y: startRoom.cy + 0.5 },
    npc,
    stairs,
    stairsList,
    stairsUp,
    shrine,
    chests,
    enemySpawns,
    pots,
    bushes,
    fairyFountains,
  };
}

/** Devuelve la zona geográfica del mundo exterior en la coordenada dada (si existe). */
export function getZoneAt(dungeon, gx, gy) {
  if (!dungeon?.isOverworld || !dungeon.zoneGrid || !dungeon.zones) return null;
  const tx = Math.floor(gx);
  const ty = Math.floor(gy);
  const zid = dungeon.zoneGrid[ty]?.[tx];
  if (!zid || zid === 'helen_wilds') return null;
  return dungeon.zones.find((z) => z.id === zid) || null;
}

/** Verifica si una coordenada continua es caminable. */
export function isWalkable(dungeon, gx, gy) {
  const tx = Math.floor(gx);
  const ty = Math.floor(gy);
  if (ty < 0 || ty >= dungeon.height || tx < 0 || tx >= dungeon.width) return false;
  return dungeon.grid[ty][tx] !== TILE_WALL;
}

/** Calcula línea de visión con raycasting radial ligero y actualiza la niebla de guerra. */
export function updateVisibility(dungeon, originX, originY, radius = 8) {
  const { width, height, grid, explored, isOverworld, terrain } = dungeon;
  const effRadius = isOverworld ? Math.max(radius, 11) : radius;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (explored[y][x] === 2) explored[y][x] = 1;
    }
  }
  const rays = isOverworld ? 128 : 96;
  const step = 0.35;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const dx = Math.cos(angle) * step;
    const dy = Math.sin(angle) * step;
    let rx = originX;
    let ry = originY;
    for (let dist = 0; dist <= effRadius; dist += step) {
      const tx = Math.floor(rx);
      const ty = Math.floor(ry);
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) break;
      explored[ty][tx] = 2;
      if (grid[ty][tx] === TILE_WALL) {
        const t = terrain?.[ty]?.[tx];
        if (!isOverworld || (t !== 'water' && t !== 'shallow_water')) {
          break;
        }
      }
      rx += dx;
      ry += dy;
    }
  }
}
