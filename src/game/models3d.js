/**
 * models3d.js — Motor de Personajes y Escena 3D (Three.js / WebGL) para ARCH.
 *
 * Incluye:
 *  - Modelos 3D articulados procedurales (low-poly estilizado) para las 7 clases griegas,
 *    la Sibila de Cumas y los 4 arquetipos de enemigos (Esqueleto, Arpía, Sátiro, Minotauro).
 *  - Animaciones 3D en tiempo real: ciclo de marcha bípeda, respiración idle, aleteo,
 *    ataque con arma, habilidades especiales (Torbellino 360°, Égida, Licaón) y destello de impacto.
 *  - Escena isométrica 3D sincronizada al píxel con la proyección 2:1 (toIso) del motor lógico.
 *  - Pedestal 3D interactivo para la vista previa de selección de héroe en la Hoguera del Aqueronte.
 */
import * as THREE from 'three';
import { HERO_CLASSES } from '../core/combat.js';
import { TILE_SHRINE, TILE_STAIRS, TILE_STAIRS_UP, TILE_WALL } from '../core/dungeon.js';
import { getItemVisualType } from '../core/loot.js';

// Escala ortográfica exacta para coincidir al píxel con toIso(gx, gy) donde TILE_W=56, TILE_H=28
export const ISO_SCALE = 28 * Math.SQRT2; // 39.5979797...
const CAM_ELEV_Y = Math.sqrt(2 / 3); // tan(30°) * sqrt(2) => proyección isométrica 2:1 exacta

/** Utilidad para crear materiales estándar con acabado bronce/mármol/tela estilizado de alta fidelidad */
function mat(
  color,
  {
    metalness = 0.18,
    roughness = 0.65,
    emissive = 0x000000,
    emissiveIntensity = 0,
    transparent = false,
    opacity = 1,
    flatShading = false,
  } = {}
) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
    flatShading,
  });
}

function enableShadows(obj, cast = true, receive = true) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return obj;
}

export function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m?.dispose?.());
      } else if (child.material) {
        child.material?.dispose?.();
      }
    }
  });
}

/**
 * Crea el modelo 3D estilizado y reconocible de un ítem según su arquetipo visual y rareza.
 */
export function createItemVisualMesh3D(visualType, rarity = 'common', rarityColor = 0xd6d3d1, rarityEmissive = 0x292524, rarityIntensity = 0.2) {
  const root = new THREE.Group();
  root.name = `itemVisual-${visualType}-${rarity}`;

  const bronzeMat = mat(0xd99b43, { roughness: 0.32, metalness: 0.78 });
  const goldMat = mat(0xfacc15, { roughness: 0.22, metalness: 0.9, emissive: 0x854d0e, emissiveIntensity: 0.35 });
  const leatherMat = mat(0x5c3a21, { roughness: 0.8, metalness: 0.1 });
  const steelMat = mat(0xe2e8f0, { roughness: 0.2, metalness: 0.85 });
  const woodMat = mat(0x78350f, { roughness: 0.75, metalness: 0.15 });

  const bladeMat = mat(rarity === 'common' ? 0xe2e8f0 : rarityColor, {
    metalness: 0.85,
    roughness: 0.2,
    emissive: rarity === 'common' ? 0x000000 : rarityEmissive,
    emissiveIntensity: rarityIntensity,
  });

  if (visualType === 'sword') {
    // Espada Xiphos griega de doble filo
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 6), leatherMat);
    hilt.position.y = -0.06;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), bronzeMat);
    pommel.position.y = -0.13;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.036), bronzeMat);
    guard.position.y = 0.01;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.44, 0.016), bladeMat);
    blade.position.y = 0.24;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.09, 4), bladeMat);
    tip.position.y = 0.5;
    root.add(hilt, pommel, guard, blade, tip);
    root.rotation.z = -0.45;

  } else if (visualType === 'spear') {
    // Lanza Dory con punta de hoja y regatón de bronce
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.92, 6), woodMat);
    const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 6), bladeMat);
    spearTip.position.y = 0.55;
    const butt = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.09, 6), bronzeMat);
    butt.position.y = -0.5;
    butt.rotation.x = Math.PI;
    root.add(shaft, spearTip, butt);
    root.rotation.z = -0.55;

  } else if (visualType === 'bow') {
    // Arco recurvo griego y flecha emplumada
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.02, 6, 16, Math.PI * 1.15),
      mat(rarityColor, { metalness: 0.6, roughness: 0.3, emissive: rarityEmissive, emissiveIntensity: rarityIntensity * 0.5 })
    );
    arc.rotation.z = -Math.PI * 0.57;
    arc.rotation.y = Math.PI / 2;
    const bowString = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.48, 4), steelMat);
    bowString.position.z = -0.035;
    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.44, 5), bladeMat);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(0, 0, 0.02);
    root.add(arc, bowString, arrow);
    root.rotation.x = 0.35;
    root.rotation.y = 0.4;

  } else if (visualType === 'staff') {
    // Báculo sagrado coronado con anillo dorado y gema mística flotante
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.86, 6), woodMat);
    pole.position.y = 0.08;
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 6, 14), goldMat);
    crown.position.y = 0.55;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.062, 0), bladeMat);
    gem.position.y = 0.55;
    root.add(pole, crown, gem);
    root.rotation.z = -0.28;

  } else if (visualType === 'katar') {
    // Daga de empuje / Katar con hojas gemelas
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.09), bronzeMat);
    const b1 = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.3, 4), bladeMat);
    b1.rotation.x = Math.PI / 2;
    b1.position.set(-0.022, 0, 0.16);
    const b2 = b1.clone();
    b2.position.x = 0.022;
    root.add(grip, b1, b2);
    root.rotation.x = 0.3;

  } else if (visualType === 'orb') {
    // Orbe oracular flotante con anillo orbital
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 6, 16), goldMat);
    ring.rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), bladeMat);
    root.add(ring, core);

  } else if (visualType === 'cuirass') {
    // Coraza / Peto anatómico griego con faldoncillo de pteruges
    const chestMat = mat(rarity === 'common' ? 0xd99b43 : rarityColor, {
      metalness: 0.85,
      roughness: 0.25,
      emissive: rarity === 'common' ? 0x000000 : rarityEmissive,
      emissiveIntensity: rarityIntensity * 0.45,
    });
    const breastplate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.14), chestMat);
    breastplate.position.y = 0.12;
    // Músculos pectorales esculpidos
    for (const sx of [-0.05, 0.05]) {
      const pec = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), chestMat);
      pec.scale.set(1, 0.8, 0.5);
      pec.position.set(sx, 0.16, 0.07);
      root.add(pec);
    }
    // Tiras de cuero colgantes (pteruges)
    for (let i = -2; i <= 2; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.09, 0.012), leatherMat);
      strip.position.set(i * 0.045, -0.06, 0.06);
      root.add(strip);
    }
    root.add(breastplate);
    root.rotation.y = 0.35;

  } else if (visualType === 'chlamys') {
    // Clámide / Manto griego plegado con broche de oro
    const clothMat = mat(rarity === 'common' ? 0x7c2d12 : rarityColor, {
      roughness: 0.75,
      metalness: 0.2,
      emissive: rarity === 'common' ? 0x000000 : rarityEmissive,
      emissiveIntensity: rarityIntensity * 0.35,
    });
    const fold = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.18), clothMat);
    fold.position.y = 0.08;
    const brooch = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.012, 6, 12), goldMat);
    brooch.rotation.x = Math.PI / 2;
    brooch.position.set(0.06, 0.15, 0.08);
    root.add(fold, brooch);
    root.rotation.y = 0.4;

  } else if (visualType === 'pelt') {
    // Piel de lobo / bestia sagrada
    const fur = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.2), leatherMat);
    fur.position.y = 0.08;
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.13, 6), leatherMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.1, 0.13);
    root.add(fur, snout);
    root.rotation.y = 0.35;

  } else if (visualType === 'shield') {
    // Gran Escudo Aspis Espartano
    const shieldRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.035, 16), goldMat);
    shieldRim.rotation.x = Math.PI / 2 - 0.35;
    const shieldCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.042, 16),
      mat(rarityColor, { roughness: 0.35, metalness: 0.75, emissive: rarityEmissive, emissiveIntensity: rarityIntensity * 0.5 })
    );
    shieldCore.rotation.x = Math.PI / 2 - 0.35;
    const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.062, 0), goldMat);
    boss.position.set(0, 0.05, 0.02);
    root.add(shieldRim, shieldCore, boss);

  } else if (visualType === 'helm') {
    // Yelmo Corintio con cresta griega (lophos)
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.14, 0.2, 10), bronzeMat);
    dome.position.y = 0.08;
    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.14, 0.3),
      mat(rarityColor, { roughness: 0.55, emissive: rarityEmissive, emissiveIntensity: rarityIntensity * 0.6 })
    );
    crest.position.set(0, 0.24, 0);
    root.add(dome, crest);
    root.rotation.y = 0.45;

  } else if (visualType === 'sandals') {
    // Grebas / Sandalias con alas de Hermes
    for (const sx of [-0.07, 0.07]) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.14), leatherMat);
      boot.position.set(sx, 0.02, 0);
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 4), goldMat);
      wing.rotation.x = -Math.PI / 3;
      wing.position.set(sx + (sx > 0 ? 0.04 : -0.04), 0.06, -0.05);
      root.add(boot, wing);
    }

  } else if (visualType === 'mask') {
    // Máscara sagrada de Licaón
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.16), leatherMat);
    mask.position.y = 0.07;
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 6), leatherMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.08, 0.1);
    const horns = [1, -1].map((side) => {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), goldMat);
      h.position.set(side * 0.1, 0.16, 0);
      h.rotation.z = -side * 0.5;
      return h;
    });
    root.add(mask, snout, ...horns);

  } else {
    // Amulet / Relic / Óbolo del Estigia
    const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.024, 16), goldMat);
    medal.rotation.x = Math.PI / 2 - 0.3;
    const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), bladeMat);
    rune.position.set(0, 0.03, 0.02);
    root.add(medal, rune);
  }

  return root;
}

/**
 * Construye el objeto 3D realista que se muestra en el suelo cuando un enemigo suelta botín.
 * Sustituye los pequeños paralelepípedos genéricos por modelos 3D con forma, textura,
 * haz vertical de luz según rareza y rotación suave.
 */
export function createGroundDropMesh3D(drop) {
  const root = new THREE.Group();
  root.name = `groundDrop-${drop.kind}-${drop.item?.id || Math.random().toString(36).slice(2, 6)}`;

  // Disco de sombra difusa en el suelo
  const shadowMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 16),
    new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.45 })
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.01;
  root.add(shadowMesh);

  // Grupo flotante articulado que oscila y gira
  const bobGroup = new THREE.Group();
  bobGroup.name = 'bobGroup';
  root.add(bobGroup);

  if (drop.kind === 'gold') {
    // Pila de dracmas de oro griegas relucientes con destello estelar
    const goldMat = mat(0xfacc15, { metalness: 0.92, roughness: 0.15, emissive: 0x854d0e, emissiveIntensity: 0.4 });
    const coinGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.018, 12);
    const coinOffsets = [
      { x: 0, y: 0.012, z: 0, rx: 0, rz: 0 },
      { x: 0.055, y: 0.014, z: 0.03, rx: 0.08, rz: 0.12 },
      { x: -0.05, y: 0.016, z: -0.04, rx: -0.1, rz: 0.06 },
      { x: 0.025, y: 0.028, z: -0.02, rx: 0.05, rz: -0.15 },
      { x: -0.03, y: 0.03, z: 0.035, rx: -0.08, rz: 0.1 },
      { x: 0.01, y: 0.045, z: 0.01, rx: 0.04, rz: 0.03 },
    ];
    for (const c of coinOffsets) {
      const coin = new THREE.Mesh(coinGeo, goldMat);
      coin.position.set(c.x, c.y, c.z);
      coin.rotation.set(c.rx, 0, c.rz);
      bobGroup.add(coin);
    }
    // Destello de brillo dorado
    const glint = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.038, 0),
      mat(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 1.2 })
    );
    glint.position.set(0, 0.1, 0);
    bobGroup.add(glint);

    // Halo dorado en el suelo
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.28, 16),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.02;
    root.add(halo);

  } else if (drop.kind === 'potion') {
    // Frasco griego de Ambrosía con líquido carmesí brillante y tapón de corcho
    const bottle = new THREE.Group();
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.092, 12, 10),
      mat(0xffffff, { transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1 })
    );
    bulb.scale.set(1, 1.22, 1);
    bulb.position.y = 0.11;

    const liquid = new THREE.Mesh(
      new THREE.SphereGeometry(0.076, 10, 8),
      mat(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 1.0, roughness: 0.2 })
    );
    liquid.scale.set(1, 1.15, 1);
    liquid.position.y = 0.1;

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.037, 0.08, 10),
      mat(0xffffff, { transparent: true, opacity: 0.5, roughness: 0.1 })
    );
    neck.position.y = 0.215;

    const cork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.028, 0.045, 8),
      mat(0x78350f, { roughness: 0.85 })
    );
    cork.position.y = 0.265;

    bottle.add(bulb, liquid, neck, cork);
    bottle.rotation.z = 0.18;
    bobGroup.add(bottle);

    // Halo carmesí
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.28, 16),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.02;
    root.add(halo);

  } else {
    // drop.kind === 'item'
    const item = drop.item || {};
    const visualType = getItemVisualType(item);
    const rarity = item.rarity || 'common';
    const rarityColor = rarity === 'unique' ? 0xf97316 : rarity === 'rare' ? 0xfacc15 : rarity === 'magic' ? 0x60a5fa : 0xd6d3d1;
    const rarityEmissive = rarity === 'unique' ? 0xea580c : rarity === 'rare' ? 0xa16207 : rarity === 'magic' ? 0x0284c7 : 0x292524;
    const rarityIntensity = rarity === 'unique' ? 1.0 : rarity === 'rare' ? 0.75 : rarity === 'magic' ? 0.55 : 0.15;

    // Haz / Columna vertical de luz de rareza
    const beamHeight = rarity === 'unique' ? 1.6 : rarity === 'rare' ? 1.3 : rarity === 'magic' ? 1.1 : 0.8;
    const beamOpacity = rarity === 'unique' ? 0.48 : rarity === 'rare' ? 0.38 : rarity === 'magic' ? 0.28 : 0.14;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.14, beamHeight, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: rarityColor,
        transparent: true,
        opacity: beamOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = beamHeight * 0.5;
    root.add(beam);

    // Anillo de rareza en el suelo
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.28, 20),
      new THREE.MeshBasicMaterial({
        color: rarityColor,
        transparent: true,
        opacity: Math.min(0.85, beamOpacity * 2.2),
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    root.add(ring);

    // Modelo 3D específico
    const itemModel = createItemVisualMesh3D(visualType, rarity, rarityColor, rarityEmissive, rarityIntensity);
    itemModel.position.y = 0.14;
    bobGroup.add(itemModel);
  }

  enableShadows(root, true, false);
  return root;
}

/**
 * Sincroniza visualmente las piezas de equipo activas en el modelo 3D del héroe:
 *  - Arma en mano derecha (espada, lanza, bastón, arco, katar) con efectos de rareza.
 *  - Escudo / flecha en mano izquierda.
 *  - Armadura (coraza, manto, piel) en el torso y hombreras (spaulders).
 *  - Reliquia / amuleto / yelmo / sandalias en cabeza, pies y auras.
 */
