/**
 * dungeon.js — Generador procedural de mazmorras griegas con conectividad garantizada.
 * Tipos de celda: 0 = muro, 1 = suelo, 2 = altar curativo, 3 = escalera descenso.
 */
import { createRng } from './rng.js';

export const TILE_WALL = 0;
export const TILE_FLOOR = 1;
export const TILE_SHRINE = 2;
export const TILE_STAIRS = 3;

export const BIOMES = [
  { id: 'styx', name: 'Umbral del Estigia', floor: '#1b2029', wall: '#313949', accent: '#60a5fa' },
  { id: 'creta', name: 'Laberinto de Creta', floor: '#26201b', wall: '#4b3d30', accent: '#f59e0b' },
  { id: 'hefesto', name: 'Forjas de Hefesto', floor: '#281a18', wall: '#522922', accent: '#f97316' },
  { id: 'tartaro', name: 'Abismo del Tártaro', floor: '#1a1625', wall: '#382b52', accent: '#c084fc' },
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

/**
 * Genera una planta procedural conectada con bioma, altar, cofres y spawns de enemigos.
 */
export function generateDungeon({ width = 44, height = 44, level = 1, seed = 'arch-1' } = {}) {
  const rng = createRng(`${seed}:floor:${level}`);
  const grid = Array.from({ length: height }, () => Array(width).fill(TILE_WALL));
  const explored = Array.from({ length: height }, () => Array(width).fill(0));
  const rooms = [];
  const targetRooms = Math.min(13, 7 + level);

  for (let attempt = 0; attempt < 160 && rooms.length < targetRooms; attempt++) {
    const rw = rng.int(5, 9);
    const rh = rng.int(5, 9);
    const rx = rng.int(2, width - rw - 3);
    const ry = rng.int(2, height - rh - 3);
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

  // Fallback si la grilla fuera muy pequeña
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
    const count = isBossRoom ? rng.int(2, 3) : rng.int(2, 4 + Math.min(2, level - 1));
    for (let i = 0; i < count; i++) {
      const ex = rng.int(r.x + 1, r.x + r.w - 2);
      const ey = rng.int(r.y + 1, r.y + r.h - 2);
      if (ex === exitRoom.cx && ey === exitRoom.cy) continue;
      const isBoss = isBossRoom && i === 0;
      const isChampion = !isBoss && rng.chance(0.18 + level * 0.03);
      enemySpawns.push({
        x: ex + 0.5,
        y: ey + 0.5,
        kind: isBoss ? 'minotaur' : rng.pick(archetypePool),
        tier: isBoss ? 'boss' : isChampion ? 'champion' : 'normal',
        level,
      });
    }
    if (!isBossRoom && rng.chance(0.45)) {
      chests.push({
        x: r.cx + 0.5,
        y: r.cy + 0.5,
        opened: false,
      });
    }
  }

  const biome = BIOMES[(level - 1) % BIOMES.length];

  return {
    width,
    height,
    level,
    biome,
    grid,
    explored,
    rooms,
    spawn: { x: startRoom.cx + 0.5, y: startRoom.cy + 0.5 },
    stairs: { x: exitRoom.cx, y: exitRoom.cy },
    shrine,
    chests,
    enemySpawns,
  };
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
  const { width, height, grid, explored } = dungeon;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (explored[y][x] === 2) explored[y][x] = 1;
    }
  }
  const rays = 96;
  const step = 0.35;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const dx = Math.cos(angle) * step;
    const dy = Math.sin(angle) * step;
    let rx = originX;
    let ry = originY;
    for (let dist = 0; dist <= radius; dist += step) {
      const tx = Math.floor(rx);
      const ty = Math.floor(ry);
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) break;
      explored[ty][tx] = 2;
      if (grid[ty][tx] === TILE_WALL) break;
      rx += dx;
      ry += dy;
    }
  }
}
