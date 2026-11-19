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

export const OVERWORLD_BIOME = {
  id: 'helade',
  name: 'Hélade · Tierra de los Mitos',
  floor: '#4a7c3a',
  wall: '#6b5e50',
  accent: '#38bdf8',
  isOverworld: true,
};

export const FINAL_BIOME = {
  id: 'trono_tartaro',
  name: 'Trono del Tártaro · Morada de Hades',
  floor: '#1f102c',
  wall: '#581c87',
  accent: '#f97316',
  isFinalFloor: true,
};

export const BIOMES = [
  { id: 'styx', name: 'Umbral del Estigia', floor: '#1b2029', wall: '#313949', accent: '#60a5fa' },
  { id: 'creta', name: 'Laberinto de Creta', floor: '#26201b', wall: '#4b3d30', accent: '#f59e0b' },
  { id: 'hefesto', name: 'Forjas de Hefesto', floor: '#281a18', wall: '#522922', accent: '#f97316' },
  { id: 'tartaro', name: 'Abismo del Tártaro', floor: '#1a1625', wall: '#382b52', accent: '#c084fc' },
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

function carveCorridor(grid, x1, y1, x2, y2, rng) {
  const horizFirst = rng.chance(0.5);
  const carveStep = (x, y) => {
    carveRect(grid, x, y, 2, 2, TILE_FLOOR);
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

  // 7. Re-validar conectividad 100% garantizada tras colocar árboles/columnas
  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), stairs.x, stairs.y);
  ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), shrine.x, shrine.y);
  for (const c of chests) {
    ensurePathConnected(grid, terrain, Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(c.x), Math.floor(c.y));
  }

  // Asegurar baldosas clave tras cualquier re-carving
  grid[shrine.y][shrine.x] = TILE_SHRINE;
  grid[stairs.y][stairs.x] = TILE_STAIRS;
  grid[Math.floor(spawn.y)][Math.floor(spawn.x)] = TILE_FLOOR;

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
    stairsUp: null,
    shrine,
    chests,
    enemySpawns,
  };
}

/**
 * Genera una planta procedural conectada:
 *  - Piso 1: Mundo exterior vivo sobre la tierra (Hélade) con pasto, agua, puentes y zonas míticas.
 *  - Pisos 2–21: Mazmorras del Inframundo a través de sus 4 estratos míticos.
 *  - Piso 22: Trono del Tártaro con el Monstruo Final (Hades, Soberano del Tártaro).
 *  - Pisos 23+: Modo Abismo Infinito si se ha vencido a Hades.
 */
export function generateDungeon({ width = 44, height = 44, level = 1, seed = 'arch-1' } = {}) {
  if (level === 1) {
    return generateOverworld({ width, height, seed });
  }

  const rng = createRng(`${seed}:floor:${level}`);
  const grid = Array.from({ length: height }, () => Array(width).fill(TILE_WALL));
  const explored = Array.from({ length: height }, () => Array(width).fill(0));
  const rooms = [];
  const targetRooms = level === FINAL_FLOOR ? 10 : Math.min(13, 7 + level);

  for (let attempt = 0; attempt < 180 && rooms.length < targetRooms; attempt++) {
    const rw = level === FINAL_FLOOR && rooms.length === targetRooms - 1 ? rng.int(8, 10) : rng.int(5, 9);
    const rh = level === FINAL_FLOOR && rooms.length === targetRooms - 1 ? rng.int(8, 10) : rng.int(5, 9);
    const rx = rng.int(2, Math.max(3, width - rw - 3));
    const ry = rng.int(2, Math.max(3, height - rh - 3));
    const candidate = {
      x: rx,
      y: ry,
      w: rw,
      h: rh,
      cx: Math.floor(rx + rw / 2),
      cy: Math.floor(ry + rh / 2),
    };
    if (!rooms.some((r) => roomsOverlap(r, candidate, 2))) {
      carveRect(grid, candidate.x, candidate.y, candidate.w, candidate.h, TILE_FLOOR);
      if (rooms.length > 0) {
        const prev = rooms[rooms.length - 1];
        carveCorridor(grid, prev.cx, prev.cy, candidate.cx, candidate.cy, rng);
      }
      rooms.push(candidate);
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

  grid[exitRoom.cy][exitRoom.cx] = TILE_STAIRS;
  const stairsUp = {
    x: Math.max(startRoom.x, startRoom.cx - 2),
    y: startRoom.cy,
  };
  grid[stairsUp.y][stairsUp.x] = TILE_STAIRS_UP;

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
    const count = isBossRoom ? (level === FINAL_FLOOR ? 3 : rng.int(2, 3)) : rng.int(2, 4 + Math.min(2, level - 1));
    for (let i = 0; i < count; i++) {
      const ex = rng.int(r.x + 1, r.x + r.w - 2);
      const ey = rng.int(r.y + 1, r.y + r.h - 2);
      if (ex === exitRoom.cx && ey === exitRoom.cy && !isBossRoom) continue;

      if (level === FINAL_FLOOR && isBossRoom && i === 0) {
        // Piso 22: Monstruo Final Hades en el Trono del Tártaro
        const bx = ex === exitRoom.cx ? Math.max(r.x + 1, ex - 1) : ex;
        enemySpawns.push({
          x: bx + 0.5,
          y: ey + 0.5,
          kind: 'hades',
          tier: 'boss',
          isFinalBoss: true,
          level,
        });
      } else {
        const isBoss = isBossRoom && i === 0;
        const isChampion = !isBoss && rng.chance(Math.min(0.45, 0.18 + level * 0.015));
        enemySpawns.push({
          x: ex + 0.5,
          y: ey + 0.5,
          kind: isBoss ? 'minotaur' : rng.pick(archetypePool),
          tier: isBoss ? 'boss' : isChampion ? 'champion' : 'normal',
          level,
        });
      }
    }
    if (!isBossRoom && rng.chance(0.45)) {
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

  const npc = {
    name: level === FINAL_FLOOR ? 'Oráculo de Perséfone' : 'Sombra de Tiresias',
    x: Math.min(startRoom.x + startRoom.w - 1.5, startRoom.cx + 1.5),
    y: startRoom.cy + 0.5,
    talked: false,
  };

  let biome;
  if (level === FINAL_FLOOR) {
    biome = FINAL_BIOME;
  } else if (level <= FINAL_FLOOR) {
    biome = BIOMES[Math.min(BIOMES.length - 1, Math.floor((level - 2) / 5))];
  } else {
    const baseBiome = BIOMES[(level - 2) % BIOMES.length];
    biome = { ...baseBiome, name: `${baseBiome.name} (Abismo)` };
  }

  return {
    width,
    height,
    level,
    isOverworld: false,
    isFinalFloor: level === FINAL_FLOOR,
    biome,
    grid,
    explored,
    rooms,
    spawn: { x: startRoom.cx + 0.5, y: startRoom.cy + 0.5 },
    npc,
    stairs: { x: exitRoom.cx, y: exitRoom.cy },
    stairsUp,
    shrine,
    chests,
    enemySpawns,
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