export function updateHeroEquipmentVisuals(heroMesh, equipment = {}, classId = 'hoplita') {
  if (!heroMesh?.userData?.rig) return;
  const rig = heroMesh.userData.rig;
  const effectiveClassId = classId || rig.classId || 'hoplita';

  const eq = equipment || {};
  const weapon = eq.weapon || null;
  const armor = eq.armor || null;
  const charm = eq.charm || null;

  const bronzeMat = mat(0xd99b43, { roughness: 0.3, metalness: 0.78 });
  const goldMat = mat(0xfacc15, { roughness: 0.25, metalness: 0.85, emissive: 0x422006, emissiveIntensity: 0.25 });
  const steelMat = mat(0xe2e8f0, { roughness: 0.22, metalness: 0.85 });
  const leatherMat = mat(0x5c3a21, { roughness: 0.8, metalness: 0.1 });
  const primaryMat = mat(HERO_CLASSES[effectiveClassId]?.color || 0xd99b43, { roughness: 0.45, metalness: 0.35 });

  // 1. Limpiar slots articulados
  if (rig.weaponSlot) {
    while (rig.weaponSlot.children.length > 0) {
      const c = rig.weaponSlot.children[0];
      rig.weaponSlot.remove(c);
      disposeObject3D(c);
    }
  }
  if (rig.offhandSlot) {
    while (rig.offhandSlot.children.length > 0) {
      const c = rig.offhandSlot.children[0];
      rig.offhandSlot.remove(c);
      disposeObject3D(c);
    }
  }
  if (rig.armorSlot) {
    while (rig.armorSlot.children.length > 0) {
      const c = rig.armorSlot.children[0];
      rig.armorSlot.remove(c);
      disposeObject3D(c);
    }
  }
  if (rig.headgearSlot) {
    while (rig.headgearSlot.children.length > 0) {
      const c = rig.headgearSlot.children[0];
      rig.headgearSlot.remove(c);
      disposeObject3D(c);
    }
  }
  if (rig.charmSlot) {
    while (rig.charmSlot.children.length > 0) {
      const c = rig.charmSlot.children[0];
      rig.charmSlot.remove(c);
      disposeObject3D(c);
    }
  }

  // 2. Arma y Offhand
  const weaponVisual = weapon ? getItemVisualType(weapon) : null;
  const weaponRarity = weapon?.rarity || 'common';
  const weaponColor = weaponRarity === 'unique' ? 0xf97316 : weaponRarity === 'rare' ? 0xfacc15 : weaponRarity === 'magic' ? 0x60a5fa : 0xd6d3d1;
  const weaponEmissive = weaponRarity === 'unique' ? 0xea580c : weaponRarity === 'rare' ? 0xa16207 : weaponRarity === 'magic' ? 0x0284c7 : 0x000000;
  const weaponIntensity = weaponRarity === 'unique' ? 1.0 : weaponRarity === 'rare' ? 0.75 : weaponRarity === 'magic' ? 0.55 : 0;
  const weaponBladeMat = mat(weaponRarity === 'common' ? 0xe2e8f0 : weaponColor, {
    metalness: 0.85,
    roughness: 0.22,
    emissive: weaponEmissive,
    emissiveIntensity: weaponIntensity,
  });

  const charmVisual = charm ? getItemVisualType(charm) : null;
  const isShieldEquipped = charmVisual === 'shield';
  const usesBow = weaponVisual === 'bow' || (!weapon && effectiveClassId === 'arquera');

  rig.isBowEquipped = usesBow;
  rig.leftArmPivot.rotation.set(0, 0, 0);
  rig.rightArmPivot.rotation.set(0, 0, 0);

  if (usesBow) {
    // Postura de tiro con arco: brazo de arco extendido al frente, brazo de cuerda recogido atrás, sin arma en weaponSlot
    rig.defaultLeftArmX = -1.46;
    rig.defaultRightArmX = -1.28;
    rig.leftArmPivot.rotation.set(-1.46, 0, 0.26);
    rig.rightArmPivot.rotation.set(-1.28, 0, -0.58);

    const bowRadius = 0.26;
    const bowDepthScale = 0.56;
    const bowDepth = bowRadius * bowDepthScale;

    const bowGroup = new THREE.Group();
    bowGroup.name = 'heroBowGroup';
    bowGroup.position.set(0, -0.24, 0);
    // Compensar rotación del brazo para mantener el arco vertical en posición de disparo (ligero canting natural)
    const invArmQ = new THREE.Quaternion().setFromEuler(rig.leftArmPivot.rotation).invert();
    const cantQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.12);
    bowGroup.quaternion.copy(invArmQ).multiply(cantQ);

    const arcWrap = new THREE.Group();
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(bowRadius, 0.022, 6, 16, Math.PI),
      mat(weapon ? weaponColor : 0x86efac, {
        metalness: 0.7,
        roughness: 0.22,
        emissive: weapon ? weaponEmissive : 0x14532d,
        emissiveIntensity: weapon ? weaponIntensity * 0.65 : 0.45,
      })
    );
    arc.rotation.z = -Math.PI / 2;
    arc.rotation.y = -Math.PI / 2;
    arcWrap.add(arc);
    arcWrap.scale.set(1, 1, bowDepthScale);
    arcWrap.position.z = -bowDepth;

    // Empuñadura centrada exactamente en el medio del semicírculo (en la mano)
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.075, 7), leatherMat);

    // Cuerda tensa entre ambos extremos del semicírculo
    const bowString = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, bowRadius * 2, 4), steelMat);
    bowString.position.z = -bowDepth;

    // Flecha apoyada horizontalmente en el arco (de la cuerda hacia adelante), nunca como espada en la otra mano
    const arrowGroup = new THREE.Group();
    arrowGroup.position.set(0.022, 0.015, 0);
    const arrowMat = mat(weapon ? weaponColor : 0xe2e8f0, {
      metalness: 0.55,
      roughness: 0.3,
      emissive: weapon ? weaponEmissive : 0x22c55e,
      emissiveIntensity: weapon ? weaponIntensity * 0.55 : 0.35,
    });
    const arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 5), arrowMat);
    arrowShaft.rotation.x = Math.PI / 2;
    arrowShaft.position.z = 0.025;
    const arrowTip = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.055, 4), steelMat);
    arrowTip.rotation.x = Math.PI / 2;
    arrowTip.position.z = 0.21;
    arrowGroup.add(arrowShaft, arrowTip);

    bowGroup.add(arcWrap, grip, bowString, arrowGroup);
    rig.offhandSlot.add(bowGroup);

  } else if (weaponVisual === 'spear' || (!weapon && effectiveClassId === 'hoplita')) {
    // Lanza Dory en la mano derecha
    const spear = new THREE.Group();
    spear.position.set(0.02, -0.22, 0.12);
    spear.rotation.x = Math.PI / 2 - 0.22;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.05, 6), leatherMat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 6), weapon ? weaponBladeMat : steelMat);
    tip.position.y = 0.58;
    const buttSpike = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.1, 6), bronzeMat);
    buttSpike.position.y = -0.55;
    buttSpike.rotation.x = Math.PI;
    spear.add(shaft, tip, buttSpike);
    rig.weaponSlot.add(spear);

    rig.defaultRightArmX = -0.45;
    rig.rightArmPivot.rotation.x = -0.45;

  } else if (weaponVisual === 'staff' || (!weapon && effectiveClassId === 'oraculo')) {
    // Bastón / Caduceo en la mano derecha
    const staff = new THREE.Group();
    staff.position.set(0, -0.2, 0.12);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.92, 6), goldMat);
    rod.position.y = 0.18;
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 6, 12), goldMat);
    crown.position.y = 0.68;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.065, 0),
      mat(weapon ? weaponColor : 0x38bdf8, { emissive: weapon ? weaponEmissive : 0x0284c7, emissiveIntensity: 1.1 })
    );
    gem.position.y = 0.68;
    staff.add(rod, crown, gem);
    rig.weaponSlot.add(staff);

    rig.defaultRightArmX = -0.35;
    rig.rightArmPivot.rotation.x = -0.35;

  } else if (weaponVisual === 'katar' || (!weapon && effectiveClassId === 'sombra')) {
    // Katar en mano derecha
    const katar = new THREE.Group();
    katar.position.set(0, -0.24, 0.12);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.1), bronzeMat);
    const blade1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.32, 4),
      weapon ? weaponBladeMat : mat(0xf472b6, { emissive: 0xdb2777, emissiveIntensity: 0.8, metalness: 0.8 })
    );
    blade1.rotation.x = Math.PI / 2;
    blade1.position.set(-0.022, 0, 0.18);
    const blade2 = blade1.clone();
    blade2.position.x = 0.022;
    katar.add(guard, blade1, blade2);
    rig.weaponSlot.add(katar);

    rig.defaultRightArmX = -0.55;
    rig.rightArmPivot.rotation.x = -0.55;

  } else if (!weapon && effectiveClassId === 'necromante') {
    // Guadaña ósea por defecto
    const scythe = new THREE.Group();
    scythe.position.set(0, -0.2, 0.12);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.96, 6), mat(0xe2e8f0, { roughness: 0.45 }));
    pole.position.y = 0.2;
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.36, 5),
      mat(0xc084fc, { emissive: 0x7e22ce, emissiveIntensity: 0.85, metalness: 0.6 })
    );
    blade.position.set(0, 0.64, 0.14);
    blade.rotation.x = Math.PI / 2 + 0.25;
    scythe.add(pole, blade);
    rig.weaponSlot.add(scythe);
    rig.defaultRightArmX = -0.35;
    rig.rightArmPivot.rotation.x = -0.35;

  } else if (!weapon && effectiveClassId === 'coribante') {
    // Mazo telúrico por defecto
    const maul = new THREE.Group();
    maul.position.set(0, -0.22, 0.12);
    maul.rotation.x = Math.PI / 2 - 0.35;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.78, 6), leatherMat);
    shaft.position.y = 0.18;
    const headStone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.14, 0),
      mat(0x84cc16, { roughness: 0.5, emissive: 0x365314, emissiveIntensity: 0.55 })
    );
    headStone.position.y = 0.52;
    maul.add(shaft, headStone);
    rig.weaponSlot.add(maul);
    rig.defaultRightArmX = -0.45;
    rig.rightArmPivot.rotation.x = -0.45;

  } else if (!weapon && effectiveClassId === 'campeon') {
    // Hacha de guerra derecha
    const axe = new THREE.Group();
    axe.position.set(0, -0.23, 0.1);
    axe.rotation.x = Math.PI / 2 - 0.3;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 6), leatherMat);
    handle.position.y = 0.12;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.26), steelMat);
    blade.position.set(0, 0.32, 0.04);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.14, 0.12), primaryMat);
    trim.position.set(0, 0.32, 0.0);
    axe.add(handle, blade, trim);
    rig.weaponSlot.add(axe);
    rig.defaultRightArmX = -0.55;
    rig.rightArmPivot.rotation.x = -0.55;

  } else {
    // Espada Xiphos en la mano derecha
    const sword = new THREE.Group();
    sword.position.set(0.01, -0.22, 0.12);
    sword.rotation.x = Math.PI / 2 - 0.22;
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 6), leatherMat);
    hilt.position.y = -0.06;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.024, 0.036), bronzeMat);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.46, 0.016), weaponBladeMat);
    blade.position.y = 0.23;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.09, 4), weaponBladeMat);
    tip.position.y = 0.5;
    sword.add(hilt, guard, blade, tip);
    rig.weaponSlot.add(sword);
    rig.defaultRightArmX = -0.4;
    rig.rightArmPivot.rotation.x = -0.4;
  }

  // 3. Offhand / Escudo / Segundo arma
  if (!usesBow) {
    if (isShieldEquipped || (!charm && effectiveClassId === 'hoplita')) {
      // Escudo Aspis en mano izquierda
      const charmRarity = charm?.rarity || 'common';
      const shieldColor = charmRarity === 'unique' ? 0xf97316 : charmRarity === 'rare' ? 0xfacc15 : charmRarity === 'magic' ? 0x60a5fa : primaryMat.color.getHex();
      const shieldGroup = new THREE.Group();
      shieldGroup.position.set(-0.06, -0.18, 0.12);
      const shieldRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.035, 16), goldMat);
      shieldRim.rotation.x = Math.PI / 2;
      shieldRim.rotation.z = 0.35;
      const shieldCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.042, 16),
        mat(shieldColor, { roughness: 0.35, metalness: 0.75 })
      );
      shieldCore.rotation.x = Math.PI / 2;
      shieldCore.rotation.z = 0.35;
      const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), goldMat);
      boss.position.z = 0.03;
      shieldGroup.add(shieldRim, shieldCore, boss);
      rig.offhandSlot.add(shieldGroup);
      rig.defaultLeftArmX = -0.45;
      rig.leftArmPivot.rotation.x = -0.45;

    } else if (!charm && effectiveClassId === 'campeon') {
      // Segunda hacha para el campeón
      const axe2 = new THREE.Group();
      axe2.position.set(0, -0.23, 0.1);
      axe2.rotation.x = Math.PI / 2 - 0.3;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 6), leatherMat);
      handle.position.y = 0.12;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.26), steelMat);
      blade.position.set(0, 0.32, 0.04);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.14, 0.12), primaryMat);
      trim.position.set(0, 0.32, 0.0);
      axe2.add(handle, blade, trim);
      rig.offhandSlot.add(axe2);
      rig.defaultLeftArmX = -0.35;
      rig.leftArmPivot.rotation.x = -0.35;

    } else if (!charm && effectiveClassId === 'oraculo') {
      // Orbe de Zeus en mano izquierda
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.065, 0),
        mat(0x7dd3fc, { emissive: 0x38bdf8, emissiveIntensity: 1.0 })
      );
      orb.position.set(0, -0.24, 0.14);
      rig.offhandSlot.add(orb);
      rig.defaultLeftArmX = -0.65;
      rig.leftArmPivot.rotation.x = -0.65;

    } else if (!charm && effectiveClassId === 'necromante') {
      // Linterna de Átropos en mano izquierda
      const lantern = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.07, 0),
        mat(0xa855f7, { emissive: 0x9333ea, emissiveIntensity: 1.1 })
      );
      lantern.position.set(0, -0.25, 0.12);
      rig.offhandSlot.add(lantern);
      rig.defaultLeftArmX = -0.6;
      rig.leftArmPivot.rotation.x = -0.6;

    } else if (weaponVisual === 'katar' || (!weapon && effectiveClassId === 'sombra')) {
      // Katar gemelo en mano izquierda
      const katar2 = new THREE.Group();
      katar2.position.set(0, -0.24, 0.12);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.1), bronzeMat);
      const b1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.025, 0.32, 4),
        weapon ? weaponBladeMat : mat(0xf472b6, { emissive: 0xdb2777, emissiveIntensity: 0.8, metalness: 0.8 })
      );
      b1.rotation.x = Math.PI / 2;
      b1.position.set(-0.022, 0, 0.18);
      const b2 = b1.clone();
      b2.position.x = 0.022;
      katar2.add(guard, b1, b2);
      rig.offhandSlot.add(katar2);
      rig.defaultLeftArmX = -0.55;
      rig.leftArmPivot.rotation.x = -0.55;
    } else {
      rig.defaultLeftArmX = -0.2;
      rig.leftArmPivot.rotation.x = -0.2;
    }
  }

  // 4. Reliquia / Encanto (Charm) no-escudo
  if (charm && !isShieldEquipped) {
    if (charmVisual === 'helm') {
      const helmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.142, 0.22, 10), goldMat);
      helmMesh.position.y = 0.12;
      const crest = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.15, 0.32),
        mat(0xdc2626, { roughness: 0.6, emissive: 0x7f1d1d, emissiveIntensity: 0.4 })
      );
      crest.position.set(0, 0.3, -0.02);
      rig.headgearSlot.add(helmMesh, crest);

    } else if (charmVisual === 'sandals') {
      for (const pivot of [rig.leftLegPivot, rig.rightLegPivot]) {
        if (!pivot) continue;
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.11, 4), goldMat);
        wing.rotation.x = -Math.PI / 3;
        wing.position.set(0.05, -0.27, -0.04);
        rig.charmSlot.add(wing);
      }

    } else if (charmVisual === 'mask') {
      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.14, 6), leatherMat);
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, 0.2, 0.16);
      rig.headgearSlot.add(snout);

    } else {
      // Amuleto u Óbolo flotante
      const talisman = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.05, 0),
        mat(0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 1.1 })
      );
      talisman.position.set(0.24, 0.72, 0.1);
      rig.charmSlot.add(talisman);
    }
  }

  // 5. Armadura (Torso, Hombreras / Spaulders, y Capa)
  if (armor) {
    const armorVisual = getItemVisualType(armor);
    const armorRarity = armor.rarity || 'common';
    const isBroad = effectiveClassId === 'campeon' || effectiveClassId === 'hoplita' || effectiveClassId === 'coribante';
    const chestW = isBroad ? 0.3 : 0.24;

    if (armorVisual === 'chlamys') {
      if (rig.capeMesh?.material) {
        rig.capeMesh.material.color.set(armorRarity === 'unique' ? 0x7e22ce : 0x991b1b);
      }
      if (rig.skirt?.material) {
        rig.skirt.material.color.set(armorRarity === 'unique' ? 0x581c87 : 0x7f1d1d);
      }

    } else if (armorVisual === 'pelt') {
      const mantle = new THREE.Mesh(new THREE.BoxGeometry(chestW * 1.1, 0.12, 0.22), leatherMat);
      mantle.position.set(0, 0.32, 0);
      rig.armorSlot.add(mantle);

    } else {
      // Cuirass / Coraza Hoplita / Égida
      const armorColor =
        armorRarity === 'unique'
          ? 0xffffff
          : armorRarity === 'rare'
          ? 0xfacc15
          : armorRarity === 'magic'
          ? 0x3b82f6
          : 0xd99b43;
      const armorEmissive =
        armorRarity === 'unique'
          ? 0xf97316
          : armorRarity === 'rare'
          ? 0x854d0e
          : armorRarity === 'magic'
          ? 0x1d4ed8
          : 0x000000;
      const armorIntensity =
        armorRarity === 'unique' ? 0.45 : armorRarity === 'rare' ? 0.35 : armorRarity === 'magic' ? 0.3 : 0;

      if (rig.torsoMesh?.material) {
        rig.torsoMesh.material.color.set(armorColor);
        rig.torsoMesh.material.emissive.set(armorEmissive);
        rig.torsoMesh.material.emissiveIntensity = armorIntensity;
        rig.torsoMesh.material.metalness = armorRarity === 'common' ? 0.75 : 0.9;
        rig.torsoMesh.material.roughness = armorRarity === 'unique' ? 0.18 : 0.25;
      }

      // Hombreras de combate (Spaulders)
      for (const side of [-1, 1]) {
        const pauldron = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.055, 0.14),
          mat(armorColor, { metalness: 0.88, roughness: 0.25, emissive: armorEmissive, emissiveIntensity: armorIntensity })
        );
        pauldron.position.set(side * (chestW * 0.5 + 0.04), 0.33, 0);
        rig.armorSlot.add(pauldron);
      }
    }
  } else {
    // Restaurar material de torso y capa por defecto de la clase
    if (rig.torsoMesh?.material) {
      const defColor = effectiveClassId === 'hoplita' ? 0xd99b43 : effectiveClassId === 'campeon' ? 0xeab68c : HERO_CLASSES[effectiveClassId]?.color || 0xd99b43;
      rig.torsoMesh.material.color.set(defColor);
      rig.torsoMesh.material.emissive.set(0x000000);
      rig.torsoMesh.material.emissiveIntensity = 0;
    }
  }
}

/**
 * Construye el modelo 3D articulado de alta fidelidad de cualquiera de las 7 clases griegas.
 * Incluye anatomía esculpida, rodilleras/grebas repujadas, pteruges individuales, hombreras,
 * manos articuladas, expresión facial/casco detallado y auras dinámicas.
 * Retorna un THREE.Group con `userData.rig` para animación de extremidades, arma, capa y auras.
 */
export function createHeroMesh3D(classId = 'hoplita') {
  const cls = HERO_CLASSES[classId] || HERO_CLASSES.hoplita;
  const root = new THREE.Group();
  root.name = `hero-${classId}`;

  const skinMat = mat(classId === 'necromante' ? 0xcbd5e1 : 0xeab68c, { roughness: 0.62, metalness: 0.06 });
  const primaryMat = mat(cls.color, { roughness: 0.38, metalness: 0.42 });
  const bronzeMat = mat(0xd99b43, { roughness: 0.24, metalness: 0.85 });
  const goldMat = mat(0xfacc15, { roughness: 0.18, metalness: 0.92, emissive: 0x422006, emissiveIntensity: 0.28 });
  const darkMetalMat = mat(0x334155, { roughness: 0.28, metalness: 0.82 });
  const steelMat = mat(0xe2e8f0, { roughness: 0.18, metalness: 0.9 });
  const leatherMat = mat(0x5c3a21, { roughness: 0.74, metalness: 0.12 });
  const darkClothMat = mat(0x1e1b2e, { roughness: 0.72, metalness: 0.12 });
  const boneMat = mat(0xf1f5f9, { roughness: 0.42, metalness: 0.1 });

  // Anillo base de clase en el suelo con runas concéntricas + anillos de buffs (Aura/Furia)
  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.37, 32),
    new THREE.MeshBasicMaterial({ color: cls.color, side: THREE.DoubleSide, transparent: true, opacity: 0.62 })
  );
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.02;
  const innerRuneRing = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.21, 24),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide, transparent: true, opacity: 0.28 })
  );
  innerRuneRing.rotation.x = -Math.PI / 2;
  innerRuneRing.position.y = 0.018;
  root.add(baseRing, innerRuneRing);

  const shieldAura = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.026, 12, 36),
    mat(0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 1.0, transparent: true, opacity: 0.88 })
  );
  shieldAura.rotation.x = Math.PI / 2;
  shieldAura.position.y = 0.06;
  shieldAura.visible = false;
  root.add(shieldAura);

  const furyAura = new THREE.Mesh(
    new THREE.TorusGeometry(0.41, 0.022, 12, 32),
    mat(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 1.15, transparent: true, opacity: 0.88 })
  );
  furyAura.rotation.x = Math.PI / 2;
  furyAura.position.y = 0.12;
  furyAura.visible = false;
  root.add(furyAura);

  // Grupo del cuerpo (permite bobbing vertical al caminar y respirar)
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Piernas articuladas con muslo anatómico, rodillera (epigonation), greba (cnémida) y sandalia/bota
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.095, 0.34, 0);
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.095, 0.34, 0);
  bodyGroup.add(leftLegPivot, rightLegPivot);

  const legMat = classId === 'hoplita' || classId === 'campeon' ? bronzeMat : classId === 'necromante' ? darkMetalMat : leatherMat;
  for (const pivot of [leftLegPivot, rightLegPivot]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.18, 12), skinMat);
    thigh.position.y = -0.08;
    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.054, 10, 8), goldMat);
    kneeCap.scale.set(0.95, 0.85, 0.7);
    kneeCap.position.set(0, -0.155, 0.032);
    const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.042, 0.18, 12), legMat);
    greave.position.y = -0.23;
    const greaveTrim = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 12), goldMat);
    greaveTrim.rotation.x = Math.PI / 2;
    greaveTrim.position.y = -0.17;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.062, 0.15), legMat);
    boot.position.set(0, -0.31, 0.024);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.02, 0.156), darkMetalMat);
    sole.position.set(0, -0.335, 0.024);
    pivot.add(thigh, kneeCap, greave, greaveTrim, boot, sole);
  }

  // Torso anatómico esculpido y faldellín griego (Pteruges detallados / Túnica)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.36, 0);
  bodyGroup.add(torsoPivot);

  const isBroad = classId === 'campeon' || classId === 'hoplita' || classId === 'coribante';
  const chestW = isBroad ? 0.31 : 0.25;
  const chestD = isBroad ? 0.195 : 0.165;

  const torsoBaseMat = classId === 'hoplita' ? bronzeMat : classId === 'campeon' ? skinMat : primaryMat;
  const torsoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(chestW, 0.34, chestD),
    torsoBaseMat
  );
  torsoMesh.position.y = 0.18;
  torsoPivot.add(torsoMesh);

  // Relieve pectoral y abdominal (coraza muscular griega o musculatura tracia)
  for (const sx of [-1, 1]) {
    const pec = new THREE.Mesh(new THREE.SphereGeometry(chestW * 0.23, 12, 10), torsoBaseMat);
    pec.scale.set(1.05, 0.78, 0.45);
    pec.position.set(sx * (chestW * 0.22), 0.245, chestD * 0.46);
    torsoPivot.add(pec);

    // Hombrera orgánica base (deltoides / gorguera)
    const deltoid = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 12, 10),
      classId === 'hoplita' ? goldMat : classId === 'sombra' ? darkMetalMat : bronzeMat
    );
    deltoid.scale.set(1.1, 0.75, 1.0);
    deltoid.position.set(sx * (chestW * 0.52), 0.33, 0);
    torsoPivot.add(deltoid);
  }

  // Medallón / Gorgoneion o emblema olímpico en el centro del pecho
  const chestEmblem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.044, 1),
    classId === 'necromante'
      ? mat(0xc084fc, { emissive: 0x7e22ce, emissiveIntensity: 0.9 })
      : classId === 'oraculo'
      ? mat(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 0.9 })
      : goldMat
  );
  chestEmblem.scale.set(1, 1, 0.45);
  chestEmblem.position.set(0, 0.23, chestD * 0.52);
  torsoPivot.add(chestEmblem);

  // Cinturón real con hebilla olímpica y faldellín de tiras (Pteruges)
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(chestW * 0.57, chestW * 0.63, 0.085, 16), goldMat);
  belt.position.y = 0.03;
  const buckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), goldMat);
  buckle.position.set(0, 0.03, chestD * 0.54);
  torsoPivot.add(belt, buckle);

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.205, 0.165, 14),
    classId === 'hoplita' || classId === 'campeon'
      ? leatherMat
      : classId === 'necromante'
      ? darkClothMat
      : primaryMat
  );
  skirt.position.y = -0.05;
  torsoPivot.add(skirt);

  // Tiras de pteruges de cuero y tachuelas de oro alrededor de la cintura
  const stripCount = 8;
  for (let i = 0; i < stripCount; i++) {
    const ang = (i / stripCount) * Math.PI * 2;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.13, 0.014), i % 2 === 0 ? leatherMat : goldMat);
    strip.position.set(Math.sin(ang) * 0.168, -0.055, Math.cos(ang) * 0.168);
    strip.rotation.y = ang;
    torsoPivot.add(strip);
  }

  // Capa dorsal articulada con pliegues y broches dorados (Fíbulas)
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.33, -chestD * 0.5);
  torsoPivot.add(capePivot);
  const capeColorMat = classId === 'hoplita' || classId === 'campeon' ? primaryMat : classId === 'necromante' ? primaryMat : darkClothMat;
  const capeMesh = new THREE.Mesh(new THREE.BoxGeometry(chestW * 0.96, 0.46, 0.032), capeColorMat);
  capeMesh.position.set(0, -0.21, -0.02);
  const capeTrim = new THREE.Mesh(new THREE.BoxGeometry(chestW * 0.98, 0.04, 0.036), goldMat);
  capeTrim.position.set(0, -0.43, -0.02);
  capePivot.add(capeMesh, capeTrim);
  for (const sx of [-1, 1]) {
    const fibula = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 12), goldMat);
    fibula.position.set(sx * (chestW * 0.36), 0.33, chestD * 0.48);
    torsoPivot.add(fibula);
  }
  capePivot.rotation.x = 0.18;

  // Cabeza esculpida con cuello, mandíbula y Casco/Tocado icónico de cada clase
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.42, 0);
  torsoPivot.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.07, 10), skinMat);
  neck.position.y = 0.01;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 14), skinMat);
  headMesh.scale.set(0.95, 1.08, 0.98);
  headMesh.position.y = 0.085;
  headGroup.add(neck, headMesh);

  // Ojos luminosos expresivos y cejas esculpidas
  const eyeColor =
    classId === 'oraculo'
      ? 0x38bdf8
      : classId === 'necromante'
      ? 0xc084fc
      : classId === 'sombra'
      ? 0xf472b6
      : classId === 'coribante'
      ? 0xa3e635
      : classId === 'campeon'
      ? 0xf97316
      : 0xfef08a;
  const eyeMat = mat(eyeColor, {
    emissive: eyeColor,
    emissiveIntensity: 1.15,
  });
  for (const ex of [-0.042, 0.042]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMat);
    eye.scale.set(1.3, 0.75, 0.6);
    eye.position.set(ex, 0.092, 0.112);
    headGroup.add(eye);
  }

  // Tocado / Yelmo detallado por clase
  if (classId === 'hoplita') {
    // Yelmo Corintio de bronce bruñido con carrilleras, protector nasal y gran penacho espartano (lophos)
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.134, 0.142, 0.23, 16), bronzeMat);
    helm.position.y = 0.095;
    const helmDome = new THREE.Mesh(new THREE.SphereGeometry(0.136, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), bronzeMat);
    helmDome.position.y = 0.18;
    const nasalGuard = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.09, 0.03), goldMat);
    nasalGuard.position.set(0, 0.09, 0.135);
    for (const sx of [-1, 1]) {
      const cheekPlate = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.11, 0.08), goldMat);
      cheekPlate.position.set(sx * 0.115, 0.045, 0.085);
      cheekPlate.rotation.y = -sx * 0.35;
      headGroup.add(cheekPlate);
    }
    const crestHolder = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.08, 0.26), goldMat);
    crestHolder.position.set(0, 0.24, -0.01);
    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.16, 0.36),
      mat(0xdc2626, { roughness: 0.45, emissive: 0x7f1d1d, emissiveIntensity: 0.4 })
    );
    crest.position.set(0, 0.32, -0.03);
    const crestTail = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.18, 8),
      mat(0xdc2626, { roughness: 0.45, emissive: 0x7f1d1d, emissiveIntensity: 0.4 })
    );
    crestTail.position.set(0, 0.22, -0.22);
    crestTail.rotation.x = -0.45;
    headGroup.add(helm, helmDome, nasalGuard, crestHolder, crest, crestTail);
  } else if (classId === 'campeon') {
    // Corona tracia de Ares con cuernos curvos segmentados, barba de guerra y hombreras con púas
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.136, 0.136, 0.065, 16), goldMat);
    band.position.y = 0.145;
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.14, 10), darkClothMat);
    beard.rotation.x = Math.PI;
    beard.position.set(0, 0.01, 0.065);
    const hairMane = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 10), darkClothMat);
    hairMane.position.set(0, 0.08, -0.08);
    hairMane.rotation.x = 0.45;
    headGroup.add(band, beard, hairMane);
    for (const side of [-1, 1]) {
      const hornBase = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 0.11, 8), bronzeMat);
      hornBase.position.set(side * 0.14, 0.18, 0.02);
      hornBase.rotation.z = -side * 0.55;
      const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 8), goldMat);
      hornTip.position.set(side * 0.19, 0.27, 0.04);
      hornTip.rotation.z = -side * 0.25;
      headGroup.add(hornBase, hornTip);

      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), bronzeMat);
      pauldron.position.set(side * 0.21, 0.32, 0);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.11, 6), goldMat);
      spike.position.set(side * 0.26, 0.41, 0);
      spike.rotation.z = -side * 0.4;
      torsoPivot.add(pauldron, spike);
    }
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.33, 0.065), primaryMat);
    strap.position.set(0, 0.18, 0);
    strap.rotation.z = 0.55;
    torsoPivot.add(strap);
  } else if (classId === 'arquera') {
    // Diadema lunar de Artemisa con creciente plateado, trenza larga y carcaj con flechas emplumadas
    const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.02, 8, 20), steelMat);
    tiara.rotation.x = Math.PI / 2;
    tiara.position.y = 0.15;
    const crescent = new THREE.Mesh(
      new THREE.TorusGeometry(0.048, 0.012, 8, 16, Math.PI * 1.35),
      mat(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.9, metalness: 0.9 })
    );
    crescent.position.set(0, 0.22, 0.12);
    crescent.rotation.z = Math.PI * 0.32;
    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.28, 10), leatherMat);
    hair.position.set(0, 0.04, -0.07);
    hair.rotation.x = 0.38;
    headGroup.add(tiara, crescent, hair);

    const quiverGroup = new THREE.Group();
    quiverGroup.position.set(0.1, 0.24, -0.14);
    quiverGroup.rotation.z = -0.32;
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.046, 0.32, 10), leatherMat);
    const quiverRim = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.009, 6, 12), goldMat);
    quiverRim.rotation.x = Math.PI / 2;
    quiverRim.position.y = 0.16;
    quiverGroup.add(quiver, quiverRim);
    for (let fi = -1; fi <= 1; fi++) {
      const fletch = new THREE.Mesh(
        new THREE.ConeGeometry(0.018, 0.09, 5),
        mat(0x4ade80, { emissive: 0x22c55e, emissiveIntensity: 0.6 })
      );
      fletch.position.set(fi * 0.022, 0.21, 0);
      quiverGroup.add(fletch);
    }
    torsoPivot.add(quiverGroup);
  } else if (classId === 'oraculo') {
    // Corona de laurel délfica dorada, velo místico y halo solar flotante detrás de la cabeza
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.024, 8, 20), goldMat);
    wreath.rotation.x = Math.PI / 2 - 0.15;
    wreath.position.y = 0.15;
    const veil = new THREE.Mesh(new THREE.ConeGeometry(0.155, 0.28, 12), primaryMat);
    veil.position.set(0, 0.14, -0.02);
    const astralHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.014, 8, 28),
      mat(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 1.2 })
    );
    astralHalo.position.set(0, 0.12, -0.09);
    headGroup.add(wreath, veil, astralHalo);
  } else if (classId === 'necromante') {
    // Capucha estigia profunda, máscara de cráneo esculpida, hombreras óseas y orbes de almas
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.175, 0.3, 12), darkClothMat);
    hood.position.set(0, 0.165, -0.01);
    const skullMask = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), boneMat);
    skullMask.scale.set(0.9, 1.0, 0.65);
    skullMask.position.set(0, 0.085, 0.075);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.055, 0.06), boneMat);
    jaw.position.set(0, 0.025, 0.09);
    headGroup.add(hood, skullMask, jaw);
    for (const side of [-1, 1]) {
      const boneShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), boneMat);
      boneShoulder.scale.set(1.1, 0.85, 1.0);
      boneShoulder.position.set(side * 0.2, 0.33, 0);
      const ribHorn = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 6), boneMat);
      ribHorn.position.set(side * 0.25, 0.4, -0.02);
      ribHorn.rotation.z = -side * 0.5;
      torsoPivot.add(boneShoulder, ribHorn);
    }
  } else if (classId === 'sombra') {
    // Capucha nocturna de Nix, máscara de las Erinias, diadema carmesí y bufanda flotante
    const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.27, 12), darkClothMat);
    cowl.position.set(0, 0.155, 0);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.085, 0.09), primaryMat);
    mask.position.set(0, 0.052, 0.09);
    const browGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.032, 0),
      mat(0xf472b6, { emissive: 0xdb2777, emissiveIntensity: 1.2 })
    );
    browGem.position.set(0, 0.15, 0.125);
    headGroup.add(cowl, mask, browGem);
  } else if (classId === 'coribante') {
    // Testuz de Lobo de Licaón esculpido con orejas, colmillos, ojos verdes y cuernos de carnero de Pan
    const pelt = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), leatherMat);
    pelt.scale.set(1.05, 0.95, 1.15);
    pelt.position.set(0, 0.16, 0.01);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 8), leatherMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.185, 0.165);
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), darkMetalMat);
    noseTip.position.set(0, 0.19, 0.24);
    headGroup.add(pelt, snout, noseTip);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.095, 5), leatherMat);
      ear.position.set(side * 0.1, 0.27, 0.02);
      ear.rotation.z = -side * 0.25;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.21, 8), goldMat);
      horn.position.set(side * 0.15, 0.23, -0.02);
      horn.rotation.z = -side * 0.65;
      horn.rotation.x = -0.32;
      headGroup.add(ear, horn);
    }
  }

  // Brazos articulados con bíceps, brazaletes repujados (bracers), manos y Armas 3D
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-(chestW * 0.5 + 0.058), 0.31, 0);
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(chestW * 0.5 + 0.058, 0.31, 0);
  torsoPivot.add(leftArmPivot, rightArmPivot);

  for (const pivot of [leftArmPivot, rightArmPivot]) {
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.15, 10), skinMat);
    upperArm.position.y = -0.07;
    const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.13, 10), bronzeMat);
    bracer.position.y = -0.18;
    const bracerRing = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.007, 6, 12), goldMat);
    bracerRing.rotation.x = Math.PI / 2;
    bracerRing.position.y = -0.12;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), skinMat);
    hand.position.y = -0.25;
    pivot.add(upperArm, bracer, bracerRing, hand);
  }

  // Slots modulares para equipamiento visual en el modelo 3D
  const offhandSlot = new THREE.Group();
  offhandSlot.name = 'offhandSlot';
  leftArmPivot.add(offhandSlot);

  const weaponSlot = new THREE.Group();
  weaponSlot.name = 'weaponSlot';
  rightArmPivot.add(weaponSlot);

  const armorSlot = new THREE.Group();
  armorSlot.name = 'armorSlot';
  torsoPivot.add(armorSlot);

  const headgearSlot = new THREE.Group();
  headgearSlot.name = 'headgearSlot';
  headGroup.add(headgearSlot);

  const charmSlot = new THREE.Group();
  charmSlot.name = 'charmSlot';
  bodyGroup.add(charmSlot);

  enableShadows(root, true, true);

  root.userData.rig = {
    classId,
    bodyGroup,
    torsoPivot,
    torsoMesh,
    skirt,
    capePivot,
    capeMesh,
    headGroup,
    headgearSlot,
    armorSlot,
    weaponSlot,
    offhandSlot,
    charmSlot,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    baseRing,
    shieldAura,
    furyAura,
    defaultLeftArmX: leftArmPivot.rotation.x,
    defaultRightArmX: rightArmPivot.rotation.x,
    isBowEquipped: false,
    walkPhase: 0,
    attackTimer: 0,
    whirlwindTimer: 0,
    hitFlashTimer: 0,
    facing: 0,
  };

  // Montar equipo inicial icónico por defecto de la clase
  updateHeroEquipmentVisuals(root, null, classId);

  return root;
}

/**
 * Construye el modelo 3D articulado de alta fidelidad de un enemigo según su especie
 * (`skeleton`, `harpy`, `satyr`, `minotaur`, `hades`) y su rango (`normal`, `champion`, `boss`).
 */
export function createEnemyMesh3D(enemy) {
  const kind = enemy.kind || 'skeleton';
  const tier = enemy.tier || 'normal';
  const root = new THREE.Group();
  root.name = `enemy-${enemy.id}`;

  const tierScale = kind === 'hades' ? 1.75 : tier === 'boss' ? 1.5 : tier === 'champion' ? 1.2 : 1.0;
  const bodyGroup = new THREE.Group();
  bodyGroup.scale.setScalar(tierScale);
  root.add(bodyGroup);

  // Sombra suave de contacto bajo todo enemigo
  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.26 * tierScale, 20),
    new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.42 })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.012;
  root.add(contactShadow);

  // Anillo en el suelo para Campeones, Jefes y Hades
  if (tier !== 'normal' || kind === 'hades') {
    const ringColor = kind === 'hades' ? 0xa855f7 : tier === 'boss' ? 0xf97316 : 0x38bdf8;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.32 * tierScale, 0.44 * tierScale, 32),
      new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide, transparent: true, opacity: kind === 'hades' ? 0.88 : 0.72 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    root.add(ring);
    root.userData.tierRing = ring;

    if (kind === 'hades' || tier === 'boss') {
      const outerHalo = new THREE.Mesh(
        new THREE.RingGeometry(0.49 * tierScale, 0.55 * tierScale, 32),
        new THREE.MeshBasicMaterial({
          color: kind === 'hades' ? 0xf97316 : 0xfacc15,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.68,
        })
      );
      outerHalo.rotation.x = -Math.PI / 2;
      outerHalo.position.y = 0.025;
      root.add(outerHalo);
    }
  }

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.09, 0.32, 0);
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.09, 0.32, 0);
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.34, 0);
  const leftArmPivot = new THREE.Group();
  const rightArmPivot = new THREE.Group();
  const leftWingPivot = new THREE.Group();
  const rightWingPivot = new THREE.Group();

  bodyGroup.add(leftLegPivot, rightLegPivot, torsoPivot);

  if (kind === 'skeleton') {
    // Hoplita Caído: Esqueleto 3D anatómico con pelvis, costillas arqueadas individuales, cráneo con mandíbula, yelmo roto y kopis curvo
    const boneMat = mat(tier === 'champion' ? 0xbae6fd : 0xf1f5f9, { roughness: 0.45, metalness: 0.12 });
    const rustMat = mat(0x92400e, { roughness: 0.45, metalness: 0.72 });
    const eyeMat = mat(tier === 'champion' ? 0x38bdf8 : 0xef4444, {
      emissive: tier === 'champion' ? 0x0284c7 : 0xdc2626,
      emissiveIntensity: 1.35,
    });
    const soulMat = mat(0xa855f7, { emissive: 0x7e22ce, emissiveIntensity: 1.1, transparent: true, opacity: 0.85 });

    for (const p of [leftLegPivot, rightLegPivot]) {
      const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.16, 8), boneMat);
      femur.position.y = -0.07;
      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), boneMat);
      kneeJoint.position.y = -0.15;
      const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.16, 8), boneMat);
      tibia.position.y = -0.23;
      const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.13, 8), rustMat);
      greave.position.set(0, -0.23, 0.01);
      p.add(femur, kneeJoint, tibia, greave);
    }

    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.07, 10), boneMat);
    pelvis.position.y = 0.02;
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.34, 8), boneMat);
    spine.position.y = 0.18;
    const soulHeart = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), soulMat);
    soulHeart.position.set(0, 0.21, 0.02);
    torsoPivot.add(pelvis, spine, soulHeart);

    // Costillar esculpido con 4 arcos torácicos reales
    for (let r = 0; r < 4; r++) {
      const ribArc = new THREE.Mesh(
        new THREE.TorusGeometry(0.095 - r * 0.008, 0.016, 6, 14, Math.PI * 1.45),
        boneMat
      );
      ribArc.rotation.x = Math.PI / 2;
      ribArc.rotation.z = -Math.PI * 0.22;
      ribArc.position.set(0, 0.28 - r * 0.048, 0.01);
      torsoPivot.add(ribArc);
    }

    // Cráneo, mandíbula y yelmo corintio quebrado con penacho raído
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.108, 14, 12), boneMat);
    skull.scale.set(0.92, 1.05, 1.02);
    skull.position.y = 0.43;
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.09), boneMat);
    jaw.position.set(0, 0.355, 0.035);
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.122, 0.14, 12), rustMat);
    helm.position.y = 0.48;
    const brokenCrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.11, 0.24),
      mat(0x7f1d1d, { roughness: 0.75 })
    );
    brokenCrest.position.set(0, 0.58, -0.02);
    torsoPivot.add(skull, jaw, helm, brokenCrest);

    for (const ex of [-0.038, 0.038]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), eyeMat);
      eye.position.set(ex, 0.43, 0.098);
      torsoPivot.add(eye);
    }

    leftArmPivot.position.set(-0.155, 0.29, 0);
    rightArmPivot.position.set(0.155, 0.29, 0);
    torsoPivot.add(leftArmPivot, rightArmPivot);

    for (const [idx, p] of [leftArmPivot, rightArmPivot].entries()) {
      const shoulderPlate = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), rustMat);
      shoulderPlate.scale.set(1.1, 0.7, 1.0);
      const humerus = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.14, 6), boneMat);
      humerus.position.y = -0.07;
      const ulna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.13, 6), boneMat);
      ulna.position.y = -0.18;
      p.add(shoulderPlate, humerus, ulna);
      if (idx === 0) p.rotation.x = -0.35;
    }

    // Escudo Aspis abollado con reborde de bronce
    const shieldGroup = new THREE.Group();
    shieldGroup.position.set(-0.04, -0.17, 0.1);
    const shieldDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.028, 16), rustMat);
    shieldDisc.rotation.x = Math.PI / 2;
    const shieldBoss = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), boneMat);
    shieldBoss.position.z = 0.022;
    shieldGroup.add(shieldDisc, shieldBoss);
    leftArmPivot.add(shieldGroup);

    // Espada Kopis griega curva en mano derecha
    const kopis = new THREE.Group();
    kopis.position.set(0, -0.21, 0.13);
    kopis.rotation.x = Math.PI / 2 - 0.35;
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 6), rustMat);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.38, 0.058),
      mat(0x94a3b8, { metalness: 0.82, roughness: 0.28 })
    );
    blade.position.set(0, 0.22, 0.015);
    const bladeTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.1, 4),
      mat(0x94a3b8, { metalness: 0.82, roughness: 0.28 })
    );
    bladeTip.position.set(0, 0.44, 0.02);
    kopis.add(hilt, blade, bladeTip);
    rightArmPivot.add(kopis);

  } else if (kind === 'harpy') {
    // Arpía del Estigia: Depredadora alada con alas multi-pluma, garras rapaces, cola emplumada y ojos estigios
    const plumageMat = mat(tier === 'champion' ? 0x60a5fa : 0xc084fc, { roughness: 0.42, metalness: 0.28 });
    const darkWingMat = mat(tier === 'champion' ? 0x1e3a8a : 0x581c87, { roughness: 0.48, metalness: 0.25 });
    const featherTipMat = mat(tier === 'champion' ? 0x93c5fd : 0xe879f9, {
      roughness: 0.35,
      emissive: tier === 'champion' ? 0x0284c7 : 0x86198f,
      emissiveIntensity: 0.45,
    });
    const talonMat = mat(0xfacc15, { roughness: 0.3, metalness: 0.72 });
    const eyeMat = mat(0xfef08a, { emissive: 0xf59e0b, emissiveIntensity: 1.4 });

    bodyGroup.position.y = 0.24; // Suspendida en vuelo

    for (const p of [leftLegPivot, rightLegPivot]) {
      const legPlume = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.032, 0.15, 8), plumageMat);
      legPlume.position.y = -0.07;
      const talonCenter = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.14, 6), talonMat);
      talonCenter.position.set(0, -0.18, 0.03);
      talonCenter.rotation.x = 0.45;
      const talonLeft = talonCenter.clone();
      talonLeft.position.x = -0.025;
      const talonRight = talonCenter.clone();
      talonRight.position.x = 0.025;
      p.add(legPlume, talonCenter, talonLeft, talonRight);
    }

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.34, 12), plumageMat);
    body.position.y = 0.17;
    const breast = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), plumageMat);
    breast.position.set(0, 0.23, 0.03);
    const tailFan = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 7), darkWingMat);
    tailFan.position.set(0, 0.02, -0.13);
    tailFan.rotation.x = -0.75;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), plumageMat);
    head.position.y = 0.41;
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.09, 6), talonMat);
    beak.rotation.x = Math.PI / 2 + 0.2;
    beak.position.set(0, 0.39, 0.11);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.2, 7), featherTipMat);
    crest.position.set(0, 0.52, -0.04);
    crest.rotation.x = -0.45;
    torsoPivot.add(body, breast, tailFan, head, beak, crest);

    for (const ex of [-0.038, 0.038]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMat);
      eye.position.set(ex, 0.42, 0.088);
      torsoPivot.add(eye);
    }

    // Alas grandes articuladas con abanico de 5 rémiges (plumas de vuelo) por ala
    leftWingPivot.position.set(-0.11, 0.29, -0.03);
    rightWingPivot.position.set(0.11, 0.29, -0.03);
    torsoPivot.add(leftWingPivot, rightWingPivot);

    for (const [side, wPivot] of [
      [-1, leftWingPivot],
      [1, rightWingPivot],
    ]) {
      const wingArm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.038, 0.14), darkWingMat);
      wingArm.position.set(side * 0.22, 0.05, -0.01);
      wingArm.rotation.z = -side * 0.22;
      wPivot.add(wingArm);

      for (let f = 0; f < 5; f++) {
        const feather = new THREE.Mesh(
          new THREE.ConeGeometry(0.042, 0.28 + f * 0.03, 5),
          f % 2 === 0 ? featherTipMat : plumageMat
        );
        feather.position.set(side * (0.12 + f * 0.085), -0.02 + f * 0.018, -0.08);
        feather.rotation.z = side * (1.2 + f * 0.12);
        feather.rotation.x = -0.28;
        wPivot.add(feather);
      }
    }

  } else if (kind === 'satyr') {
    // Sátiro Arquero: Piernas caprinas digitígradas con pelaje, pezuñas hendidas, barba, cuernos espirales, carcaj y arco recurvo
    const furMat = mat(0x5c2d0c, { roughness: 0.82, metalness: 0.05 });
    const skinMat = mat(0xd97706, { roughness: 0.58, metalness: 0.1 });
    const hornMat = mat(0xfef08a, { roughness: 0.32, metalness: 0.48 });
    const eyeMat = mat(0x4ade80, { emissive: 0x22c55e, emissiveIntensity: 1.2 });

    for (const p of [leftLegPivot, rightLegPivot]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.052, 0.16, 10), furMat);
      thigh.position.set(0, -0.08, 0.02);
      thigh.rotation.x = 0.25;
      const hock = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.038, 0.15, 10), furMat);
      hock.position.set(0, -0.2, -0.02);
      hock.rotation.x = -0.28;
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.054, 0.07, 8), hornMat);
      hoof.position.set(0, -0.29, 0.02);
      p.add(thigh, hock, hoof);
    }

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.31, 0.17), skinMat);
    chest.position.y = 0.16;
    const furWaist = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.15, 0.1, 10), furMat);
    furWaist.position.y = 0.02;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.112, 12, 10), skinMat);
    head.position.y = 0.39;
    const goatee = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 6), furMat);
    goatee.rotation.x = Math.PI - 0.3;
    goatee.position.set(0, 0.3, 0.095);
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.28, 8), furMat);
    quiver.position.set(0.08, 0.22, -0.12);
    quiver.rotation.z = -0.3;
    torsoPivot.add(chest, furWaist, head, goatee, quiver);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMat);
      eye.position.set(side * 0.04, 0.4, 0.098);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 5), skinMat);
      ear.position.set(side * 0.12, 0.41, 0);
      ear.rotation.z = -side * 1.1;
      const hornBase = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 0.12, 8), hornMat);
      hornBase.position.set(side * 0.085, 0.49, -0.01);
      hornBase.rotation.z = -side * 0.4;
      hornBase.rotation.x = -0.3;
      const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 8), hornMat);
      hornTip.position.set(side * 0.145, 0.58, -0.06);
      hornTip.rotation.z = -side * 0.75;
      hornTip.rotation.x = -0.5;
      torsoPivot.add(eye, ear, hornBase, hornTip);
    }

    leftArmPivot.position.set(-0.165, 0.27, 0);
    rightArmPivot.position.set(0.165, 0.27, 0);
    torsoPivot.add(leftArmPivot, rightArmPivot);

    for (const p of [leftArmPivot, rightArmPivot]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.035, 0.24, 8), skinMat);
      arm.position.y = -0.11;
      p.add(arm);
    }

    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, -0.14, 0.16);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 8, 16, Math.PI), hornMat);
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 2;
    const bowString = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.45, 4),
      mat(0xfef3c7, { roughness: 0.3 })
    );
    const arrow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.36, 5),
      mat(0xfacc15, { emissive: 0xd97706, emissiveIntensity: 0.8 })
    );
    arrow.rotation.x = Math.PI / 2;
    arrow.position.z = 0.08;
    bowGroup.add(bow, bowString, arrow);
    leftArmPivot.add(bowGroup);
    leftArmPivot.rotation.x = -1.05;
    rightArmPivot.rotation.x = -0.85;

  } else if (kind === 'hades') {
    // Hades, Soberano del Tártaro: Dios de los Muertos con armadura de obsidiana imperial, corona real, orbes de almas y Bidente Abisal
    const obsidianMat = mat(0x1e1035, { roughness: 0.18, metalness: 0.9, emissive: 0x3b0764, emissiveIntensity: 0.5 });
    const darkGoldMat = mat(0xf59e0b, { roughness: 0.16, metalness: 0.94, emissive: 0x78350f, emissiveIntensity: 0.5 });
    const abyssFireMat = mat(0xa855f7, { emissive: 0x9333ea, emissiveIntensity: 1.5, roughness: 0.18 });
    const eyeMat = mat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 1.8 });

    for (const p of [leftLegPivot, rightLegPivot]) {
      const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.058, 0.34, 12), obsidianMat);
      greave.position.y = -0.17;
      const kneeCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), darkGoldMat);
      kneeCrown.position.set(0, -0.1, 0.055);
      p.add(greave, kneeCrown);
    }

    // Manto real y coraza imperial del Inframundo
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.28, 0.25, 14), obsidianMat);
    robe.position.y = 0.02;
    const robeTrim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.016, 8, 24), darkGoldMat);
    robeTrim.rotation.x = Math.PI / 2;
    robeTrim.position.y = -0.09;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.43, 0.25), obsidianMat);
    chest.position.y = 0.22;
    const heartCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 1), abyssFireMat);
    heartCore.position.set(0, 0.25, 0.13);
    const heartFrame = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 8, 16), darkGoldMat);
    heartFrame.position.set(0, 0.25, 0.13);
    const cloak = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.64, 0.045),
      mat(0x4c1d95, { roughness: 0.55, emissive: 0x2e1065, emissiveIntensity: 0.48 })
    );
    cloak.position.set(0, 0.12, -0.16);
    cloak.rotation.x = 0.16;
    torsoPivot.add(robe, robeTrim, chest, heartCore, heartFrame, cloak);

    // Cabeza con Corona Dentada de 7 puntas de Hades y Halo del Eclipse
    const helmHead = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.134, 0.25, 14), obsidianMat);
    helmHead.position.set(0, 0.52, 0);
    const eclipseHalo = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.018, 8, 28), darkGoldMat);
    eclipseHalo.position.set(0, 0.56, -0.1);
    torsoPivot.add(helmHead, eclipseHalo);
    for (let ci = 0; ci < 7; ci++) {
      const ang = (ci / 7) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.17, 6), darkGoldMat);
      spike.position.set(Math.cos(ang) * 0.105, 0.69, Math.sin(ang) * 0.105);
      torsoPivot.add(spike);
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.025, 0.022), eyeMat);
      eye.position.set(side * 0.046, 0.52, 0.128);
      const pauldron = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 8), obsidianMat);
      pauldron.position.set(side * 0.25, 0.41, 0);
      pauldron.rotation.z = -side * 0.45;
      const pauldronTrim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 6, 14), darkGoldMat);
      pauldronTrim.position.set(side * 0.22, 0.35, 0);
      pauldronTrim.rotation.y = Math.PI / 2;
      const soulOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), abyssFireMat);
      soulOrb.position.set(side * 0.31, 0.56, 0);
      torsoPivot.add(eye, pauldron, pauldronTrim, soulOrb);
    }

    leftArmPivot.position.set(-0.245, 0.36, 0);
    rightArmPivot.position.set(0.245, 0.36, 0);
    torsoPivot.add(leftArmPivot, rightArmPivot);

    for (const p of [leftArmPivot, rightArmPivot]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.052, 0.33, 10), obsidianMat);
      arm.position.y = -0.14;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.012, 6, 12), darkGoldMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.24;
      p.add(arm, cuff);
    }

    // Bidente Real de Hades (lanza bifurcada llameante en mano derecha)
    const bident = new THREE.Group();
    bident.position.set(0, -0.24, 0.14);
    bident.rotation.x = Math.PI / 2 - 0.3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 1.16, 10), darkGoldMat);
    pole.position.y = 0.22;
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), darkGoldMat);
    crossbar.position.y = 0.76;
    const centerGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), eyeMat);
    centerGem.position.y = 0.78;
    for (const px of [-0.09, 0.09]) {
      const prong = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.28, 6), abyssFireMat);
      prong.position.set(px, 0.92, 0);
      bident.add(prong);
    }
    bident.add(pole, crossbar, centerGem);
    rightArmPivot.add(bident);
    rightArmPivot.rotation.x = -0.45;

    // Esfera de Almas del Estigia con anillo orbital en mano izquierda
    const soulSphereGroup = new THREE.Group();
    soulSphereGroup.position.set(0, -0.26, 0.16);
    const soulSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(0.088, 1), eyeMat);
    const soulRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 18), abyssFireMat);
    soulRing.rotation.x = Math.PI / 3;
    soulSphereGroup.add(soulSphere, soulRing);
    leftArmPivot.add(soulSphereGroup);
    leftArmPivot.rotation.x = -0.65;

  } else {
    // Minotauro Guardián (Boss / Élite): Coloso taurino con musculatura, crin dorsal, cuernos segmentados y gran Hacha Labrys bipenne
    const hideMat = mat(tier === 'boss' ? 0x9a3412 : 0x7c2d12, { roughness: 0.62, metalness: 0.16 });
    const darkFurMat = mat(0x431407, { roughness: 0.85, metalness: 0.08 });
    const bronzeMat = mat(0xf59e0b, { roughness: 0.25, metalness: 0.85 });
    const hornMat = mat(0xfef3c7, { roughness: 0.3, metalness: 0.35 });
    const eyeMat = mat(0xfacc15, { emissive: 0xef4444, emissiveIntensity: 1.4 });

    for (const p of [leftLegPivot, rightLegPivot]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.072, 0.28, 10), hideMat);
      leg.position.y = -0.14;
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.088, 0.09, 10), darkFurMat);
      hoof.position.set(0, -0.29, 0.015);
      p.add(leg, hoof);
    }

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.41, 0.27), hideMat);
    chest.position.y = 0.2;
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 0.12), darkFurMat);
    mane.position.set(0, 0.32, -0.11);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.225, 0.11, 12), bronzeMat);
    belt.position.y = 0.03;
    const beltSkull = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), bronzeMat);
    beltSkull.position.set(0, 0.03, 0.15);
    torsoPivot.add(chest, mane, belt, beltSkull);

    // Músculos pectorales y arnés de cadenas de bronce
    for (const sx of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), hideMat);
      pec.scale.set(1.1, 0.8, 0.55);
      pec.position.set(sx * 0.09, 0.26, 0.13);
      const harness = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.045, 0.29), bronzeMat);
      harness.position.set(0, 0.21, 0);
      harness.rotation.z = sx * 0.58;
      torsoPivot.add(pec, harness);
    }

    // Cabeza de toro con morro robusto, anillo nasal dorado y cuernos curvos de dos tramos
    const bullHead = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.23, 0.25), hideMat);
    bullHead.position.set(0, 0.48, 0.04);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.17), darkFurMat);
    snout.position.set(0, 0.44, 0.19);
    const noseRing = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.014, 8, 16), bronzeMat);
    noseRing.position.set(0, 0.39, 0.28);
    torsoPivot.add(bullHead, snout, noseRing);

    for (const side of [-1, 1]) {
      const hornBase = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.16, 10), hornMat);
      hornBase.position.set(side * 0.16, 0.54, 0.05);
      hornBase.rotation.z = -side * 1.1;
      const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.24, 10), hornMat);
      hornTip.position.set(side * 0.25, 0.64, 0.12);
      hornTip.rotation.z = -side * 0.35;
      hornTip.rotation.x = 0.45;
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.026, 0.022), eyeMat);
      eye.position.set(side * 0.068, 0.5, 0.17);
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bronzeMat);
      pauldron.position.set(side * 0.25, 0.35, 0);
      const pauldronSpike = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.12, 6), hornMat);
      pauldronSpike.position.set(side * 0.32, 0.44, 0);
      pauldronSpike.rotation.z = -side * 0.45;
      torsoPivot.add(hornBase, hornTip, eye, pauldron, pauldronSpike);
    }

    leftArmPivot.position.set(-0.245, 0.34, 0);
    rightArmPivot.position.set(0.245, 0.34, 0);
    torsoPivot.add(leftArmPivot, rightArmPivot);

    for (const p of [leftArmPivot, rightArmPivot]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.33, 10), hideMat);
      arm.position.y = -0.14;
      const wristBand = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.08, 10), bronzeMat);
      wristBand.position.y = -0.24;
      p.add(arm, wristBand);
    }

    // Gran Hacha Labrys Cretense de doble luna
    const labrys = new THREE.Group();
    labrys.position.set(0, -0.26, 0.16);
    labrys.rotation.x = Math.PI / 2 - 0.35;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.98, 10), bronzeMat);
    pole.position.y = 0.2;
    const axeMat = mat(0xf97316, { metalness: 0.85, roughness: 0.2, emissive: 0x7c2d12, emissiveIntensity: 0.5 });
    const axeCore = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.18, 0.16), bronzeMat);
    axeCore.position.y = 0.54;
    for (const sideZ of [-1, 1]) {
      const bladeWing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.038, 12, 1, false, 0, Math.PI), axeMat);
      bladeWing.rotation.z = Math.PI / 2;
      bladeWing.rotation.y = sideZ > 0 ? 0 : Math.PI;
      bladeWing.position.set(0, 0.54, sideZ * 0.06);
      labrys.add(bladeWing);
    }
    const spearSpike = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.14, 6), bronzeMat);
    spearSpike.position.y = 0.72;
    labrys.add(pole, axeCore, spearSpike);
    rightArmPivot.add(labrys);
    rightArmPivot.rotation.x = -0.45;
  }

  enableShadows(root, true, true);

  root.userData.rig = {
    kind,
    tier,
    bodyGroup,
    torsoPivot,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    leftWingPivot,
    rightWingPivot,
    defaultLeftArmX: leftArmPivot.rotation.x,
    defaultRightArmX: rightArmPivot.rotation.x,
    walkPhase: Math.random() * Math.PI * 2,
    attackTimer: 0,
    hitFlashTimer: 0,
    lastHp: enemy.hp,
    facing: 0,
  };

  return root;
}

/**
 * Construye el conjunto 3D de la Sibila de Cumas y la Hoguera Sagrada del Campamento.
 */
export function createSibylAndCampfire3D() {
  const group = new THREE.Group();

  // Sibila de Cumas con túnica bordada, brazos con báculo oracular y halo místico
  const sibyl = new THREE.Group();
  const robeMat = mat(0xc026d3, { roughness: 0.45, metalness: 0.25, emissive: 0x4a044e, emissiveIntensity: 0.38 });
  const goldMat = mat(0xfde68a, { roughness: 0.18, metalness: 0.9, emissive: 0x78350f, emissiveIntensity: 0.42 });

  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.56, 16), robeMat);
  skirt.position.y = 0.28;
  const skirtTrim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 8, 24), goldMat);
  skirtTrim.rotation.x = Math.PI / 2;
  skirtTrim.position.y = 0.03;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.175, 0.29, 14), robeMat);
  torso.position.y = 0.58;
  const shawl = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.025, 8, 18), goldMat);
  shawl.rotation.x = Math.PI / 2;
  shawl.position.y = 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.108, 14, 12), mat(0xfde68a, { roughness: 0.5 }));
  head.position.y = 0.82;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.165, 0.29, 14), goldMat);
  hood.position.y = 0.89;

  // Báculo del Oráculo junto a la Sibila
  const staffPole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.92, 8), goldMat);
  staffPole.position.set(0.19, 0.46, 0.08);
  const staffOrb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.055, 0),
    mat(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 1.3 })
  );
  staffOrb.position.set(0.19, 0.95, 0.08);

  // Anillo de oráculo flotante alrededor de la Sibila
  const oracleRing = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.018, 8, 32), goldMat);
  oracleRing.rotation.x = Math.PI / 2 - 0.25;
  oracleRing.position.y = 0.55;

  sibyl.add(skirt, skirtTrim, torso, shawl, head, hood, staffPole, staffOrb, oracleRing);
  group.add(sibyl);

  // Hoguera Sagrada (desplazada ligeramente como en el render 2D)
  const fireGroup = new THREE.Group();
  fireGroup.position.set(-0.45, 0, 0.35);

  const stoneMat = mat(0x475569, { roughness: 0.88 });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.068, 0), stoneMat);
    stone.position.set(Math.cos(ang) * 0.21, 0.04, Math.sin(ang) * 0.21);
    fireGroup.add(stone);
  }

  const outerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.155, 0.39, 10),
    mat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 1.3, transparent: true, opacity: 0.9 })
  );
  outerFlame.position.y = 0.19;

  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.095, 0.27, 8),
    mat(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 1.5 })
  );
  innerFlame.position.y = 0.15;

  fireGroup.add(outerFlame, innerFlame);
  group.add(fireGroup);

  enableShadows(group, true, true);
  group.userData = { sibyl, oracleRing, outerFlame, innerFlame };
  return group;
}

/**
 * Actualiza las articulaciones de un héroe o enemigo 3D (caminar, atacar, respirar, girar, destello de impacto).
 */
export function updateActorRig3D(mesh, { dt, moving = false, targetFacing = null, furyActive = false, shieldActive = false }) {
  const rig = mesh.userData.rig;
  if (!rig) return;

  // Destello incandescente al recibir daño (Hit Flash 3D)
  if (rig.hitFlashTimer > 0) {
    rig.hitFlashTimer = Math.max(0, rig.hitFlashTimer - dt);
    const flashActive = rig.hitFlashTimer > 0;
    mesh.traverse((c) => {
      if (c.isMesh && c !== rig.baseRing && c !== mesh.userData.tierRing && c.material?.emissive) {
        if (flashActive) {
          if (c.userData._savedEmissiveHex === undefined) {
            c.userData._savedEmissiveHex = c.material.emissive.getHex();
            c.userData._savedEmissiveInt = c.material.emissiveIntensity;
          }
          c.material.emissive.setHex(0xffffff);
          c.material.emissiveIntensity = 0.85;
        } else if (c.userData._savedEmissiveHex !== undefined) {
          c.material.emissive.setHex(c.userData._savedEmissiveHex);
          c.material.emissiveIntensity = c.userData._savedEmissiveInt;
          delete c.userData._savedEmissiveHex;
          delete c.userData._savedEmissiveInt;
        }
      }
    });
  }

  // Interpolación suave de orientación (8 direcciones / 360°)
  if (typeof targetFacing === 'number' && !Number.isNaN(targetFacing)) {
    let diff = targetFacing - rig.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    rig.facing += diff * Math.min(1, dt * 14);
  }

  if (rig.whirlwindTimer > 0) {
    rig.whirlwindTimer = Math.max(0, rig.whirlwindTimer - dt);
    mesh.rotation.y += dt * 22; // Giro 360° de Torbellino Tracio
  } else {
    mesh.rotation.y = rig.facing;
  }

  // Auras activas del héroe
  if (rig.shieldAura) {
    rig.shieldAura.visible = Boolean(shieldActive);
    if (shieldActive) rig.shieldAura.rotation.z += dt * 2.5;
  }
  if (rig.furyAura) {
    rig.furyAura.visible = Boolean(furyActive);
    if (furyActive) rig.furyAura.rotation.z -= dt * 3.5;
  }

  // Ciclo de marcha bípeda vs respiración idle
  const armWalkFactor = rig.isBowEquipped ? 0.08 : 0.45;
  if (moving) {
    rig.walkPhase += dt * 11.5;
    const swing = Math.sin(rig.walkPhase) * 0.65;
    const bob = Math.abs(Math.cos(rig.walkPhase)) * 0.045;
    rig.bodyGroup.position.y = (rig.kind === 'harpy' ? 0.22 : 0) + bob;
    if (rig.leftLegPivot) rig.leftLegPivot.rotation.x = swing;
    if (rig.rightLegPivot) rig.rightLegPivot.rotation.x = -swing;
    if (rig.leftArmPivot && rig.attackTimer <= 0) {
      rig.leftArmPivot.rotation.x = (rig.defaultLeftArmX ?? 0) - swing * armWalkFactor;
    }
    if (rig.rightArmPivot && rig.attackTimer <= 0) {
      rig.rightArmPivot.rotation.x = (rig.defaultRightArmX ?? 0) + swing * armWalkFactor;
    }
    if (rig.capePivot) {
      rig.capePivot.rotation.x = 0.38 + Math.sin(rig.walkPhase * 2) * 0.12;
    }
  } else {
    rig.walkPhase += dt * 2.4;
    const breath = Math.sin(rig.walkPhase) * 0.018;
    rig.bodyGroup.position.y = (rig.kind === 'harpy' ? 0.22 + breath * 2.2 : 0) + Math.max(0, breath);
    if (rig.leftLegPivot) rig.leftLegPivot.rotation.x *= 0.82;
    if (rig.rightLegPivot) rig.rightLegPivot.rotation.x *= 0.82;
    if (rig.leftArmPivot && rig.attackTimer <= 0) {
      rig.leftArmPivot.rotation.x += ((rig.defaultLeftArmX ?? 0) - rig.leftArmPivot.rotation.x) * 0.18;
    }
    if (rig.rightArmPivot && rig.attackTimer <= 0) {
      rig.rightArmPivot.rotation.x += ((rig.defaultRightArmX ?? 0) - rig.rightArmPivot.rotation.x) * 0.18;
    }
    if (rig.capePivot) {
      rig.capePivot.rotation.x = 0.18 + Math.sin(rig.walkPhase) * 0.04;
    }
  }

  // Aleteo constante de la Arpía
  if (rig.kind === 'harpy') {
    const flap = Math.sin(rig.walkPhase * 3.2) * 0.55;
    rig.leftWingPivot.rotation.z = flap;
    rig.rightWingPivot.rotation.z = -flap;
  }

  // Animación de ataque (tensión de arco vs tajo combo con arma cuerpo a cuerpo estilo Zelda)
  if (rig.attackTimer > 0) {
    rig.attackTimer = Math.max(0, rig.attackTimer - dt);
    const t = rig.attackTimer / 0.28; // 1 -> 0
    const swing = Math.sin(t * Math.PI);
    const step = rig.comboStep || 0;

    if (rig.isBowEquipped) {
      if (rig.rightArmPivot) {
        rig.rightArmPivot.rotation.x = (rig.defaultRightArmX ?? -1.28) + swing * 0.45;
      }
      if (rig.leftArmPivot) {
        rig.leftArmPivot.rotation.x = (rig.defaultLeftArmX ?? -1.46) - swing * 0.1;
      }
      if (rig.torsoPivot) {
        rig.torsoPivot.rotation.y = -swing * 0.18;
      }
    } else if (step === 1) {
      // Combo 2: Tajo ascendente diagonal inverso (izquierda a derecha)
      if (rig.rightArmPivot) {
        rig.rightArmPivot.rotation.x = (rig.defaultRightArmX ?? -0.3) + swing * 1.1;
        rig.rightArmPivot.rotation.z = -swing * 0.75;
      }
      if (rig.leftArmPivot) {
        rig.leftArmPivot.rotation.x = (rig.defaultLeftArmX ?? 0) - swing * 0.45;
      }
      if (rig.torsoPivot) {
        rig.torsoPivot.rotation.y = -swing * 0.42;
      }
    } else if (step === 2) {
      // Combo 3: Salto y hendidura vertical descendente con ambas manos (Zelda Jump Slash)
      if (rig.rightArmPivot) {
        rig.rightArmPivot.rotation.x = (rig.defaultRightArmX ?? -0.3) - swing * 2.15;
      }
      if (rig.leftArmPivot) {
        rig.leftArmPivot.rotation.x = (rig.defaultLeftArmX ?? 0) - swing * 1.85;
      }
      if (rig.torsoPivot) {
        rig.torsoPivot.rotation.x = swing * 0.38;
      }
      if (rig.bodyGroup) {
        rig.bodyGroup.position.y += Math.sin(t * Math.PI) * 0.14;
      }
    } else {
      // Combo 1: Tajo horizontal amplio (derecha a izquierda)
      if (rig.rightArmPivot) {
        rig.rightArmPivot.rotation.x = (rig.defaultRightArmX ?? -0.3) - swing * 1.5;
        rig.rightArmPivot.rotation.y = swing * 0.65;
      }
      if (rig.torsoPivot) {
        rig.torsoPivot.rotation.y = swing * 0.45;
      }
    }
  } else if (rig.torsoPivot) {
    rig.torsoPivot.rotation.y *= 0.8;
    rig.torsoPivot.rotation.x *= 0.8;
  }

  // Retroceso / Flinch al recibir un golpe (estilo Zelda OoT)
  if (rig.hitFlinchTimer > 0) {
    rig.hitFlinchTimer = Math.max(0, rig.hitFlinchTimer - dt);
    const flinchFrac = Math.sin((rig.hitFlinchTimer / 0.18) * Math.PI);
    if (rig.torsoPivot) rig.torsoPivot.rotation.x = -flinchFrac * 0.42;
    if (rig.bodyGroup) rig.bodyGroup.position.y += flinchFrac * 0.06;
    if (rig.leftArmPivot) rig.leftArmPivot.rotation.x += flinchFrac * 0.32;
    if (rig.rightArmPivot) rig.rightArmPivot.rotation.x += flinchFrac * 0.32;
  }

  // Guardia y bloqueo de impacto con escudo
  if (rig.shieldBlockTimer > 0) {
    rig.shieldBlockTimer = Math.max(0, rig.shieldBlockTimer - dt);
    const blockFrac = Math.sin((rig.shieldBlockTimer / 0.24) * Math.PI);
    if (rig.leftArmPivot) {
      rig.leftArmPivot.rotation.x = -1.25 * blockFrac + (rig.defaultLeftArmX ?? 0) * (1 - blockFrac);
      rig.leftArmPivot.rotation.y = 0.58 * blockFrac;
    }
  }
}

/**
 * Construye vegetación mediterránea, ruinas dóricas, muelles, barcas y rocas 3D
 * para el paisaje vivo del Nivel 1 sobre la tierra.
 */
export function createOverworldProp3D(prop) {
  const { kind, scale = 1 } = prop;
  const root = new THREE.Group();
  root.name = `prop-${kind}`;

  const trunkMat = mat(0x5c3a21, { roughness: 0.9, metalness: 0.05 });
  const marbleMat = mat(0xf1f5f9, { roughness: 0.45, metalness: 0.08 });
  const goldMat = mat(0xe5b869, { roughness: 0.3, metalness: 0.75 });

  if (kind === 'olive') {
    // Olivo griego de copa plateada-oliva y tronco nudoso
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.105, 0.46, 6), trunkMat);
    trunk.position.y = 0.22;
    trunk.rotation.z = 0.08;
    root.add(trunk);

    const leafColors = [0x4d7c3f, 0x659050, 0x7ca663];
    const blobs = [
      { x: 0, y: 0.56, z: 0, r: 0.28 },
      { x: -0.15, y: 0.5, z: 0.1, r: 0.22 },
      { x: 0.16, y: 0.52, z: -0.08, r: 0.22 },
      { x: 0.04, y: 0.68, z: 0.06, r: 0.2 },
    ];
    blobs.forEach((b, idx) => {
      const crown = new THREE.Mesh(
        new THREE.DodecahedronGeometry(b.r, 1),
        mat(leafColors[idx % leafColors.length], { roughness: 0.85, metalness: 0.04 })
      );
      crown.position.set(b.x, b.y, b.z);
      root.add(crown);
    });
  } else if (kind === 'cypress') {
    // Ciprés mediterráneo esbelto
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.34, 6), trunkMat);
    trunk.position.y = 0.17;
    root.add(trunk);

    const tiers = [
      { y: 0.45, r: 0.22, h: 0.48, c: 0x1e4d34 },
      { y: 0.75, r: 0.17, h: 0.46, c: 0x245e3e },
      { y: 1.02, r: 0.11, h: 0.38, c: 0x2c714b },
    ];
    for (const tier of tiers) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(tier.r, tier.h, 7), mat(tier.c, { roughness: 0.85 }));
      cone.position.y = tier.y;
      root.add(cone);
    }
  } else if (kind === 'flower') {
    // Pradera de flores silvestres griegas (amapolas, asfódelos dorados, lirios)
    const palette = [0xef4444, 0xfacc15, 0xf8fafc, 0xc084fc];
    const stemMat = mat(0x22c55e, { roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.4;
      const dist = 0.09 + (i % 2) * 0.06;
      const fx = Math.cos(ang) * dist;
      const fz = Math.sin(ang) * dist;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.12, 4), stemMat);
      stem.position.set(fx, 0.06, fz);
      const bloom = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.036, 0),
        mat(palette[i % palette.length], { emissive: palette[i % palette.length], emissiveIntensity: 0.15, roughness: 0.5 })
      );
      bloom.position.set(fx, 0.13, fz);
      root.add(stem, bloom);
    }
  } else if (kind === 'reed') {
    // Juncos junto a la orilla del río o agua
    const stalkMat = mat(0x65a30d, { roughness: 0.8 });
    const headMat = mat(0x78350f, { roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const rx = (i - 1.5) * 0.055;
      const rz = ((i % 2) - 0.5) * 0.08;
      const h = 0.32 + (i % 3) * 0.08;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, h, 4), stalkMat);
      stalk.position.set(rx, h * 0.5 - 0.06, rz);
      stalk.rotation.z = (i - 1.5) * 0.08;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.08, 5), headMat);
      head.position.set(rx + Math.sin(stalk.rotation.z) * h * 0.4, h - 0.08, rz);
      root.add(stalk, head);
    }
  } else if (kind === 'boulder') {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.28, 1),
      mat(0x78716c, { roughness: 0.92, metalness: 0.06 })
    );
    rock.scale.set(1.15, 0.78, 1.05);
    rock.position.y = 0.16;
    rock.rotation.set(0.3, prop.x * 1.3, 0.2);
    root.add(rock);
  } else if (kind === 'column') {
    // Columna dórica de mármol blanco griego (Delfos)
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), marbleMat);
    plinth.position.y = 0.06;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 1.15, 10), marbleMat);
    shaft.position.y = 0.68;
    const capital = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.42), goldMat);
    capital.position.y = 1.28;
    root.add(plinth, shaft, capital);
  } else if (kind === 'broken_column') {
    // Ruina caída en la costa o laderas
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.48, 10), marbleMat);
    stump.position.y = 0.24;
    const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.56, 10), marbleMat);
    fallen.rotation.z = Math.PI / 2 - 0.12;
    fallen.rotation.y = 0.65;
    fallen.position.set(0.28, 0.14, 0.12);
    root.add(stump, fallen);
  } else if (kind === 'dock') {
    // Embarcadero de madera en la Ribera del Aqueronte
    const woodMat = mat(0x854d0e, { roughness: 0.85 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.07, 0.82), woodMat);
    deck.position.set(0.25, 0.06, 0);
    root.add(deck);
    for (const [px, pz] of [
      [-0.2, -0.34],
      [-0.2, 0.34],
      [0.7, -0.34],
      [0.7, 0.34],
    ]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.45, 6), trunkMat);
      post.position.set(px, 0.05, pz);
      root.add(post);
    }
    const lantern = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.06, 0),
      mat(0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 1.4 })
    );
    lantern.position.set(0.7, 0.32, 0.34);
    root.add(lantern);
  } else if (kind === 'boat') {
    // Barca griega flotando sobre el río Aqueronte
    const hullMat = mat(0x78350f, { roughness: 0.78 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 1.05), hullMat);
    const prow = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.35, 4), hullMat);
    prow.rotation.x = -Math.PI / 2;
    prow.rotation.y = Math.PI / 4;
    prow.position.set(0, 0.02, -0.68);
    const lantern = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.055, 0),
      mat(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 1.3 })
    );
    lantern.position.set(0, 0.2, -0.78);
    root.add(hull, prow, lantern);
    root.position.y = -0.06;
  }

  root.scale.setScalar(scale);
  enableShadows(root, true, true);
  return root;
}

/** Construye una criatura viva ambiental 3D (mariposa de Arcadia o luciérnaga del río). */
export function createCritterMesh3D(critter) {
  const root = new THREE.Group();
  const baseColor = critter.color || 0xfbbf24;

  if (critter.kind === 'firefly') {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 6, 6),
      mat(baseColor, { emissive: baseColor, emissiveIntensity: 1.6, roughness: 0.2 })
    );
    root.add(glow);
    root.userData = { kind: 'firefly', baseX: critter.x, baseY: critter.y, phase: critter.phase || 0 };
  } else {
    const wingMat = new THREE.MeshBasicMaterial({ color: baseColor, side: THREE.DoubleSide });
    const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.09), wingMat);
    leftWing.position.x = -0.04;
    leftWing.rotation.x = -Math.PI / 2;
    const rightWing = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.09), wingMat);
    rightWing.position.x = 0.04;
    rightWing.rotation.x = -Math.PI / 2;
    root.add(leftWing, rightWing);
    root.userData = {
      kind: 'butterfly',
      leftWing,
      rightWing,
      baseX: critter.x,
      baseY: critter.y,
      phase: critter.phase || 0,
    };
  }
  return root;
}

/** Construye una vasija griega de cerámica rompible 3D (estilo Zelda OoT). */
export function createPotMesh3D(pot) {
  const group = new THREE.Group();
  group.name = `pot-${pot.id}`;
  const potMat = mat(0xc25e36, { roughness: 0.85, metalness: 0.08 });
  const rimMat = mat(0xd97706, { roughness: 0.7, metalness: 0.2 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.12, 8), potMat);
  base.position.y = 0.06;

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8), potMat);
  belly.position.y = 0.18;
  belly.scale.set(1.0, 0.9, 1.0);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.12, 8), potMat);
  neck.position.y = 0.28;

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.024, 6, 12), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.34;

  for (const sx of [-0.21, 0.21]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 5, 10, Math.PI), rimMat);
    handle.position.set(sx, 0.22, 0);
    handle.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(handle);
  }

  group.add(base, belly, neck, rim);
  enableShadows(group, true, true);
  group.userData = { pot };
  return group;
}

/** Construye un arbusto de maleza cortable 3D (estilo Zelda OoT). */
export function createBushMesh3D(bush) {
  const group = new THREE.Group();
  group.name = `bush-${bush.id}`;
  const bushMat = mat(0x3ea832, { roughness: 0.88, metalness: 0.05 });
  const darkLeafMat = mat(0x2d7a24, { roughness: 0.9, metalness: 0.05 });
  const berryMat = mat(0xef4444, { roughness: 0.5, metalness: 0.1 });

  const center = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), bushMat);
  center.position.y = 0.18;
  group.add(center);

  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.3;
    const clump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), darkLeafMat);
    clump.position.set(Math.cos(ang) * 0.16, 0.13, Math.sin(ang) * 0.16);
    group.add(clump);

    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), berryMat);
    berry.position.set(Math.cos(ang) * 0.22, 0.22, Math.sin(ang) * 0.22);
    group.add(berry);
  }

  enableShadows(group, true, true);
  group.userData = { bush };
  return group;
}

/** Construye la Fuente de la Gran Hada 3D (Zelda OoT Great Fairy Fountain). */
export function createFairyFountain3D(fountain) {
  const group = new THREE.Group();
  group.name = `fairy-${fountain.id}`;

  const basinMat = mat(0xe2e8f0, { roughness: 0.45, metalness: 0.2 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.22, 8), basinMat);
  basin.position.y = 0.11;

  const waterMat = mat(0x38bdf8, { roughness: 0.1, metalness: 0.3, emissive: 0x0284c7, emissiveIntensity: 0.45, transparent: true, opacity: 0.85 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.08, 8), waterMat);
  water.position.y = 0.18;

  const fairyGroup = new THREE.Group();
  fairyGroup.position.set(0, 0.65, 0);

  const fairyBody = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.12, 1),
    mat(0xf472b6, { emissive: 0xec4899, emissiveIntensity: 1.4 })
  );
  fairyGroup.add(fairyBody);

  const wingMat = mat(0xffffff, { transparent: true, opacity: 0.75, emissive: 0xfbcfe8, emissiveIntensity: 0.8 });
  const wings = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 4), wingMat);
      wing.position.set(sx * 0.12, sy * 0.05, -0.05);
      wing.rotation.z = sx * (sy > 0 ? 0.75 : 1.35);
      wing.rotation.x = 0.25;
      fairyGroup.add(wing);
      wings.push({ mesh: wing, sx });
    }
  }

  const fairyLight = new THREE.PointLight(0xf472b6, 3.2, 7.5);
  fairyLight.position.set(0, 0.75, 0);

  group.add(basin, water, fairyGroup, fairyLight);
  enableShadows(group, true, true);
  group.userData = { fountain, fairyGroup, wings, fairyLight, water };
  return group;
}

/**
 * Renderizador WebGL Isométrico 3D completo para el escenario y los personajes de ARCH.
 * Se monta detrás del canvas 2D HUD para combinar modelos 3D reales e iluminación dinámica
 * con textos flotantes y barras de salud nítidas.
 */
export class ArchRenderer3D {
  constructor(hudCanvas) {
    this.hudCanvas = hudCanvas;
    this.parent = hudCanvas.parentElement;
    this.enabled = false;

    try {
      this.webglCanvas = document.createElement('canvas');
      this.webglCanvas.className = 'webgl-stage-canvas';
      this.webglCanvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;display:block;';
      this.hudCanvas.style.position = 'relative';
      this.hudCanvas.style.zIndex = '1';
      if (this.parent) {
        this.parent.insertBefore(this.webglCanvas, this.hudCanvas);
      }

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.webglCanvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setClearColor(0x090b10, 1);

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);

      // Iluminación atmosférica del Aqueronte
      this.ambientLight = new THREE.AmbientLight(0x8b9bb4, 0.95);
      this.scene.add(this.ambientLight);

      this.dirLight = new THREE.DirectionalLight(0xfef3c7, 1.35);
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.set(1024, 1024);
      this.dirLight.shadow.camera.near = 10;
      this.dirLight.shadow.camera.far = 160;
      const d = 16;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.scene.add(this.dirLight);
      this.scene.add(this.dirLight.target);

      // Luz cálida que sigue al héroe (antorcha / aura divina)
      this.heroLight = new THREE.PointLight(0xf59e0b, 1.8, 9.5, 1.5);
      this.heroLight.position.set(0, 1.6, 0);
      this.scene.add(this.heroLight);

      // Luz de la Hoguera del Campamento
      this.campfireLight = new THREE.PointLight(0xf97316, 2.4, 8.5, 1.4);
      this.campfireLight.visible = false;
      this.scene.add(this.campfireLight);

      // Grupos de la escena
      this.dungeonGroup = new THREE.Group();
      this.actorsGroup = new THREE.Group();
      this.fxGroup = new THREE.Group();
      this.scene.add(this.dungeonGroup, this.actorsGroup, this.fxGroup);

      this.tileMeshes = [];
      this.chestMeshes = new Map();
      this.shrineGroup = null;
      this.npcGroup = null;
      this.heroMesh = null;
      this.heroClassId = null;
      this.enemyMeshes = new Map();
      this.dropMeshes = [];
      this.dropMeshesMap = new Map();
      this.waterMeshes = [];
      this.sceneryPropMeshes = [];
      this.critterMeshes = [];
      this.boatMeshes = [];
      this.lastEquippedKey = null;
      this.projMeshes = [];
      this.activeVFX = [];
      this.zoom = 1.0;

      this.potMeshes = new Map();
      this.bushMeshes = new Map();
      this.fairyMeshes = new Map();
      this.dyingActors = [];
      this.ambientParticles = [];
      this.lastHeroPos = { x: 0, y: 0 };
      this.enabled = true;
    } catch (err) {
      console.warn('[ArchRenderer3D] WebGL no disponible, usando fallback Canvas 2D:', err);
      this.enabled = false;
    }
  }

  resize(viewW, viewH) {
    if (!this.enabled) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = viewW;
    this.viewH = viewH;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(viewW, viewH, false);
    this._updateCameraProjection();
  }

  setZoom(zoom) {
    this.zoom = Math.max(0.75, Math.min(2.2, zoom));
    this._updateCameraProjection();
  }

  _updateCameraProjection() {
    if (!this.enabled || !this.viewW || !this.viewH) return;
    const scale = ISO_SCALE * this.zoom;
    this.camera.left = -this.viewW / (2 * scale);
    this.camera.right = this.viewW / (2 * scale);
    this.camera.top = this.viewH / (2 * scale);
    this.camera.bottom = -this.viewH / (2 * scale);
    this.camera.updateProjectionMatrix();
  }

  /** Reconstruye la geometría 3D del calabozo o del mundo exterior vivo */
  buildDungeon(dungeon) {
    if (!this.enabled || !dungeon) return;

    while (this.dungeonGroup.children.length > 0) {
      this.dungeonGroup.remove(this.dungeonGroup.children[0]);
    }
    for (const [, m] of this.enemyMeshes) {
      this.actorsGroup.remove(m);
    }
    this.enemyMeshes.clear();
    this.chestMeshes.clear();
    this.tileMeshes = [];
    this.waterMeshes = [];
    this.sceneryPropMeshes = [];
    this.critterMeshes = [];
    this.boatMeshes = [];
    this.shrineGroup = null;
    this.npcGroup = null;

    if (!this.potMeshes) {
      this.potMeshes = new Map();
    } else {
      for (const [, m] of this.potMeshes) {
        this.dungeonGroup.remove(m);
        disposeObject3D(m);
      }
      this.potMeshes.clear();
    }
    if (!this.bushMeshes) {
      this.bushMeshes = new Map();
    } else {
      for (const [, m] of this.bushMeshes) {
        this.dungeonGroup.remove(m);
        disposeObject3D(m);
      }
      this.bushMeshes.clear();
    }
    if (!this.fairyMeshes) {
      this.fairyMeshes = new Map();
    } else {
      for (const [, m] of this.fairyMeshes) {
        this.dungeonGroup.remove(m);
        disposeObject3D(m);
      }
      this.fairyMeshes.clear();
    }
    if (!this.ambientParticles) {
      this.ambientParticles = [];
    } else {
      for (const p of this.ambientParticles) {
        this.fxGroup.remove(p.mesh);
        disposeObject3D(p.mesh);
      }
      this.ambientParticles = [];
    }
    if (!this.dyingActors) {
      this.dyingActors = [];
    } else {
      for (const da of this.dyingActors) {
        this.actorsGroup.remove(da.mesh);
        disposeObject3D(da.mesh);
        if (da.light) this.fxGroup.remove(da.light);
      }
      this.dyingActors = [];
    }

    if (this.dropMeshesMap) {
      for (const [, m] of this.dropMeshesMap) {
        this.fxGroup.remove(m);
        disposeObject3D(m);
      }
      this.dropMeshesMap.clear();
      this.dropMeshes = [];
    }

    if (this.activeVFX) {
      for (const vfx of this.activeVFX) {
        if (vfx.mesh) {
          this.fxGroup.remove(vfx.mesh);
          disposeObject3D(vfx.mesh);
        }
        if (vfx.light) {
          this.fxGroup.remove(vfx.light);
        }
      }
      this.activeVFX = [];
    }

    const { width, height, grid, biome, isOverworld, isFinalFloor, terrain, elevation } = dungeon;

    // Atmósfera e iluminación según Nivel 1 (Sol mediterráneo) vs Inframundo / Trono Piso 22
    if (isOverworld) {
      this.renderer?.setClearColor?.(0x163954, 1);
      this.ambientLight.color.set(0xe0f2fe);
      this.ambientLight.intensity = 1.45;
      this.dirLight.color.set(0xfffbeb);
      this.dirLight.intensity = 1.95;
      this.heroLight.intensity = 1.1;
    } else if (isFinalFloor) {
      this.renderer?.setClearColor?.(0x0c0614, 1);
      this.ambientLight.color.set(0xa78bfa);
      this.ambientLight.intensity = 1.05;
      this.dirLight.color.set(0xfde68a);
      this.dirLight.intensity = 1.45;
      this.heroLight.intensity = 2.0;
    } else {
      // Atmósfera distintiva según el Templo Mítico de cada estrato (Zelda OoT)
      const temple = biome?.templeId || biome?.id;
      if (temple === 'bosque') {
        this.renderer?.setClearColor?.(0x0a140d, 1);
        this.ambientLight.color.set(0x34d399);
        this.ambientLight.intensity = 0.95;
        this.dirLight.color.set(0xa7f3d0);
        this.dirLight.intensity = 1.35;
      } else if (temple === 'fuego') {
        this.renderer?.setClearColor?.(0x140705, 1);
        this.ambientLight.color.set(0xf97316);
        this.ambientLight.intensity = 1.1;
        this.dirLight.color.set(0xfed7aa);
        this.dirLight.intensity = 1.4;
      } else if (temple === 'agua') {
        this.renderer?.setClearColor?.(0x05131a, 1);
        this.ambientLight.color.set(0x38bdf8);
        this.ambientLight.intensity = 1.15;
        this.dirLight.color.set(0xbae6fd);
        this.dirLight.intensity = 1.45;
      } else if (temple === 'sombras') {
        this.renderer?.setClearColor?.(0x0d0714, 1);
        this.ambientLight.color.set(0xc084fc);
        this.ambientLight.intensity = 0.9;
        this.dirLight.color.set(0xe9d5ff);
        this.dirLight.intensity = 1.25;
      } else if (temple === 'espiritu') {
        this.renderer?.setClearColor?.(0x1a1208, 1);
        this.ambientLight.color.set(0xfacc15);
        this.ambientLight.intensity = 1.2;
        this.dirLight.color.set(0xfef08a);
        this.dirLight.intensity = 1.5;
      } else {
        this.renderer?.setClearColor?.(0x07090f, 1);
        this.ambientLight.color.set(0x8b9bb4);
        this.ambientLight.intensity = 0.95;
        this.dirLight.color.set(0xfef3c7);
        this.dirLight.intensity = 1.35;
      }
      this.heroLight.intensity = 1.8;
    }

    const matCache = new Map();
    const dimRatio = isOverworld ? 0.72 : 0.35;
    const getMatPair = (key, color, opts = {}) => {
      if (matCache.has(key)) return matCache.get(key);
      const lit = mat(color, opts);
      const dim = mat(new THREE.Color(color).multiplyScalar(dimRatio), {
        ...opts,
        emissive: opts.emissive ? new THREE.Color(opts.emissive).multiplyScalar(0.35) : 0x000000,
      });
      const pair = { lit, dim };
      matCache.set(key, pair);
      return pair;
    };

    const assignPairedMesh = (geo, key, color, opts = {}) => {
      const pair = getMatPair(key, color, opts);
      const mesh = new THREE.Mesh(geo, pair.lit);
      mesh.userData.matPair = pair;
      return mesh;
    };

    const floorGeo = new THREE.BoxGeometry(0.99, 0.14, 0.99);
    const overworldBlockGeo = new THREE.BoxGeometry(1.002, 0.34, 1.002);
    const wallGeo = new THREE.BoxGeometry(0.98, 0.72, 0.98);
    const cliffGeo = new THREE.BoxGeometry(1.002, 0.68, 1.002);
    const cliffCapGeo = new THREE.BoxGeometry(1.01, 0.09, 1.01);
    const waterGeo = new THREE.BoxGeometry(1.002, 0.22, 1.002);
    const tuftGeo = new THREE.ConeGeometry(0.036, 0.14, 4);
    const pebbleGeo = new THREE.BoxGeometry(0.09, 0.03, 0.08);
    const bridgeRailGeo = new THREE.BoxGeometry(0.14, 0.14, 0.98);
    const pillarGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.82, 8);

    const grassShades = [0x3d7d36, 0x45883c, 0x377130];
    const meadowShades = [0x4c9a41, 0x58ab49, 0x62b652];
    const dirtShades = [0x9c7248, 0x8c633b, 0xa87d53];
    const sandShades = [0xe2c275, 0xd8b460, 0xebd087];

    for (let y = 0; y < height; y++) {
      this.tileMeshes[y] = [];
      for (let x = 0; x < width; x++) {
        const t = grid[y][x];
        const tKind = isOverworld ? terrain?.[y]?.[x] || 'grass' : null;
        const elev = isOverworld ? elevation?.[y]?.[x] || 0 : 0;
        const hash = ((x * 73856093) ^ (y * 19349663)) & 255;
        let tileObj;

        if (isOverworld) {
          if (tKind === 'water') {
            // Agua profunda del Río Aqueronte / Mar Egeo con ondulación animada
            const waterGroup = new THREE.Group();
            const waterMesh = assignPairedMesh(waterGeo, 'water-deep', 0x0284c7, {
              roughness: 0.12,
              metalness: 0.35,
              emissive: 0x0369a1,
              emissiveIntensity: 0.34,
              transparent: true,
              opacity: 0.92,
            });
            waterMesh.position.y = -0.24;
            waterMesh.receiveShadow = true;
            waterGroup.add(waterMesh);
            this.waterMeshes.push({ mesh: waterMesh, baseY: -0.24, x, y, shallow: false });
            tileObj = waterGroup;
          } else if (tKind === 'shallow_water') {
            // Orilla poco profunda vadeable: arena sumergida + agua turquesa traslúcida
            const shallowGroup = new THREE.Group();
            const sandBed = assignPairedMesh(overworldBlockGeo, 'sand-bed', 0xcfa655, { roughness: 0.9, metalness: 0.05 });
            sandBed.position.y = -0.28;
            sandBed.receiveShadow = true;
            const waterTop = assignPairedMesh(waterGeo, 'water-shallow', 0x38bdf8, {
              roughness: 0.08,
              metalness: 0.25,
              emissive: 0x0284c7,
              emissiveIntensity: 0.24,
              transparent: true,
              opacity: 0.65,
            });
            waterTop.position.y = -0.13;
            shallowGroup.add(sandBed, waterTop);
            this.waterMeshes.push({ mesh: waterTop, baseY: -0.13, x, y, shallow: true });
            tileObj = shallowGroup;
          } else if (tKind === 'bridge') {
            // Puente de piedra y madera sobre agua del río
            const bridgeGroup = new THREE.Group();
            const underWater = assignPairedMesh(waterGeo, 'water-deep', 0x0284c7, {
              roughness: 0.15,
              metalness: 0.35,
              emissive: 0x0369a1,
              emissiveIntensity: 0.28,
              transparent: true,
              opacity: 0.88,
            });
            underWater.position.y = -0.26;
            this.waterMeshes.push({ mesh: underWater, baseY: -0.26, x, y, shallow: false });

            const deck = assignPairedMesh(floorGeo, 'bridge-deck', 0x9a7b56, { roughness: 0.78, metalness: 0.1 });
            deck.position.y = -0.01;
            deck.receiveShadow = true;
            bridgeGroup.add(underWater, deck);

            if (terrain?.[y - 1]?.[x] === 'water') {
              const railN = assignPairedMesh(bridgeRailGeo, 'bridge-rail', 0x94a3b8, { roughness: 0.7 });
              railN.rotation.y = Math.PI / 2;
              railN.position.set(0, 0.1, -0.42);
              bridgeGroup.add(railN);
            }
            if (terrain?.[y + 1]?.[x] === 'water') {
              const railS = assignPairedMesh(bridgeRailGeo, 'bridge-rail', 0x94a3b8, { roughness: 0.7 });
              railS.rotation.y = Math.PI / 2;
              railS.position.set(0, 0.1, 0.42);
              bridgeGroup.add(railS);
            }
            enableShadows(bridgeGroup, true, true);
            tileObj = bridgeGroup;
          } else if (t === TILE_WALL && tKind === 'cliff') {
            // Riscos y colinas naturales con tapa de césped o basalto
            const cliffGroup = new THREE.Group();
            const rockMesh = assignPairedMesh(cliffGeo, 'cliff-rock', 0x6b5e50, { roughness: 0.92, metalness: 0.06 });
            rockMesh.position.y = 0.24;
            const capMesh = assignPairedMesh(cliffCapGeo, 'cliff-cap', 0x45883c, { roughness: 0.85, metalness: 0.04 });
            capMesh.position.y = 0.61;
            cliffGroup.add(rockMesh, capMesh);
            enableShadows(cliffGroup, true, true);
            tileObj = cliffGroup;
          } else {
            // Suelos naturales en superficie: pasto, pradera, tierra, arena, mármol, roca o bosque
            const idx3 = hash % 3;
            let color = grassShades[idx3];
            let key = `grass-${idx3}`;
            let rough = 0.88;
            let metal = 0.05;
            let yOffset = -0.07 + elev;

            if (tKind === 'meadow' || tKind === 'forest') {
              color = tKind === 'forest' ? 0x35692e : meadowShades[idx3];
              key = tKind === 'forest' ? 'forest-turf' : `meadow-${idx3}`;
            } else if (tKind === 'dirt') {
              color = dirtShades[idx3];
              key = `dirt-${idx3}`;
              rough = 0.95;
              yOffset = -0.08 + elev * 0.4;
            } else if (tKind === 'sand') {
              color = sandShades[idx3];
              key = `sand-${idx3}`;
              rough = 0.92;
            } else if (tKind === 'marble') {
              color = (x + y) % 2 === 0 ? 0xf1f5f9 : 0xe2e8f0;
              key = (x + y) % 2 === 0 ? 'marble-a' : 'marble-b';
              rough = 0.38;
              metal = 0.14;
              yOffset = -0.03 + elev;
            } else if (tKind === 'rock') {
              color = idx3 === 0 ? 0x44403c : 0x57534e;
              key = `rock-${idx3}`;
              rough = 0.9;
            } else if (tKind === 'astral_grass') {
              color = 0x312e81;
              key = `astral-grass-${idx3}`;
              rough = 0.65;
              metal = 0.2;
            } else if (tKind === 'crystal_marble') {
              color = 0xe0e7ff;
              key = 'crystal-marble';
              rough = 0.25;
              metal = 0.3;
            } else if (tKind === 'aether_dirt') {
              color = 0x4f46e5;
              key = 'aether-dirt';
              rough = 0.8;
            } else if (tKind === 'cosmic_rock') {
              color = 0x1e1b4b;
              key = 'cosmic-rock';
              rough = 0.85;
            }

            if (t === TILE_STAIRS) {
              key = 'tartarus-threshold';
              color = 0x2e1f27;
            } else if (t === TILE_SHRINE) {
              key = 'delfos-shrine-pad';
              color = 0xe2e8f0;
            }

            const baseMesh = assignPairedMesh(overworldBlockGeo, key, color, { roughness: rough, metalness: metal });
            baseMesh.position.y = yOffset - 0.1;
            baseMesh.receiveShadow = true;

            // Detalles 3D orgánicos de superficie: matas de pasto, piedritas, incrustación dorada
            if (t === TILE_STAIRS) {
              // Entrada megalítica al Inframundo (Fauces del Tártaro)
              const caveGroup = new THREE.Group();
              caveGroup.add(baseMesh);
              const stoneMatKey = 'cave-arch-stone';
              for (const sx of [-0.36, 0.36]) {
                const post = assignPairedMesh(new THREE.BoxGeometry(0.18, 0.72, 0.24), stoneMatKey, 0x3f3a47, { roughness: 0.85 });
                post.position.set(sx, 0.36, 0);
                const brazier = assignPairedMesh(
                  new THREE.OctahedronGeometry(0.08, 0),
                  'cave-fire',
                  0xf97316,
                  { emissive: 0xea580c, emissiveIntensity: 1.5 }
                );
                brazier.position.set(sx, 0.78, 0);
                caveGroup.add(post, brazier);
              }
              const lintel = assignPairedMesh(new THREE.BoxGeometry(0.94, 0.16, 0.3), stoneMatKey, 0x3f3a47, { roughness: 0.85 });
              lintel.position.set(0, 0.72, 0);
              const portalCore = assignPairedMesh(
                new THREE.PlaneGeometry(0.56, 0.58),
                'cave-portal',
                0x3b0764,
                { emissive: 0x7e22ce, emissiveIntensity: 1.2, side: THREE.DoubleSide }
              );
              portalCore.position.set(0, 0.34, -0.02);
              caveGroup.add(lintel, portalCore);
              tileObj = caveGroup;
            } else if (t === TILE_SHRINE) {
              const sGroup = new THREE.Group();
              sGroup.add(baseMesh);
              const ped = assignPairedMesh(
                new THREE.CylinderGeometry(0.24, 0.3, 0.28, 10),
                'shrine-ped',
                0xf1f5f9,
                { roughness: 0.4 }
              );
              ped.position.y = 0.14;
              const crystal = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.16, 0),
                mat(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 1.15 })
              );
              crystal.position.y = 0.48;
              sGroup.add(ped, crystal);
              sGroup.userData.crystal = crystal;
              this.shrineGroup = sGroup;
              tileObj = sGroup;
            } else if ((tKind === 'grass' || tKind === 'meadow') && (hash & 3) === 0) {
              const tuftGroup = new THREE.Group();
              tuftGroup.add(baseMesh);
              for (let ti = 0; ti < 2; ti++) {
                const blade = assignPairedMesh(tuftGeo, 'grass-tuft', 0x65a30d, { roughness: 0.85 });
                blade.position.set(((ti === 0 ? -1 : 1) * ((hash >> 2) % 3) * 0.12), yOffset + 0.11, ((hash >> 4) % 3 - 1) * 0.14);
                blade.rotation.z = (ti === 0 ? 1 : -1) * 0.18;
                tuftGroup.add(blade);
              }
              tileObj = tuftGroup;
            } else if (tKind === 'dirt' && (hash & 7) === 1) {
              const dirtGroup = new THREE.Group();
              dirtGroup.add(baseMesh);
              const peb = assignPairedMesh(pebbleGeo, 'dirt-pebble', 0x78716c, { roughness: 0.9 });
              peb.position.set(((hash % 5) - 2) * 0.12, yOffset + 0.08, (((hash >> 3) % 5) - 2) * 0.1);
              peb.rotation.y = hash * 0.3;
              dirtGroup.add(peb);
              tileObj = dirtGroup;
            } else {
              tileObj = baseMesh;
            }
          }
        } else {
          // Pisos 2–22+: Geometría de mazmorras del Inframundo
          if (t === TILE_WALL) {
            const wallKey = `wall-${biome.id}`;
            const isCornerColumn = (x + y) % 5 === 0;
            if (isCornerColumn) {
              tileObj = new THREE.Group();
              const base = assignPairedMesh(wallGeo, wallKey, biome.wall, { roughness: 0.85, metalness: 0.12 });
              base.position.y = 0.36;
              const col = assignPairedMesh(pillarGeo, `col-${biome.id}`, isFinalFloor ? 0x7e22ce : 0x64748b, { roughness: 0.6 });
              col.position.y = 0.45;
              tileObj.add(base, col);
            } else {
              tileObj = assignPairedMesh(wallGeo, wallKey, biome.wall, { roughness: 0.85, metalness: 0.12 });
              tileObj.position.y = 0.36;
            }
            enableShadows(tileObj, true, true);
          } else {
            const floorKey =
              t === TILE_STAIRS
                ? 'floor-stairs'
                : t === TILE_STAIRS_UP
                ? 'floor-stairs-up'
                : t === TILE_SHRINE
                ? 'floor-shrine'
                : `floor-${biome.id}`;
            const color =
              t === TILE_STAIRS
                ? 0x422006
                : t === TILE_STAIRS_UP
                ? 0x0f2942
                : t === TILE_SHRINE
                ? 0x164e63
                : biome.floor;
            tileObj = assignPairedMesh(floorGeo, floorKey, color, { roughness: 0.88, metalness: 0.08 });
            tileObj.position.y = -0.06;
            tileObj.receiveShadow = true;

            const addStairsArch = (group, archKey, archColor, archEmissive, emissiveIntensity, zPos = 0, height = 0.55) => {
              const archOpts = { metalness: 0.7, roughness: 0.3, emissive: archEmissive, emissiveIntensity };
              for (const sx of [-0.32, 0.32]) {
                const post = assignPairedMesh(new THREE.CylinderGeometry(0.06, 0.08, height, 7), archKey, archColor, archOpts);
                post.position.set(sx, height / 2, zPos);
                group.add(post);
              }
              const lintel = assignPairedMesh(new THREE.BoxGeometry(0.78, 0.08, 0.14), archKey, archColor, archOpts);
              lintel.position.set(0, height + 0.02, zPos);
              group.add(lintel);
            };

            if (t === TILE_STAIRS) {
              const stairsGroup = new THREE.Group();
              stairsGroup.add(tileObj);
              const archColor = isFinalFloor ? 0xa855f7 : 0xfacc15;
              const archEmissive = isFinalFloor ? 0x7e22ce : 0x713f12;
              const archKey = isFinalFloor ? 'stairs-arch-final' : 'stairs-arch';
              addStairsArch(stairsGroup, archKey, archColor, archEmissive, isFinalFloor ? 0.9 : 0.4);
              tileObj = stairsGroup;
            } else if (t === TILE_STAIRS_UP) {
              const upGroup = new THREE.Group();
              upGroup.add(tileObj);
              for (const st of [
                { z: 0.25, h: 0.12, y: 0.05 },
                { z: 0.0, h: 0.24, y: 0.11 },
                { z: -0.25, h: 0.36, y: 0.17 },
              ]) {
                const step = assignPairedMesh(
                  new THREE.BoxGeometry(0.54, st.h, 0.24),
                  'stairs-up-step',
                  0x94a3b8,
                  { roughness: 0.55, metalness: 0.18 }
                );
                step.position.set(0, st.y, st.z);
                upGroup.add(step);
              }
              addStairsArch(upGroup, 'stairs-up-arch', 0x38bdf8, 0x0284c7, 0.65, -0.18, 0.62);
              tileObj = upGroup;
            } else if (t === TILE_SHRINE) {
              const sGroup = new THREE.Group();
              sGroup.add(tileObj);
              const ped = assignPairedMesh(
                new THREE.CylinderGeometry(0.22, 0.28, 0.24, 8),
                'shrine-ped-ug',
                0x94a3b8,
                { roughness: 0.5 }
              );
              ped.position.y = 0.12;
              const crystal = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.16, 0),
                mat(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 1.1 })
              );
              crystal.position.y = 0.44;
              sGroup.add(ped, crystal);
              sGroup.userData.crystal = crystal;
              this.shrineGroup = sGroup;
              tileObj = sGroup;
            }
          }
        }

        tileObj.position.x = x + 0.5;
        tileObj.position.z = y + 0.5;
        tileObj.visible = false;
        tileObj.userData.lastVis = -1;
        this.dungeonGroup.add(tileObj);
        this.tileMeshes[y][x] = tileObj;
      }
    }

    // Vegetación, ruinas de mármol, muelle y barca en el Nivel 1 sobre la tierra
    if (isOverworld && Array.isArray(dungeon.sceneryProps)) {
      for (const prop of dungeon.sceneryProps) {
        const pm = createOverworldProp3D(prop);
        pm.position.x = prop.x;
        pm.position.z = prop.y;
        pm.visible = false;
        pm.userData.tileX = Math.floor(prop.x);
        pm.userData.tileY = Math.floor(prop.y);
        pm.userData.propKind = prop.kind;
        this.dungeonGroup.add(pm);
        this.sceneryPropMeshes.push(pm);
        if (prop.kind === 'boat') {
          this.boatMeshes.push(pm);
        }
      }
    }

    // Fauna viva en el mundo exterior (mariposas y luciérnagas)
    if (isOverworld && Array.isArray(dungeon.ambientCritters)) {
      for (const cr of dungeon.ambientCritters) {
        const cm = createCritterMesh3D(cr);
        cm.position.set(cr.x, 0.45, cr.y);
        cm.visible = false;
        this.dungeonGroup.add(cm);
        this.critterMeshes.push(cm);
      }
    }

    // Cofres 3D con tapa articulada
    for (const c of dungeon.chests || []) {
      const chestGroup = new THREE.Group();
      chestGroup.position.set(c.x, 0, c.y);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.26), mat(0xb45309, { roughness: 0.6 }));
      box.position.y = 0.1;
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.2, -0.13);
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.1, 0.28),
        mat(0xf59e0b, { metalness: 0.7, roughness: 0.3 })
      );
      lid.position.set(0, 0.05, 0.13);
      lidPivot.add(lid);
      chestGroup.add(box, lidPivot);
      chestGroup.userData.lidPivot = lidPivot;
      enableShadows(chestGroup, true, true);
      this.dungeonGroup.add(chestGroup);
      this.chestMeshes.set(c, chestGroup);
    }

    // Sibila de Cumas / Oráculo y Hoguera 3D
    if (dungeon.npc) {
      this.npcGroup = createSibylAndCampfire3D();
      this.npcGroup.position.set(dungeon.npc.x, 0, dungeon.npc.y);
      this.dungeonGroup.add(this.npcGroup);
      this.campfireLight.position.set(dungeon.npc.x - 0.45, 0.85, dungeon.npc.y + 0.35);
      this.campfireLight.visible = true;
    } else {
      this.campfireLight.visible = false;
    }

    // Vasijas de cerámica 3D (estilo Zelda OoT)
    for (const pot of dungeon.pots || []) {
      const pm = createPotMesh3D(pot);
      pm.position.set(pot.x, 0, pot.y);
      pm.visible = false;
      this.dungeonGroup.add(pm);
      this.potMeshes.set(pot, pm);
    }

    // Maleza y arbustos cortables 3D (estilo Zelda OoT)
    for (const bush of dungeon.bushes || []) {
      const bm = createBushMesh3D(bush);
      bm.position.set(bush.x, 0, bush.y);
      bm.visible = false;
      this.dungeonGroup.add(bm);
      this.bushMeshes.set(bush, bm);
    }

    // Fuentes de las Grandes Hadas 3D (Zelda OoT Great Fairy Fountain)
    for (const fountain of dungeon.fairyFountains || []) {
      const fm = createFairyFountain3D(fountain);
      fm.position.set(fountain.x, 0, fountain.y);
      fm.visible = false;
      this.dungeonGroup.add(fm);
      this.fairyMeshes.set(fountain, fm);
    }

    // Partículas atmosféricas temáticas de cada templo (Zelda OoT)
    if (!isOverworld && biome) {
      const pKind = biome.particles || (biome.templeId === 'fuego' ? 'embers' : 'spores');
      const pCount = 22;
      const pColor =
        pKind === 'embers' ? 0xf97316 :
        pKind === 'bubbles' ? 0x38bdf8 :
        pKind === 'wisps' ? 0xa855f7 :
        pKind === 'dust' ? 0xfde047 :
        pKind === 'void' ? 0xc084fc :
        0x4ade80;

      const pGeom = new THREE.OctahedronGeometry(pKind === 'wisps' ? 0.07 : 0.04, 0);
      const pMat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.85 });

      for (let i = 0; i < pCount; i++) {
        const pm = new THREE.Mesh(pGeom, pMat.clone());
        const room = dungeon.rooms?.[i % (dungeon.rooms?.length || 1)] || { cx: width / 2, cy: height / 2, w: 4, h: 4 };
        const rx = room.cx + (Math.random() - 0.5) * Math.max(2, (room.w || 4) - 1);
        const ry = room.cy + (Math.random() - 0.5) * Math.max(2, (room.h || 4) - 1);
        pm.position.set(rx, 0.15 + Math.random() * 0.9, ry);
        this.fxGroup.add(pm);
        this.ambientParticles.push({
          mesh: pm,
          kind: pKind,
          baseX: rx,
          baseY: ry,
          baseZ: pm.position.y,
          speedY: (pKind === 'embers' || pKind === 'bubbles') ? 0.35 + Math.random() * 0.4 : 0.1,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  /** Dispara animación de ataque combo o habilidad en el modelo 3D del héroe con estela de arma */
  triggerHeroAttack({ whirlwind = false, comboStep = 0, aimDir = null, classId = null, pos = null } = {}) {
    if (!this.heroMesh?.userData?.rig) return;
    const rig = this.heroMesh.userData.rig;
    rig.attackTimer = 0.28;
    rig.comboStep = comboStep || 0;
    if (whirlwind) {
      rig.whirlwindTimer = 0.55;
    }

    const curX = pos ? pos.x : this.lastHeroPos.x;
    const curY = pos ? pos.y : this.lastHeroPos.y;
    this.triggerSlashTrail({
      x: curX,
      y: curY,
      facing: rig.facing,
      aimDir,
      comboStep,
      whirlwind,
      classId: classId || this.heroClassId,
    });
  }

  /**
   * Genera un arco de estela de arma 3D (crescent weapon slash arc) al atacar (estilo Zelda OoT).
   */
  triggerSlashTrail({ x, y, facing = 0, aimDir = null, comboStep = 0, whirlwind = false, classId = 'hoplita' } = {}) {
    if (!this.enabled) return;

    const group = new THREE.Group();
    const heroColor = HERO_CLASSES[classId]?.color ? parseInt(HERO_CLASSES[classId].color.replace('#', '0x'), 16) : 0xfacc15;
    const trailCol = whirlwind ? 0xef4444 : comboStep === 2 ? 0xf59e0b : heroColor;

    if (whirlwind) {
      // Ataque Circular 360° (Zelda Great Spin Attack)
      const ringGeom = new THREE.RingGeometry(0.55, 1.35, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: trailCol,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      group.position.set(x, 0.38, y);
      group.add(ringMesh);

      const light = new THREE.PointLight(trailCol, 4.0, 7.0);
      light.position.set(x, 0.8, y);
      this.fxGroup.add(light);
      this.fxGroup.add(group);

      const totalLife = 0.28;
      this.activeVFX.push({
        mesh: group,
        light,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const sc = 1.0 + p * 0.65;
          ringMesh.scale.set(sc, sc, 1);
          ringMesh.rotation.z += dt * 14.0;
          ringMat.opacity = Math.max(0, 0.92 * (1 - p));
        },
      });
      return;
    }

    // Tajo en arco de 120° (Zelda crescent slash trail)
    const sweep = Math.PI * 0.72;
    const startAng = comboStep === 1 ? -sweep * 0.2 : -sweep * 0.8;
    const arcGeom = new THREE.RingGeometry(0.48, 1.05, 18, 1, startAng, sweep);
    const arcMat = new THREE.MeshBasicMaterial({
      color: trailCol,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const arcMesh = new THREE.Mesh(arcGeom, arcMat);
    arcMesh.rotation.x = -Math.PI / 2;

    if (comboStep === 1) {
      arcMesh.rotation.y = 0.32;
    } else if (comboStep === 2) {
      arcMesh.rotation.y = -0.42;
    }

    const angFacing = typeof facing === 'number' ? facing : 0;
    group.rotation.y = angFacing;
    group.position.set(x + Math.sin(angFacing) * 0.42, 0.42, y + Math.cos(angFacing) * 0.42);
    group.add(arcMesh);

    const light = new THREE.PointLight(trailCol, 3.2, 5.0);
    light.position.set(group.position.x, 0.8, group.position.z);
    this.fxGroup.add(light);
    this.fxGroup.add(group);

    const totalLife = 0.18;
    this.activeVFX.push({
      mesh: group,
      light,
      maxLife: totalLife,
      life: totalLife,
      baseLightIntensity: light.intensity,
      update: (dt, p) => {
        const sc = 1.0 + p * 0.35;
        arcMesh.scale.set(sc, sc, 1);
        arcMat.opacity = Math.max(0, 0.95 * (1 - p * 1.25));
      },
    });
  }

  /**
   * Dispara chispas direccionales y destello de impacto (estilo Zelda OoT).
   */
  triggerHitImpactVFX({ x = 0, y = 0, isCrit = false, dirX = 1, dirY = 0, damage = 20 } = {}) {
    if (!this.enabled) return;
    const group = new THREE.Group();
    group.position.set(x, 0.45, y);

    const starGeom = new THREE.OctahedronGeometry(isCrit ? 0.26 : 0.17, 0);
    const starMat = new THREE.MeshBasicMaterial({
      color: isCrit ? 0xfef08a : 0xffffff,
      transparent: true,
      opacity: 0.98,
    });
    const starMesh = new THREE.Mesh(starGeom, starMat);
    starMesh.scale.set(1.4, 1.4, 0.4);
    group.add(starMesh);

    let ringMesh = null;
    let ringMat = null;
    if (isCrit) {
      const ringGeom = new THREE.RingGeometry(0.1, 0.25, 24);
      ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      group.add(ringMesh);
    }

    const sparks = [];
    const sparkCount = isCrit ? 16 : 9;
    const sparkGeom = new THREE.OctahedronGeometry(isCrit ? 0.045 : 0.035, 0);
    const baseAng = Math.atan2(dirY, dirX);
    for (let i = 0; i < sparkCount; i++) {
      const spMat = new THREE.MeshBasicMaterial({ color: isCrit ? 0xfde047 : 0xe0f2fe, transparent: true, opacity: 1.0 });
      const pm = new THREE.Mesh(sparkGeom, spMat);
      group.add(pm);
      const ang = baseAng + (Math.random() - 0.5) * 1.5;
      const spd = (3.5 + Math.random() * 4.5) * (isCrit ? 1.3 : 1.0);
      sparks.push({
        mesh: pm,
        vx: Math.cos(ang) * spd,
        vy: 1.5 + Math.random() * 3.5,
        vz: Math.sin(ang) * spd,
      });
    }

    const light = new THREE.PointLight(isCrit ? 0xfacc15 : 0xffffff, isCrit ? 4.5 : 2.5, 6.0);
    light.position.set(x, 0.6, y);
    this.fxGroup.add(light);
    this.fxGroup.add(group);

    const totalLife = isCrit ? 0.28 : 0.20;
    this.activeVFX.push({
      mesh: group,
      light,
      particles: sparks,
      maxLife: totalLife,
      life: totalLife,
      baseLightIntensity: light.intensity,
      update: (dt, p) => {
        starMat.opacity = Math.max(0, 0.98 * (1 - p * 1.5));
        const sc = 1.0 + p * 0.8;
        starMesh.scale.set(1.4 * sc, 1.4 * sc, 0.4);
        if (ringMesh && ringMat) {
          const rScale = 1.0 + p * 4.5;
          ringMesh.scale.set(rScale, rScale, 1.0);
          ringMat.opacity = Math.max(0, 0.85 * (1 - p));
        }
      },
    });
  }

  /**
   * Reacción de daño del héroe o bloqueo con escudo.
   */
  triggerHeroHurt({ blocked = false, x = 0, y = 0 } = {}) {
    if (!this.heroMesh?.userData?.rig) return;
    const rig = this.heroMesh.userData.rig;
    if (blocked) {
      rig.shieldBlockTimer = 0.24;
      const group = new THREE.Group();
      group.position.set(x || this.lastHeroPos.x, 0.55, y || this.lastHeroPos.y);
      const ringGeom = new THREE.RingGeometry(0.1, 0.35, 18);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);

      const sparks = [];
      const sparkGeom = new THREE.OctahedronGeometry(0.04, 0);
      for (let i = 0; i < 8; i++) {
        const pm = new THREE.Mesh(sparkGeom, new THREE.MeshBasicMaterial({ color: 0xbae6fd }));
        group.add(pm);
        const ang = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * 3.5;
        sparks.push({ mesh: pm, vx: Math.cos(ang) * spd, vy: 1.5 + Math.random() * 3, vz: Math.sin(ang) * spd });
      }
      this.fxGroup.add(group);
      const totalLife = 0.22;
      this.activeVFX.push({
        mesh: group,
        particles: sparks,
        maxLife: totalLife,
        life: totalLife,
        update: (dt, p) => {
          const sc = 1 + p * 2.5;
          ring.scale.set(sc, sc, 1);
          ringMat.opacity = Math.max(0, 0.9 * (1 - p));
        },
      });
    } else {
      rig.hitFlinchTimer = 0.18;
    }
  }

  /**
   * Disuelve un enemigo con una animación dramática de colapso y partículas mágicas (estilo Zelda OoT).
   */
  triggerEnemyDeath(enemy) {
    if (!this.enabled || !enemy) return;
    const mesh = this.enemyMeshes.get(enemy.id);
    if (!mesh) return;

    this.enemyMeshes.delete(enemy.id);
    if (!this.dyingActors) this.dyingActors = [];

    const kind = enemy.kind;
    const isBoss = enemy.tier === 'boss' || enemy.isFinalBoss || kind === 'hades';
    const totalLife = isBoss ? 1.4 : 0.52;

    const materials = [];
    mesh.traverse((c) => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone();
        c.material.transparent = true;
        materials.push(c.material);
      }
    });

    const deathParticles = [];
    const pCount = isBoss ? 32 : 14;
    const pColor =
      kind === 'skeleton' ? 0x818cf8 :
      kind === 'harpy' ? 0x334155 :
      kind === 'hades' ? 0xf59e0b :
      0xfacc15;
    const pGeom = new THREE.OctahedronGeometry(isBoss ? 0.08 : 0.045, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.95 });

    for (let i = 0; i < pCount; i++) {
      const pm = new THREE.Mesh(pGeom, pMat.clone());
      pm.position.set(enemy.x, 0.35, enemy.y);
      this.fxGroup.add(pm);
      const ang = Math.random() * Math.PI * 2;
      const spd = (isBoss ? 3.5 : 1.8) + Math.random() * (isBoss ? 4.5 : 2.5);
      deathParticles.push({
        mesh: pm,
        vx: Math.cos(ang) * spd,
        vy: (isBoss ? 3.5 : 1.8) + Math.random() * 3.5,
        vz: Math.sin(ang) * spd,
      });
    }

    const deathLight = new THREE.PointLight(pColor, isBoss ? 8.0 : 3.5, isBoss ? 14 : 7);
    deathLight.position.set(enemy.x, 1.0, enemy.y);
    this.fxGroup.add(deathLight);

    this.dyingActors.push({
      mesh,
      materials,
      particles: deathParticles,
      light: deathLight,
      life: totalLife,
      maxLife: totalLife,
      kind,
      isBoss,
      basePos: { x: enemy.x, y: enemy.y },
    });
  }

  /**
   * Rompe una vasija de cerámica en pedazos (Zelda pot smash).
   */
  triggerPotBreak(x, y) {
    if (!this.enabled) return;
    const group = new THREE.Group();
    group.position.set(x, 0.2, y);

    const shards = [];
    const shardGeom = new THREE.TetrahedronGeometry(0.065, 0);
    const shardMat = mat(0xc25e36, { roughness: 0.85 });

    for (let i = 0; i < 7; i++) {
      const sm = new THREE.Mesh(shardGeom, shardMat);
      group.add(sm);
      const ang = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const spd = 2.2 + Math.random() * 3.0;
      shards.push({
        mesh: sm,
        vx: Math.cos(ang) * spd,
        vy: 2.2 + Math.random() * 3.2,
        vz: Math.sin(ang) * spd,
        rx: Math.random() * 15,
        ry: Math.random() * 15,
      });
    }

    this.fxGroup.add(group);
    const totalLife = 0.38;
    this.activeVFX.push({
      mesh: group,
      particles: shards,
      maxLife: totalLife,
      life: totalLife,
      update: (dt, p) => {
        for (const s of shards) {
          s.mesh.rotation.x += s.rx * dt;
          s.mesh.rotation.y += s.ry * dt;
        }
      },
    });
  }

  /**
   * Corta un arbusto en hojas voladoras (Zelda grass slash).
   */
  triggerBushCut(x, y) {
    if (!this.enabled) return;
    const group = new THREE.Group();
    group.position.set(x, 0.2, y);

    const leaves = [];
    const leafGeom = new THREE.BoxGeometry(0.06, 0.01, 0.08);
    const leafMat = mat(0x4ade80, { roughness: 0.8 });

    for (let i = 0; i < 12; i++) {
      const lm = new THREE.Mesh(leafGeom, leafMat);
      group.add(lm);
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.8 + Math.random() * 2.8;
      leaves.push({
        mesh: lm,
        vx: Math.cos(ang) * spd,
        vy: 2.5 + Math.random() * 3.5,
        vz: Math.sin(ang) * spd,
        rx: (Math.random() - 0.5) * 12,
        ry: (Math.random() - 0.5) * 12,
      });
    }

    this.fxGroup.add(group);
    const totalLife = 0.42;
    this.activeVFX.push({
      mesh: group,
      particles: leaves,
      maxLife: totalLife,
      life: totalLife,
      update: (dt, p) => {
        for (const l of leaves) {
          l.mesh.rotation.x += l.rx * dt;
          l.mesh.rotation.y += l.ry * dt;
        }
      },
    });
  }

  /**
   * Espiral de bendición de la Gran Hada (Zelda Great Fairy blessing).
   */
  triggerFairyBlessing(x, y) {
    if (!this.enabled) return;
    const group = new THREE.Group();
    group.position.set(x, 0.3, y);

    const fairySparkles = [];
    const pGeom = new THREE.OctahedronGeometry(0.05, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
    for (let i = 0; i < 16; i++) {
      const pm = new THREE.Mesh(pGeom, pMat.clone());
      group.add(pm);
      const ang = (i / 16) * Math.PI * 2;
      fairySparkles.push({
        mesh: pm,
        baseAng: ang,
        radius: 0.6 + (i % 3) * 0.2,
        vy: 1.8 + (i % 4) * 0.4,
      });
    }

    const light = new THREE.PointLight(0xf472b6, 5.0, 9);
    light.position.set(x, 1.2, y);
    this.fxGroup.add(light);
    this.fxGroup.add(group);

    const totalLife = 0.75;
    this.activeVFX.push({
      mesh: group,
      light,
      maxLife: totalLife,
      life: totalLife,
      baseLightIntensity: light.intensity,
      update: (dt, p) => {
        for (const fs of fairySparkles) {
          const curAng = fs.baseAng + p * 8.0;
          fs.mesh.position.x = Math.cos(curAng) * fs.radius * (1 - p * 0.4);
          fs.mesh.position.z = Math.sin(curAng) * fs.radius * (1 - p * 0.4);
          fs.mesh.position.y += fs.vy * dt;
        }
      },
    });
  }

  /**
   * Dispara efectos visuales 3D espectaculares proporcionales al daño infligido.
   * Cubre Rayo de Zeus (descarga celestial con arco forzado, cráter de plasma y chispas)
   * y las habilidades de todas las clases del juego.
   */
  triggerSkillVFX({
    type = 'lightning',
    x = 0,
    y = 0,
    targetX = null,
    targetY = null,
    damage = 30,
    isCrit = false,
    color = null,
    dirX = 1,
    dirY = 0,
  } = {}) {
    if (!this.enabled) return;
    const tx = targetX !== null ? targetX : x;
    const ty = targetY !== null ? targetY : y;
    const damageRatio = Math.max(0.65, Math.min(3.5, (damage || 30) / 28));

    if (type === 'lightning') {
      const group = new THREE.Group();
      const skyY = 13 + damageRatio * 2.2;
      const boltCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const boltGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 });

      // Segmentos del rayo en zigzag desde el cielo hasta el objetivo
      const numSegments = 9;
      const points = [];
      points.push(new THREE.Vector3(tx + (Math.random() - 0.5) * 1.6, skyY, ty + (Math.random() - 0.5) * 1.6));
      for (let i = 1; i < numSegments; i++) {
        const frac = i / numSegments;
        const curY = skyY * (1 - frac);
        const zig = (1 - frac) * 0.8 * damageRatio;
        const px = tx + (Math.random() - 0.5) * zig;
        const pz = ty + (Math.random() - 0.5) * zig;
        points.push(new THREE.Vector3(px, curY, pz));
      }
      points.push(new THREE.Vector3(tx, 0.05, ty));

      const coreRadius = Math.max(0.04, 0.065 * damageRatio);
      const glowRadius = coreRadius * 2.6;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const segLen = p1.distanceTo(p2);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        const coreGeom = new THREE.CylinderGeometry(coreRadius, coreRadius, segLen, 6);
        const coreMesh = new THREE.Mesh(coreGeom, boltCoreMat);
        coreMesh.position.copy(mid);
        coreMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(p2, p1).normalize());
        group.add(coreMesh);

        const glowGeom = new THREE.CylinderGeometry(glowRadius, glowRadius, segLen, 6);
        const glowMesh = new THREE.Mesh(glowGeom, boltGlowMat);
        glowMesh.position.copy(mid);
        glowMesh.quaternion.copy(coreMesh.quaternion);
        group.add(glowMesh);
      }

      // Rama secundaria de descarga eléctrica
      if (points.length > 5) {
        const branchStart = points[4].clone();
        const branchEnd = new THREE.Vector3(
          branchStart.x + (Math.random() - 0.5) * 2.4 * damageRatio,
          branchStart.y * 0.45,
          branchStart.z + (Math.random() - 0.5) * 2.4 * damageRatio
        );
        const bLen = branchStart.distanceTo(branchEnd);
        const bMid = new THREE.Vector3().addVectors(branchStart, branchEnd).multiplyScalar(0.5);
        const bMesh = new THREE.Mesh(new THREE.CylinderGeometry(coreRadius * 0.7, coreRadius * 0.35, bLen, 5), boltGlowMat);
        bMesh.position.copy(bMid);
        bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(branchEnd, branchStart).normalize());
        group.add(bMesh);
      }

      // Anillo de onda de choque eléctrica en el suelo
      const ringGeom = new THREE.RingGeometry(0.1, 0.32 * damageRatio, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(tx, 0.04, ty);
      group.add(ringMesh);

      // Marca de impacto y plasma en el piso
      const scorchGeom = new THREE.CircleGeometry(0.55 * damageRatio, 24);
      const scorchMat = new THREE.MeshBasicMaterial({ color: 0x0369a1, transparent: true, opacity: 0.75 });
      const scorchMesh = new THREE.Mesh(scorchGeom, scorchMat);
      scorchMesh.rotation.x = -Math.PI / 2;
      scorchMesh.position.set(tx, 0.02, ty);
      group.add(scorchMesh);

      // Luz dinámica de relámpago
      const light = new THREE.PointLight(0x7dd3fc, 9.0 * damageRatio, 15 * damageRatio);
      light.position.set(tx, 1.3, ty);
      this.fxGroup.add(light);

      // Chispas de alta energía
      const particles = [];
      const sparkGeom = new THREE.OctahedronGeometry(0.045 * damageRatio);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
      const pCount = Math.floor(22 * damageRatio);
      for (let i = 0; i < pCount; i++) {
        const pm = new THREE.Mesh(sparkGeom, sparkMat.clone());
        pm.position.set(tx, 0.15, ty);
        group.add(pm);
        const ang = Math.random() * Math.PI * 2;
        const spd = (2.5 + Math.random() * 5.0) * damageRatio;
        particles.push({
          mesh: pm,
          vx: Math.cos(ang) * spd,
          vy: 2.8 + Math.random() * 5.5 * damageRatio,
          vz: Math.sin(ang) * spd,
        });
      }

      this.fxGroup.add(group);
      const totalLife = 0.44;
      this.activeVFX.push({
        mesh: group,
        light,
        particles,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const currentRadius = 0.32 * damageRatio + p * (2.8 * damageRatio);
          ringMesh.scale.set(currentRadius / (0.32 * damageRatio), currentRadius / (0.32 * damageRatio), 1);
          ringMat.opacity = Math.max(0, 0.95 * (1 - p * 1.25));
          scorchMat.opacity = Math.max(0, 0.75 * (1 - p * 0.85));
          if (p > 0.32) {
            boltCoreMat.transparent = true;
            boltCoreMat.opacity = Math.max(0, (0.55 - p) / 0.23);
            boltGlowMat.opacity = Math.max(0, (0.55 - p) / 0.23);
          }
        },
      });
    } else if (type === 'whirlwind') {
      const group = new THREE.Group();
      group.position.set(x, 0.35, y);
      const r1 = 0.9 * damageRatio;
      const r2 = 1.35 * damageRatio;
      const bladeMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(r1, 0.08 * damageRatio, 8, 24), bladeMat);
      ring1.rotation.x = Math.PI / 2;
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r2, 0.06 * damageRatio, 8, 24), bladeMat);
      ring2.rotation.x = Math.PI / 2;
      group.add(ring1, ring2);

      const light = new THREE.PointLight(0xef4444, 4.5 * damageRatio, 9 * damageRatio);
      light.position.set(x, 1.0, y);
      this.fxGroup.add(light);

      const particles = [];
      const pGeom = new THREE.OctahedronGeometry(0.04 * damageRatio);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xf87171 });
      const pCount = Math.floor(18 * damageRatio);
      for (let i = 0; i < pCount; i++) {
        const pm = new THREE.Mesh(pGeom, pMat.clone());
        pm.position.set(x, 0.25, y);
        group.add(pm);
        const ang = (i / pCount) * Math.PI * 2;
        const spd = (3.0 + Math.random() * 3.5) * damageRatio;
        particles.push({
          mesh: pm,
          vx: Math.cos(ang) * spd,
          vy: 1.5 + Math.random() * 3.0,
          vz: Math.sin(ang) * spd,
        });
      }

      this.fxGroup.add(group);
      const totalLife = 0.52;
      this.activeVFX.push({
        mesh: group,
        light,
        particles,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          group.rotation.y += dt * 26;
          const s = 1 + p * 0.85;
          ring1.scale.set(s, s, 1);
          ring2.scale.set(s, s, 1);
          bladeMat.opacity = Math.max(0, 0.85 * (1 - p));
        },
      });
    } else if (type === 'shout') {
      const group = new THREE.Group();
      group.position.set(x, 0.08, y);
      const ringGeom = new THREE.TorusGeometry(0.5, 0.09 * damageRatio, 8, 30);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.85 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      group.add(ringMesh);

      const light = new THREE.PointLight(0xfb923c, 4.0 * damageRatio, 10 * damageRatio);
      light.position.set(x, 1.2, y);
      this.fxGroup.add(light);

      this.fxGroup.add(group);
      const totalLife = 0.45;
      this.activeVFX.push({
        mesh: group,
        light,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const r = 1 + p * (4.2 * damageRatio);
          ringMesh.scale.set(r, r, 1);
          ringMat.opacity = Math.max(0, 0.85 * (1 - p));
        },
      });
    } else if (type === 'shield_slam') {
      const group = new THREE.Group();
      group.position.set(x, 0.35, y);
      const arcGeom = new THREE.TorusGeometry(0.85 * damageRatio, 0.12 * damageRatio, 8, 20, Math.PI * 0.85);
      const arcMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9 });
      const arcMesh = new THREE.Mesh(arcGeom, arcMat);
      arcMesh.rotation.x = Math.PI / 2;
      const aimAng = Math.atan2(dirY, dirX);
      arcMesh.rotation.z = -aimAng - Math.PI * 0.42;
      group.add(arcMesh);

      const light = new THREE.PointLight(0xfacc15, 5.0 * damageRatio, 9 * damageRatio);
      light.position.set(x + dirX * 0.8, 1.0, y + dirY * 0.8);
      this.fxGroup.add(light);

      const particles = [];
      const sparkGeom = new THREE.OctahedronGeometry(0.045 * damageRatio);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const pCount = Math.floor(16 * damageRatio);
      for (let i = 0; i < pCount; i++) {
        const pm = new THREE.Mesh(sparkGeom, sparkMat.clone());
        pm.position.set(x + dirX * 0.4, 0.35, y + dirY * 0.4);
        group.add(pm);
        const spread = (Math.random() - 0.5) * 1.1;
        const spd = (3.5 + Math.random() * 4.5) * damageRatio;
        const curAng = aimAng + spread;
        particles.push({
          mesh: pm,
          vx: Math.cos(curAng) * spd,
          vy: 1.5 + Math.random() * 3.5,
          vz: Math.sin(curAng) * spd,
        });
      }

      this.fxGroup.add(group);
      const totalLife = 0.38;
      this.activeVFX.push({
        mesh: group,
        light,
        particles,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          group.position.x += dirX * dt * 2.5;
          group.position.z += dirY * dt * 2.5;
          arcMesh.scale.multiplyScalar(1 + dt * 1.5);
          arcMat.opacity = Math.max(0, 0.9 * (1 - p));
        },
      });
    } else if (type === 'solar_nova') {
      const group = new THREE.Group();
      group.position.set(x, 0.05, y);
      const col = color ? new THREE.Color(color) : new THREE.Color(0xfacc15);
      const ringGeom = new THREE.RingGeometry(0.2, 0.5 * damageRatio, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      group.add(ringMesh);

      // Rayos solares ascendentes
      const rays = [];
      const rayGeom = new THREE.CylinderGeometry(0.04 * damageRatio, 0.09 * damageRatio, 5.5, 6);
      const rayMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.65 });
      for (let i = 0; i < 5; i++) {
        const ray = new THREE.Mesh(rayGeom, rayMat.clone());
        const ra = (i / 5) * Math.PI * 2;
        const rr = 0.8 * damageRatio;
        ray.position.set(Math.cos(ra) * rr, 2.7, Math.sin(ra) * rr);
        group.add(ray);
        rays.push(ray);
      }

      const light = new THREE.PointLight(col, 6.5 * damageRatio, 13 * damageRatio);
      light.position.set(x, 1.6, y);
      this.fxGroup.add(light);

      this.fxGroup.add(group);
      const totalLife = 0.55;
      this.activeVFX.push({
        mesh: group,
        light,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const sc = 1 + p * (4.2 * damageRatio);
          ringMesh.scale.set(sc, sc, 1);
          ringMat.opacity = Math.max(0, 0.88 * (1 - p));
          for (const ray of rays) {
            ray.position.y += dt * 3.5;
            ray.material.opacity = Math.max(0, 0.65 * (1 - p));
          }
        },
      });
    } else if (type === 'lunar_arrow') {
      const group = new THREE.Group();
      const col = new THREE.Color(0x4ade80);
      const ringGeom = new THREE.RingGeometry(0.1, 0.3 * damageRatio, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(tx, 0.1, ty);
      group.add(ringMesh);

      // Haz lunar a lo largo de la trayectoria
      const dx = tx - x;
      const dz = ty - y;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.5) {
        const beamGeom = new THREE.CylinderGeometry(0.045 * damageRatio, 0.045 * damageRatio, dist, 6);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.75 });
        const beam = new THREE.Mesh(beamGeom, beamMat);
        beam.position.set(x + dx * 0.5, 0.35, y + dz * 0.5);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, dz).normalize());
        group.add(beam);
      }

      const light = new THREE.PointLight(0x4ade80, 4.5 * damageRatio, 9 * damageRatio);
      light.position.set(tx, 1.0, ty);
      this.fxGroup.add(light);

      this.fxGroup.add(group);
      const totalLife = 0.38;
      this.activeVFX.push({
        mesh: group,
        light,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const sc = 1 + p * (2.8 * damageRatio);
          ringMesh.scale.set(sc, sc, 1);
          ringMat.opacity = Math.max(0, 0.85 * (1 - p));
        },
      });
    } else if (type === 'salva') {
      const group = new THREE.Group();
      group.position.set(x, 0.1, y);
      const ringGeom = new THREE.TorusGeometry(0.7 * damageRatio, 0.06 * damageRatio, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.8 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      group.add(ringMesh);

      const light = new THREE.PointLight(0x22c55e, 3.5, 8);
      light.position.set(x, 1.0, y);
      this.fxGroup.add(light);

      this.fxGroup.add(group);
      const totalLife = 0.45;
      this.activeVFX.push({
        mesh: group,
        light,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          group.position.y += dt * 1.8;
          group.rotation.y += dt * 6;
          ringMat.opacity = Math.max(0, 0.8 * (1 - p));
        },
      });
    } else if (type === 'caronte_spear') {
      const group = new THREE.Group();
      const col = new THREE.Color(0xc084fc);
      const ringGeom = new THREE.RingGeometry(0.1, 0.3 * damageRatio, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(tx, 0.1, ty);
      group.add(ringMesh);

      const light = new THREE.PointLight(col, 4.0 * damageRatio, 9 * damageRatio);
      light.position.set(tx, 1.0, ty);
      this.fxGroup.add(light);

      this.fxGroup.add(group);
      const totalLife = 0.38;
      this.activeVFX.push({
        mesh: group,
        light,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const sc = 1 + p * (2.6 * damageRatio);
          ringMesh.scale.set(sc, sc, 1);
          ringMat.opacity = Math.max(0, 0.85 * (1 - p));
        },
      });
    } else if (type === 'atropos_void') {
      const group = new THREE.Group();
      group.position.set(tx, 0.02, ty);
      const col = new THREE.Color(0xa855f7);

      const ringGeom = new THREE.RingGeometry(0.2, 0.5 * damageRatio, 30);
      const ringMat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      group.add(ringMesh);

      // Columna de hueso / energía estigia que brota del suelo
      const pillarGeom = new THREE.CylinderGeometry(0.15 * damageRatio, 0.45 * damageRatio, 3.5 * damageRatio, 8);
      const pillarMat = new THREE.MeshBasicMaterial({ color: 0x581c87, transparent: true, opacity: 0.85 });
      const pillarMesh = new THREE.Mesh(pillarGeom, pillarMat);
      pillarMesh.position.y = 1.75 * damageRatio;
      group.add(pillarMesh);

      const light = new THREE.PointLight(col, 7.0 * damageRatio, 12 * damageRatio);
      light.position.set(tx, 1.5, ty);
      this.fxGroup.add(light);

      // Vapores y almas espectrales ascendiendo
      const particles = [];
      const pGeom = new THREE.OctahedronGeometry(0.045 * damageRatio);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xe9d5ff });
      const pCount = Math.floor(20 * damageRatio);
      for (let i = 0; i < pCount; i++) {
        const pm = new THREE.Mesh(pGeom, pMat.clone());
        pm.position.set(0, 0.2, 0);
        group.add(pm);
        const ang = Math.random() * Math.PI * 2;
        const spd = (1.5 + Math.random() * 2.5) * damageRatio;
        particles.push({
          mesh: pm,
          vx: Math.cos(ang) * spd,
          vy: 2.0 + Math.random() * 4.5 * damageRatio,
          vz: Math.sin(ang) * spd,
        });
      }

      this.fxGroup.add(group);
      const totalLife = 0.55;
      this.activeVFX.push({
        mesh: group,
        light,
        particles,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const sc = 1 + p * (3.4 * damageRatio);
          ringMesh.scale.set(sc, sc, 1);
          ringMat.opacity = Math.max(0, 0.9 * (1 - p));
          pillarMesh.scale.y = 1 + p * 0.5;
          pillarMat.opacity = Math.max(0, 0.85 * (1 - p * 1.2));
        },
      });
    } else if (type === 'erinias_slash') {
      const group = new THREE.Group();
      group.position.set(tx, 0.45, ty);
      const slashCol = new THREE.Color(0xf472b6);
      const slashMat = new THREE.MeshBasicMaterial({ color: slashCol, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });

      // Cuchillas cruzadas luminosas en 'X'
      const len = 1.35 * damageRatio;
      const w = 0.09 * damageRatio;
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(len, w, 0.04), slashMat);
      b1.rotation.z = Math.PI / 4;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(len, w, 0.04), slashMat);
      b2.rotation.z = -Math.PI / 4;
      group.add(b1, b2);

      const light = new THREE.PointLight(slashCol, 5.5 * damageRatio, 9 * damageRatio);
      light.position.set(tx, 1.0, ty);
      this.fxGroup.add(light);

      const particles = [];
      const pGeom = new THREE.OctahedronGeometry(0.04 * damageRatio);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xfce7f3 });
      const pCount = Math.floor(16 * damageRatio);
      for (let i = 0; i < pCount; i++) {
        const pm = new THREE.Mesh(pGeom, pMat.clone());
        pm.position.set(0, 0, 0);
        group.add(pm);
        const ang = Math.random() * Math.PI * 2;
        const spd = (2.5 + Math.random() * 4.0) * damageRatio;
        particles.push({
          mesh: pm,
          vx: Math.cos(ang) * spd,
          vy: 1.5 + Math.random() * 3.5,
          vz: Math.sin(ang) * spd,
        });
      }

      this.fxGroup.add(group);
      const totalLife = 0.36;
      this.activeVFX.push({
        mesh: group,
        light,
        particles,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const sc = 1 + p * 0.75;
          b1.scale.set(sc, sc, 1);
          b2.scale.set(sc, sc, 1);
          slashMat.opacity = Math.max(0, 0.95 * (1 - p));
        },
      });
    } else if (type === 'sentinel_burst') {
      const group = new THREE.Group();
      group.position.set(x, 0.35, y);
      const ringGeom = new THREE.TorusGeometry(0.6 * damageRatio, 0.06 * damageRatio, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.85 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      group.add(ringMesh);

      const light = new THREE.PointLight(0xec4899, 4.0, 9);
      light.position.set(x, 1.0, y);
      this.fxGroup.add(light);

      this.fxGroup.add(group);
      const totalLife = 0.38;
      this.activeVFX.push({
        mesh: group,
        light,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const sc = 1 + p * (3.0 * damageRatio);
          ringMesh.scale.set(sc, sc, 1);
          ringMat.opacity = Math.max(0, 0.85 * (1 - p));
        },
      });
    } else if (type === 'earth_shatter') {
      const group = new THREE.Group();
      group.position.set(x, 0, y);
      const rockMat = mat(0x78716c, { roughness: 0.9, metalness: 0.1 });
      const numSpikes = Math.floor(10 + damageRatio * 3);
      const spikes = [];

      for (let i = 0; i < numSpikes; i++) {
        const ang = (i / numSpikes) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const rad = (1.5 + Math.random() * 1.3) * damageRatio;
        const spikeH = (0.6 + Math.random() * 0.9) * damageRatio;
        const spMesh = new THREE.Mesh(new THREE.ConeGeometry(0.16 * damageRatio, spikeH, 5), rockMat);
        spMesh.position.set(Math.cos(ang) * rad, spikeH * 0.5, Math.sin(ang) * rad);
        spMesh.rotation.x = (Math.random() - 0.5) * 0.35;
        spMesh.rotation.z = (Math.random() - 0.5) * 0.35;
        group.add(spMesh);
        spikes.push(spMesh);
      }

      const light = new THREE.PointLight(0x84cc16, 5.5 * damageRatio, 11 * damageRatio);
      light.position.set(x, 1.4, y);
      this.fxGroup.add(light);

      const particles = [];
      const pGeom = new THREE.BoxGeometry(0.08 * damageRatio, 0.08 * damageRatio, 0.08 * damageRatio);
      const pMat = mat(0x57534e);
      const pCount = Math.floor(18 * damageRatio);
      for (let i = 0; i < pCount; i++) {
        const pm = new THREE.Mesh(pGeom, pMat);
        pm.position.set(0, 0.2, 0);
        group.add(pm);
        const ang = Math.random() * Math.PI * 2;
        const spd = (2.2 + Math.random() * 4.0) * damageRatio;
        particles.push({
          mesh: pm,
          vx: Math.cos(ang) * spd,
          vy: 2.5 + Math.random() * 4.5 * damageRatio,
          vz: Math.sin(ang) * spd,
        });
      }

      this.fxGroup.add(group);
      const totalLife = 0.55;
      this.activeVFX.push({
        mesh: group,
        light,
        particles,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          if (p > 0.45) {
            for (const sp of spikes) {
              sp.position.y -= dt * 1.5;
            }
          }
        },
      });
    } else if (type === 'licaon_roar') {
      const group = new THREE.Group();
      group.position.set(x, 0.1, y);
      const ringGeom = new THREE.TorusGeometry(0.6 * damageRatio, 0.08 * damageRatio, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.85 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      group.add(ringMesh);

      // Zarpazo de garras espectrales
      const clawMat = new THREE.MeshBasicMaterial({ color: 0xa3e635, transparent: true, opacity: 0.9 });
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.BoxGeometry(0.8 * damageRatio, 0.05, 0.02), clawMat);
        claw.position.set(c * 0.22 * damageRatio, 0.35, 0.5 * damageRatio);
        claw.rotation.y = -Math.PI / 6;
        group.add(claw);
      }

      const light = new THREE.PointLight(0x84cc16, 4.5 * damageRatio, 9 * damageRatio);
      light.position.set(x, 1.2, y);
      this.fxGroup.add(light);

      this.fxGroup.add(group);
      const totalLife = 0.42;
      this.activeVFX.push({
        mesh: group,
        light,
        maxLife: totalLife,
        life: totalLife,
        baseLightIntensity: light.intensity,
        update: (dt, p) => {
          const sc = 1 + p * (3.5 * damageRatio);
          ringMesh.scale.set(sc, sc, 1);
          ringMat.opacity = Math.max(0, 0.85 * (1 - p));
          clawMat.opacity = Math.max(0, 0.9 * (1 - p));
        },
      });
    }
  }

  _updateVFX(dt) {
    if (!this.activeVFX || this.activeVFX.length === 0) return;
    for (let i = this.activeVFX.length - 1; i >= 0; i--) {
      const vfx = this.activeVFX[i];
      vfx.life -= dt;
      const p = 1 - Math.max(0, vfx.life / vfx.maxLife);

      if (vfx.update) {
        vfx.update(dt, p);
      }

      if (vfx.particles && vfx.particles.length > 0) {
        for (const pt of vfx.particles) {
          pt.mesh.position.x += pt.vx * dt;
          pt.mesh.position.y += pt.vy * dt;
          pt.mesh.position.z += pt.vz * dt;
          pt.vy -= 15.0 * dt;
          if (pt.mesh.position.y < 0.03) {
            pt.mesh.position.y = 0.03;
            pt.vx *= 0.65;
            pt.vz *= 0.65;
            pt.vy = 0;
          }
          if (pt.mesh.material) {
            pt.mesh.material.opacity = Math.max(0, 1 - p * 1.25);
            pt.mesh.material.transparent = true;
          }
        }
      }

      if (vfx.light) {
        vfx.light.intensity = Math.max(0, vfx.baseLightIntensity * (1 - p));
      }

      if (vfx.life <= 0) {
        if (vfx.mesh) {
          this.fxGroup.remove(vfx.mesh);
          disposeObject3D(vfx.mesh);
        }
        if (vfx.light) {
          this.fxGroup.remove(vfx.light);
        }
        this.activeVFX.splice(i, 1);
      }
    }
  }

  /** Renderiza el fotograma 3D sincronizado con el estado de ArchGame */
  render(game, dt = 0.016) {
    if (!this.enabled || !game.dungeon) return;

    const { dungeon, hero, pos, enemies, groundDrops, projectiles, cam } = game;
    const { isOverworld, isFinalFloor } = dungeon;
    const now = performance.now() * 0.001;

    // 1. Asegurar que el modelo 3D del héroe coincide con la clase actual
    if (!this.heroMesh || this.heroClassId !== hero.classId) {
      if (this.heroMesh) {
        this.actorsGroup.remove(this.heroMesh);
        disposeObject3D(this.heroMesh);
      }
      this.heroMesh = createHeroMesh3D(hero.classId);
      this.heroClassId = hero.classId;
      this.actorsGroup.add(this.heroMesh);
      this.lastHeroPos = { x: pos.x, y: pos.y };
      this.lastEquippedKey = null;
    }

    // Sincronizar visualmente el equipamiento del héroe si ha cambiado
    const eq = hero.equipment || {};
    const eqKey = `${eq.weapon?.id || ''}:${eq.armor?.id || ''}:${eq.charm?.id || ''}`;
    if (this.lastEquippedKey !== eqKey) {
      this.lastEquippedKey = eqKey;
      updateHeroEquipmentVisuals(this.heroMesh, eq, hero.classId);
    }

    // 2. Sincronizar cámara ortográfica con `game.cam` (proyección 2:1 idéntica a toIso)
    const camGridX = (cam.x / 28 + cam.y / 14) / 2;
    const camGridY = (cam.y / 14 - cam.x / 28) / 2;
    const dist = 60;
    this.camera.position.set(camGridX + dist, dist * CAM_ELEV_Y, camGridY + dist);
    this.camera.lookAt(camGridX, 0, camGridY);

    // Actualizar luz direccional y ciclo día/noche en el mundo exterior (Hélade / Hyrule Field)
    if (isOverworld) {
      const dayTime = typeof game.dayTime === 'number' ? game.dayTime : 0.25;
      const sunAngle = dayTime * Math.PI * 2;
      const sunDist = 18;
      const sunX = pos.x - Math.cos(sunAngle) * sunDist;
      const sunY = Math.max(3, Math.sin(sunAngle) * 22);
      const sunZ = pos.y + Math.sin(sunAngle) * sunDist;
      this.dirLight.position.set(sunX, sunY, sunZ);
      this.dirLight.target.position.set(pos.x, 0, pos.y);

      if (dayTime >= 0.44 && dayTime < 0.6) {
        // Atardecer cálido / Crepúsculo
        this.dirLight.color.set(0xf97316);
        this.dirLight.intensity = 1.6;
        this.ambientLight.color.set(0x701a75);
        this.ambientLight.intensity = 0.95;
        this.renderer?.setClearColor?.(0x3b112c, 1);
        this.heroLight.intensity = 1.6;
      } else if (dayTime >= 0.6 && dayTime < 0.88) {
        // Noche cerrada con luna plateada y luciérnagas vivas
        this.dirLight.color.set(0x93c5fd);
        this.dirLight.intensity = 0.75;
        this.ambientLight.color.set(0x1e293b);
        this.ambientLight.intensity = 0.52;
        this.renderer?.setClearColor?.(0x060c18, 1);
        this.heroLight.intensity = 2.4;
      } else if (dayTime >= 0.88 || dayTime < 0.12) {
        // Amanecer dorado
        this.dirLight.color.set(0xfde68a);
        this.dirLight.intensity = 1.45;
        this.ambientLight.color.set(0x93c5fd);
        this.ambientLight.intensity = 1.1;
        this.renderer?.setClearColor?.(0x132742, 1);
        this.heroLight.intensity = 1.4;
      } else {
        // Mediodía radiante
        this.dirLight.color.set(0xfffbeb);
        this.dirLight.intensity = 1.95;
        this.ambientLight.color.set(0xe0f2fe);
        this.ambientLight.intensity = 1.45;
        this.renderer?.setClearColor?.(0x163954, 1);
        this.heroLight.intensity = 1.1;
      }
    } else {
      this.dirLight.position.set(pos.x - 9, 18, pos.y + 6);
      this.dirLight.target.position.set(pos.x, 0, pos.y);
      this.heroLight.intensity = isFinalFloor ? 2.0 : 1.8;
    }
    this.heroLight.position.set(pos.x, 1.75, pos.y);
    this.heroLight.color.set(HERO_CLASSES[hero.classId]?.color || '#f59e0b');

    // 3. Visibilidad de celdas (Niebla de Guerra optimizada con matPair)
    const { width, height, explored } = dungeon;
    const dimFallback = isOverworld ? 0.72 : 0.35;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileObj = this.tileMeshes[y]?.[x];
        if (!tileObj) continue;
        const vis = explored[y][x];
        tileObj.visible = vis > 0;
        if (vis > 0 && tileObj.userData.lastVis !== vis) {
          tileObj.userData.lastVis = vis;
          const dim = vis === 2 ? 1.0 : dimFallback;
          tileObj.traverse((c) => {
            if (c.isMesh && c.userData.matPair) {
              c.material = vis === 2 ? c.userData.matPair.lit : c.userData.matPair.dim;
            } else if (c.isMesh && c.material) {
              if (!c.userData.baseColor) c.userData.baseColor = c.material.color.clone();
              c.material.color.copy(c.userData.baseColor).multiplyScalar(dim);
            }
          });
        }
      }
    }

    // 3b. Mundo vivo: olas de agua, vegetación/ruinas, barca y fauna en Nivel 1
    if (isOverworld) {
      if (this.waterMeshes) {
        for (const w of this.waterMeshes) {
          w.mesh.position.y = w.baseY + Math.sin(now * 2.5 + w.x * 0.65 + w.y * 0.45) * 0.022;
        }
      }
      if (this.sceneryPropMeshes) {
        for (const pm of this.sceneryPropMeshes) {
          const vis = explored[pm.userData.tileY]?.[pm.userData.tileX] || 0;
          pm.visible = vis > 0;
        }
      }
      if (this.boatMeshes) {
        for (const bm of this.boatMeshes) {
          if (bm.visible) {
            bm.position.y = -0.06 + Math.sin(now * 2.1) * 0.025;
            bm.rotation.z = Math.sin(now * 1.7) * 0.06;
          }
        }
      }
      if (this.critterMeshes) {
        for (const cm of this.critterMeshes) {
          const d = cm.userData;
          const vis = explored[Math.floor(d.baseY)]?.[Math.floor(d.baseX)] === 2;
          cm.visible = vis;
          if (!vis) continue;
          const t = now * 1.4 + d.phase;
          cm.position.x = d.baseX + Math.sin(t * 0.9) * 1.1;
          cm.position.z = d.baseY + Math.cos(t * 0.7) * 1.1;
          cm.position.y = 0.42 + Math.sin(t * 2.3) * 0.16;
          if (d.kind === 'butterfly') {
            const flap = Math.sin(now * 16 + d.phase) * 0.65;
            d.leftWing.rotation.y = flap;
            d.rightWing.rotation.y = -flap;
            cm.rotation.y = Math.atan2(Math.cos(t * 0.9), -Math.sin(t * 0.7));
          }
        }
      }
    }

    // 4. Animar Altar de Asclepio, Cofres y Sibila
    if (this.shrineGroup?.userData?.crystal) {
      const cry = this.shrineGroup.userData.crystal;
      cry.rotation.y = now * 1.8;
      cry.position.y = 0.44 + Math.sin(now * 3) * 0.05;
      cry.visible = !dungeon.shrine?.used;
    }

    for (const [c, mesh] of this.chestMeshes.entries()) {
      const vis = explored[Math.floor(c.y)]?.[Math.floor(c.x)] === 2;
      mesh.visible = vis;
      if (mesh.userData.lidPivot) {
        const targetRot = c.opened ? -1.25 : 0;
        mesh.userData.lidPivot.rotation.x += (targetRot - mesh.userData.lidPivot.rotation.x) * 0.2;
      }
    }

    // 4b. Animar vasijas, arbustos y Fuentes de las Grandes Hadas (estilo Zelda OoT)
    if (this.potMeshes && dungeon.pots) {
      for (const [pot, mesh] of this.potMeshes.entries()) {
        const vis = explored[Math.floor(pot.y)]?.[Math.floor(pot.x)] === 2;
        mesh.visible = vis && !pot.broken;
      }
    }

    if (this.bushMeshes && dungeon.bushes) {
      for (const [bush, mesh] of this.bushMeshes.entries()) {
        const vis = explored[Math.floor(bush.y)]?.[Math.floor(bush.x)] === 2;
        mesh.visible = vis && !bush.cut;
      }
    }

    if (this.fairyMeshes && dungeon.fairyFountains) {
      for (const [fountain, mesh] of this.fairyMeshes.entries()) {
        const vis = explored[Math.floor(fountain.y)]?.[Math.floor(fountain.x)] === 2;
        mesh.visible = vis;
        if (vis && mesh.userData.fairyGroup) {
          const fg = mesh.userData.fairyGroup;
          fg.position.y = 0.58 + Math.sin(now * 3.0) * 0.08;
          fg.rotation.y = now * 1.6;
          for (const w of mesh.userData.wings || []) {
            w.mesh.rotation.y = Math.sin(now * 26.0) * 0.6 * w.sx;
          }
          if (mesh.userData.fairyLight) {
            mesh.userData.fairyLight.intensity = 2.8 + Math.sin(now * 8.0) * 0.6;
          }
        }
      }
    }

    // Partículas ambientales de los Templos
    if (this.ambientParticles && this.ambientParticles.length > 0) {
      for (const ap of this.ambientParticles) {
        const vis = explored[Math.floor(ap.baseY)]?.[Math.floor(ap.baseX)] === 2;
        ap.mesh.visible = vis;
        if (!vis) continue;
        const t = now * 1.2 + ap.phase;
        ap.mesh.position.x = ap.baseX + Math.sin(t * 0.8) * 0.65;
        ap.mesh.position.z = ap.baseY + Math.cos(t * 0.9) * 0.65;
        if (ap.kind === 'embers' || ap.kind === 'bubbles') {
          ap.mesh.position.y += ap.speedY * dt;
          if (ap.mesh.position.y > 2.0) ap.mesh.position.y = 0.15;
        } else {
          ap.mesh.position.y = ap.baseZ + Math.sin(t * 1.5) * 0.22;
        }
      }
    }

    if (this.npcGroup && dungeon.npc) {
      const vis = explored[Math.floor(dungeon.npc.y)]?.[Math.floor(dungeon.npc.x)] === 2;
      this.npcGroup.visible = vis;
      if (vis) {
        const { oracleRing, outerFlame, innerFlame } = this.npcGroup.userData;
        oracleRing.rotation.z = now * 1.2;
        outerFlame.scale.y = 0.9 + Math.sin(now * 14) * 0.18;
        innerFlame.scale.y = 0.9 + Math.cos(now * 18) * 0.2;
        this.campfireLight.intensity = 2.2 + Math.sin(now * 15) * 0.35;
      }
    }

    // 5. Actualizar posición, orientación y animación 3D del Héroe
    const dx = pos.x - this.lastHeroPos.x;
    const dy = pos.y - this.lastHeroPos.y;
    const heroSpeedSq = (dx * dx + dy * dy) / Math.max(0.00001, dt * dt);
    const heroMoving = heroSpeedSq > 0.08;
    let heroFacing = this.heroMesh.userData.rig.facing;

    if (heroMoving) {
      heroFacing = Math.atan2(dx, dy);
    } else if (game.attackTargetId) {
      const t = enemies.find((e) => e.id === game.attackTargetId && e.hp > 0);
      if (t) heroFacing = Math.atan2(t.x - pos.x, t.y - pos.y);
    }
    this.lastHeroPos.x = pos.x;
    this.lastHeroPos.y = pos.y;

    this.heroMesh.position.set(pos.x, 0, pos.y);
    const nowMs = Date.now();
    updateActorRig3D(this.heroMesh, {
      dt,
      moving: heroMoving,
      targetFacing: heroFacing,
      furyActive: (hero.buffs?.furyUntil || 0) > nowMs,
      shieldActive: (hero.buffs?.shieldUntil || 0) > nowMs,
    });

    // 6. Sincronizar y animar Enemigos 3D
    const activeIds = new Set();
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      activeIds.add(e.id);
      let eMesh = this.enemyMeshes.get(e.id);
      if (!eMesh) {
        eMesh = createEnemyMesh3D(e);
        this.enemyMeshes.set(e.id, eMesh);
        this.actorsGroup.add(eMesh);
      }
      const vis = explored[Math.floor(e.y)]?.[Math.floor(e.x)] === 2;
      eMesh.visible = vis;
      if (!vis) continue;

      const rig = eMesh.userData.rig;
      if (e.hp < rig.lastHp) {
        rig.hitFlashTimer = 0.14;
        rig.lastHp = e.hp;
      }
      if (e.cdLeft > 0.75 && rig.attackTimer <= 0) {
        rig.attackTimer = 0.26;
      }

      const edx = e.x - eMesh.position.x;
      const edy = e.y - eMesh.position.z;
      const eMoving = e.state === 'chase' && Math.hypot(edx, edy) / Math.max(0.001, dt) > 0.15;
      const eFacing = e.state === 'chase' ? Math.atan2(pos.x - e.x, pos.y - e.y) : rig.facing;

      eMesh.position.set(e.x, 0, e.y);
      updateActorRig3D(eMesh, { dt, moving: eMoving, targetFacing: eFacing });
    }

    // Limpiar enemigos derrotados (que no hayan iniciado animación de muerte)
    for (const [id, mesh] of this.enemyMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.actorsGroup.remove(mesh);
        this.enemyMeshes.delete(id);
      }
    }

    // Actualizar animación de muerte de enemigos (desvanecimiento y supernova estilo Zelda)
    if (this.dyingActors && this.dyingActors.length > 0) {
      for (let i = this.dyingActors.length - 1; i >= 0; i--) {
        const da = this.dyingActors[i];
        da.life -= dt;
        const p = 1 - Math.max(0, da.life / da.maxLife);

        if (da.isBoss) {
          da.mesh.position.x = da.basePos.x + (Math.random() - 0.5) * (0.09 * (1 + p));
          da.mesh.position.z = da.basePos.y + (Math.random() - 0.5) * (0.09 * (1 + p));
          const sc = 1.0 + Math.sin(p * Math.PI * 4) * 0.1;
          da.mesh.scale.set(sc, sc, sc);
        } else {
          da.mesh.rotation.x += dt * 3.2;
          da.mesh.position.y = Math.max(-0.25, da.mesh.position.y - dt * 0.45);
        }

        for (const m of da.materials) {
          m.opacity = Math.max(0, 1.0 - p * 1.15);
        }

        if (da.light) {
          da.light.intensity = Math.max(0, (da.isBoss ? 8 : 3.5) * (1 - p));
        }

        if (da.life <= 0) {
          this.actorsGroup.remove(da.mesh);
          disposeObject3D(da.mesh);
          if (da.light) this.fxGroup.remove(da.light);
          this.dyingActors.splice(i, 1);
        }
      }
    }

    // 7. Botín 3D en el suelo y Proyectiles 3D
    this._syncGroundDrops(groundDrops, now);
    this._syncProjectiles(projectiles);

    // 8. Actualizar efectos visuales 3D y partículas de habilidades
    this._updateVFX(dt);

    this.renderer.render(this.scene, this.camera);
  }

  _syncGroundDrops(groundDrops, now) {
    if (!this.dropMeshesMap) {
      this.dropMeshesMap = new Map();
    }
    const activeDrops = new Set(groundDrops);

    // Limpiar ítems que ya fueron recogidos
    for (const [drop, mesh] of this.dropMeshesMap.entries()) {
      if (!activeDrops.has(drop)) {
        this.fxGroup.remove(mesh);
        disposeObject3D(mesh);
        this.dropMeshesMap.delete(drop);
      }
    }

    // Instanciar o actualizar cada botín activo en el suelo con sus modelos 3D y columna de luz
    for (let i = 0; i < groundDrops.length; i++) {
      const d = groundDrops[i];
      let mesh = this.dropMeshesMap.get(d);
      if (!mesh) {
        mesh = createGroundDropMesh3D(d);
        this.fxGroup.add(mesh);
        this.dropMeshesMap.set(d, mesh);
      }
      mesh.position.set(d.x, 0, d.y);
      const bob = mesh.getObjectByName('bobGroup');
      if (bob) {
        bob.position.y = 0.16 + Math.sin(now * 3.5 + i * 0.8) * 0.04;
        bob.rotation.y = now * 1.8 + i * 0.6;
      }
    }
    this.dropMeshes = Array.from(this.dropMeshesMap.values());
  }

  _syncProjectiles(projectiles) {
    while (this.projMeshes.length > projectiles.length) {
      const m = this.projMeshes.pop();
      this.fxGroup.remove(m);
      disposeObject3D(m);
    }
    while (this.projMeshes.length < projectiles.length) {
      const group = new THREE.Group();
      // Núcleo luminoso del proyectil
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.38, 6),
        mat(0x38bdf8, { emissive: 0x38bdf8, emissiveIntensity: 1.6, roughness: 0.2 })
      );
      head.rotation.x = Math.PI / 2;
      group.add(head);

      // Cola / estela luminosa
      const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.065, 0.32, 5),
        mat(0xffffff, { emissive: 0x38bdf8, emissiveIntensity: 1.2, transparent: true, opacity: 0.75 })
      );
      tail.rotation.x = Math.PI / 2;
      tail.position.z = -0.22;
      group.add(tail);

      group.userData = { head, tail };
      this.fxGroup.add(group);
      this.projMeshes.push(group);
    }
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      const m = this.projMeshes[i];
      const col = p.color || '#38bdf8';
      m.userData.head.material.color.set(col);
      m.userData.head.material.emissive.set(col);
      m.userData.tail.material.emissive.set(col);
      m.position.set(p.x, 0.32, p.y);
      const ang = Math.atan2(p.vx, p.vy);
      m.rotation.y = -ang + Math.PI / 2;
      const s = p.pierce ? 1.4 : 1.0;
      m.scale.set(s, s, s);
    }
  }
}

/**
 * Vista previa 3D interactiva (Turntable) para el selector de héroes en la Hoguera del Aqueronte.
 */
export class HeroPreview3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.enabled = false;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.setSize(canvas.width || 150, canvas.height || 150, false);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(34, (canvas.width || 150) / (canvas.height || 150), 0.1, 20);
      this.camera.position.set(0, 0.82, 2.05);
      this.camera.lookAt(0, 0.42, 0);

      const amb = new THREE.AmbientLight(0x94a3b8, 1.1);
      const key = new THREE.DirectionalLight(0xfef08a, 1.8);
      key.position.set(2, 3, 2.5);
      const rim = new THREE.PointLight(0xf97316, 2.2, 5);
      rim.position.set(-1.5, 1.2, -1.2);
      this.scene.add(amb, key, rim);

      // Pedestal de mármol y bronce
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.48, 0.1, 20),
        mat(0x1e293b, { metalness: 0.5, roughness: 0.4 })
      );
      ped.position.y = -0.05;
      const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.43, 0.02, 8, 24),
        mat(0xe5b869, { metalness: 0.85, roughness: 0.25 })
      );
      trim.rotation.x = Math.PI / 2;
      this.scene.add(ped, trim);

      this.heroMesh = null;
      this.lastTs = performance.now();
      this.enabled = true;
      requestAnimationFrame((ts) => this._loop(ts));
    } catch (e) {
      this.enabled = false;
    }
  }

  setClass(classId, equipment = null) {
    if (!this.enabled) return;
    if (this.heroMesh) {
      this.scene.remove(this.heroMesh);
      disposeObject3D(this.heroMesh);
    }
    this.heroMesh = createHeroMesh3D(classId);
    if (equipment) {
      updateHeroEquipmentVisuals(this.heroMesh, equipment, classId);
    }
    this.scene.add(this.heroMesh);
  }

  setEquipment(equipment, classId = null) {
    if (!this.enabled || !this.heroMesh) return;
    updateHeroEquipmentVisuals(this.heroMesh, equipment, classId || this.heroMesh.userData.rig?.classId);
  }

  _loop(ts) {
    if (!this.enabled) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
    this.lastTs = ts;
    if (this.heroMesh) {
      const rig = this.heroMesh.userData.rig;
      rig.facing += dt * 0.95;
      if (Math.floor(ts / 2600) % 2 === 0 && rig.attackTimer <= 0 && (ts % 2600) < 60) {
        rig.attackTimer = 0.28;
      }
      updateActorRig3D(this.heroMesh, {
        dt,
        moving: true,
        targetFacing: rig.facing,
        furyActive: false,
        shieldActive: rig.classId === 'hoplita',
      });
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((next) => this._loop(next));
  }
}
