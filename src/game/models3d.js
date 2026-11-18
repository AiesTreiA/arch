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
import { TILE_SHRINE, TILE_STAIRS, TILE_WALL } from '../core/dungeon.js';

// Escala ortográfica exacta para coincidir al píxel con toIso(gx, gy) donde TILE_W=56, TILE_H=28
export const ISO_SCALE = 28 * Math.SQRT2; // 39.5979797...
const CAM_ELEV_Y = Math.sqrt(2 / 3); // tan(30°) * sqrt(2) => proyección isométrica 2:1 exacta

/** Utilidad para crear materiales estándar con acabado bronce/mármol/tela estilizado */
function mat(color, { metalness = 0.18, roughness = 0.65, emissive = 0x000000, emissiveIntensity = 0, transparent = false, opacity = 1 } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
    flatShading: true,
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
 * Construye el modelo 3D articulado de cualquiera de las 7 clases griegas.
 * Retorna un THREE.Group con `userData.rig` para animación de extremidades, arma, capa y auras.
 */
export function createHeroMesh3D(classId = 'hoplita') {
  const cls = HERO_CLASSES[classId] || HERO_CLASSES.hoplita;
  const root = new THREE.Group();
  root.name = `hero-${classId}`;

  const skinMat = mat(classId === 'necromante' ? 0xcbd5e1 : 0xeab68c, { roughness: 0.75, metalness: 0.05 });
  const primaryMat = mat(cls.color, { roughness: 0.45, metalness: 0.35 });
  const bronzeMat = mat(0xd99b43, { roughness: 0.3, metalness: 0.78 });
  const goldMat = mat(0xfacc15, { roughness: 0.25, metalness: 0.85, emissive: 0x422006, emissiveIntensity: 0.25 });
  const darkMetalMat = mat(0x334155, { roughness: 0.35, metalness: 0.75 });
  const steelMat = mat(0xe2e8f0, { roughness: 0.22, metalness: 0.85 });
  const leatherMat = mat(0x5c3a21, { roughness: 0.8, metalness: 0.1 });
  const darkClothMat = mat(0x1e1b2e, { roughness: 0.8, metalness: 0.1 });

  // Anillo base de clase en el suelo + anillos de buffs (Aura/Furia)
  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.36, 24),
    new THREE.MeshBasicMaterial({ color: cls.color, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
  );
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.02;
  root.add(baseRing);

  const shieldAura = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.025, 8, 28),
    mat(0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 })
  );
  shieldAura.rotation.x = Math.PI / 2;
  shieldAura.position.y = 0.06;
  shieldAura.visible = false;
  root.add(shieldAura);

  const furyAura = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.02, 8, 24),
    mat(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 1.0, transparent: true, opacity: 0.85 })
  );
  furyAura.rotation.x = Math.PI / 2;
  furyAura.position.y = 0.12;
  furyAura.visible = false;
  root.add(furyAura);

  // Grupo del cuerpo (permite bobbing vertical al caminar y respirar)
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Piernas articuladas
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.095, 0.34, 0);
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.095, 0.34, 0);
  bodyGroup.add(leftLegPivot, rightLegPivot);

  const legMat = classId === 'hoplita' || classId === 'campeon' ? bronzeMat : leatherMat;
  for (const pivot of [leftLegPivot, rightLegPivot]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.18, 7), skinMat);
    thigh.position.y = -0.08;
    const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.18, 7), legMat);
    greave.position.y = -0.23;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.14), legMat);
    boot.position.set(0, -0.31, 0.02);
    pivot.add(thigh, greave, boot);
  }

  // Torso y faldellín griego (Pteruges / Túnica)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.36, 0);
  bodyGroup.add(torsoPivot);

  const isBroad = classId === 'campeon' || classId === 'hoplita' || classId === 'coribante';
  const chestW = isBroad ? 0.3 : 0.24;
  const chestD = isBroad ? 0.19 : 0.16;

  const torsoMesh = new THREE.Mesh(
    new THREE.BoxGeometry(chestW, 0.34, chestD),
    classId === 'hoplita' ? bronzeMat : classId === 'campeon' ? skinMat : primaryMat
  );
  torsoMesh.position.y = 0.18;
  torsoPivot.add(torsoMesh);

  // Cinturón y faldellín / túnica griega
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(chestW * 0.56, chestW * 0.62, 0.08, 8), goldMat);
  belt.position.y = 0.03;
  torsoPivot.add(belt);

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 0.16, 8),
    classId === 'hoplita' || classId === 'campeon'
      ? leatherMat
      : classId === 'necromante'
      ? darkClothMat
      : primaryMat
  );
  skirt.position.y = -0.05;
  torsoPivot.add(skirt);

  // Capa dorsal articulada
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.33, -chestD * 0.5);
  torsoPivot.add(capePivot);
  const capeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(chestW * 0.92, 0.44, 0.03),
    classId === 'hoplita' ? primaryMat : classId === 'necromante' ? primaryMat : darkClothMat
  );
  capeMesh.position.set(0, -0.2, -0.02);
  capePivot.add(capeMesh);
  capePivot.rotation.x = 0.18;

  // Cabeza y Casco/Tocado específico de cada clase
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.42, 0);
  torsoPivot.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.125, 1), skinMat);
  headMesh.position.y = 0.08;
  headGroup.add(headMesh);

  // Ojos brillantes o visera
  const eyeColor =
    classId === 'oraculo'
      ? 0x38bdf8
      : classId === 'necromante'
      ? 0xc084fc
      : classId === 'sombra'
      ? 0xf472b6
      : classId === 'coribante'
      ? 0xa3e635
      : 0x0f172a;
  const eyeMat = mat(eyeColor, {
    emissive: eyeColor === 0x0f172a ? 0x000000 : eyeColor,
    emissiveIntensity: eyeColor === 0x0f172a ? 0 : 0.9,
  });
  for (const ex of [-0.042, 0.042]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.022, 0.02), eyeMat);
    eye.position.set(ex, 0.09, 0.115);
    headGroup.add(eye);
  }

  // Tocado / Yelmo por clase
  if (classId === 'hoplita') {
    // Yelmo Corintio de bronce con gran penacho espartano (lophos)
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.14, 0.22, 10), bronzeMat);
    helm.position.y = 0.09;
    const crestHolder = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.24), goldMat);
    crestHolder.position.set(0, 0.22, 0);
    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.14, 0.32),
      mat(0xdc2626, { roughness: 0.6, emissive: 0x450a0a, emissiveIntensity: 0.3 })
    );
    crest.position.set(0, 0.29, -0.02);
    headGroup.add(helm, crestHolder, crest);
  } else if (classId === 'campeon') {
    // Diadema tracia de guerra con cuernos de bronce y cresta carmesí
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.06, 10), bronzeMat);
    band.position.y = 0.14;
    headGroup.add(band);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.18, 6), bronzeMat);
      horn.position.set(side * 0.14, 0.21, 0.02);
      horn.rotation.z = -side * 0.45;
      headGroup.add(horn);
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.095, 7, 6), bronzeMat);
      pauldron.position.set(side * 0.2, 0.31, 0);
      torsoPivot.add(pauldron);
    }
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.32, 0.06), primaryMat);
    strap.position.set(0, 0.18, 0);
     strap.rotation.z = 0.55;
    torsoPivot.add(strap);
  } else if (classId === 'arquera') {
    // Diadema lunar plateada + carcaj de flechas a la espalda
    const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.018, 6, 16), steelMat);
    tiara.rotation.x = Math.PI / 2;
    tiara.position.y = 0.15;
    const moon = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), goldMat);
    moon.position.set(0, 0.2, 0.12);
    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 7), leatherMat);
    hair.position.set(0, 0.04, -0.06);
    hair.rotation.x = 0.35;
    headGroup.add(tiara, moon, hair);

    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.32, 7), leatherMat);
    quiver.position.set(0.09, 0.24, -0.14);
    quiver.rotation.z = -0.32;
    torsoPivot.add(quiver);
  } else if (classId === 'oraculo') {
    // Corona de laurel délfica dorada y halo astral
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 6, 14), goldMat);
    wreath.rotation.x = Math.PI / 2 - 0.15;
    wreath.position.y = 0.15;
    const veil = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.26, 8), primaryMat);
    veil.position.set(0, 0.14, -0.02);
    headGroup.add(wreath, veil);
  } else if (classId === 'necromante') {
    // Capucha estigia y máscara ósea con hombreras de cráneo
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.28, 8), darkClothMat);
    hood.position.set(0, 0.16, -0.01);
    const skullMask = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.06), mat(0xe2e8f0, { roughness: 0.5 }));
    skullMask.position.set(0, 0.07, 0.1);
    headGroup.add(hood, skullMask);
    for (const side of [-1, 1]) {
      const boneShoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.085, 0), mat(0xe2e8f0, { roughness: 0.5 }));
      boneShoulder.position.set(side * 0.19, 0.32, 0);
      torsoPivot.add(boneShoulder);
    }
  } else if (classId === 'sombra') {
    // Capucha nocturna de Nix y máscara de ejecutora
    const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.155, 0.25, 8), darkClothMat);
    cowl.position.set(0, 0.15, 0);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.08), primaryMat);
    mask.position.set(0, 0.05, 0.09);
    headGroup.add(cowl, mask);
  } else if (classId === 'coribante') {
    // Testuz de Lobo de Licaón y cuernos de Pan
    const pelt = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.26), leatherMat);
    pelt.position.set(0, 0.16, 0.01);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 6), leatherMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.19, 0.16);
    headGroup.add(pelt, snout);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 6), goldMat);
      horn.position.set(side * 0.14, 0.23, -0.02);
      horn.rotation.z = -side * 0.55;
      horn.rotation.x = -0.3;
      headGroup.add(horn);
    }
  }

  // Brazos articulados y Armas 3D
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-(chestW * 0.5 + 0.055), 0.31, 0);
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(chestW * 0.5 + 0.055, 0.31, 0);
  torsoPivot.add(leftArmPivot, rightArmPivot);

  for (const pivot of [leftArmPivot, rightArmPivot]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.26, 7), skinMat);
    arm.position.y = -0.11;
    const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.044, 0.11, 7), bronzeMat);
    bracer.position.y = -0.19;
    pivot.add(arm, bracer);
  }

  // Equipamiento de manos (Armas y Escudos 3D según la clase)
  if (classId === 'hoplita') {
    // Mano izquierda: Gran Escudo Aspis Espartano (bronce y borde dorado)
    const shieldGroup = new THREE.Group();
    shieldGroup.position.set(-0.06, -0.18, 0.12);
    const shieldRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.035, 16), goldMat);
    shieldRim.rotation.x = Math.PI / 2;
    shieldRim.rotation.z = 0.35;
    const shieldCore = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.042, 16), primaryMat);
    shieldCore.rotation.x = Math.PI / 2;
    shieldCore.rotation.z = 0.35;
    const boss = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), goldMat);
    boss.position.z = 0.03;
    shieldGroup.add(shieldRim, shieldCore, boss);
    leftArmPivot.add(shieldGroup);
    leftArmPivot.rotation.x = -0.45;

    // Mano derecha: Lanza Dory espartana
    const spear = new THREE.Group();
    spear.position.set(0.02, -0.22, 0.12);
    spear.rotation.x = Math.PI / 2 - 0.22;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.05, 6), leatherMat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 6), steelMat);
    tip.position.y = 0.58;
    const buttSpike = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.1, 6), bronzeMat);
    buttSpike.position.y = -0.55;
    buttSpike.rotation.x = Math.PI;
    spear.add(shaft, tip, buttSpike);
    rightArmPivot.add(spear);
  } else if (classId === 'campeon') {
    // Doble hacha de guerra tracia (una en cada mano)
    for (const [idx, pivot] of [leftArmPivot, rightArmPivot].entries()) {
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
      pivot.add(axe);
      pivot.rotation.x = idx === 0 ? -0.35 : -0.55;
    }
  } else if (classId === 'arquera') {
    // Arco Lunar curvo en la mano izquierda y flecha brillante en la derecha
    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, -0.2, 0.18);
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.022, 6, 14, Math.PI * 1.15),
      mat(0x86efac, { metalness: 0.7, roughness: 0.2, emissive: 0x14532d, emissiveIntensity: 0.4 })
    );
    arc.rotation.z = -Math.PI * 0.57;
    arc.rotation.y = Math.PI / 2;
    const bowString = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), steelMat);
    bowString.position.z = -0.04;
    bowGroup.add(arc, bowString);
    leftArmPivot.add(bowGroup);
    leftArmPivot.rotation.x = -1.15;

    const arrow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.48, 5),
      mat(0x4ade80, { emissive: 0x22c55e, emissiveIntensity: 0.85 })
    );
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(0, -0.2, 0.18);
    rightArmPivot.add(arrow);
    rightArmPivot.rotation.x = -0.9;
  } else if (classId === 'oraculo') {
    // Bastón de Delfos con cristal flotante + Orbe de Zeus en la otra mano
    const staff = new THREE.Group();
    staff.position.set(0, -0.2, 0.12);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.92, 6), goldMat);
    rod.position.y = 0.18;
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 6, 12), goldMat);
    crown.position.y = 0.68;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.065, 0),
      mat(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 1.1 })
    );
    gem.position.y = 0.68;
    staff.add(rod, crown, gem);
    rightArmPivot.add(staff);
    rightArmPivot.rotation.x = -0.35;

    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.065, 0),
      mat(0x7dd3fc, { emissive: 0x38bdf8, emissiveIntensity: 1.0 })
    );
    orb.position.set(0, -0.24, 0.14);
    leftArmPivot.add(orb);
    leftArmPivot.rotation.x = -0.65;
  } else if (classId === 'necromante') {
    // Guadaña Ósea del Estigia + Linterna de Átropos
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
    rightArmPivot.add(scythe);
    rightArmPivot.rotation.x = -0.35;

    const lantern = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07, 0),
      mat(0xa855f7, { emissive: 0x9333ea, emissiveIntensity: 1.1 })
    );
    lantern.position.set(0, -0.25, 0.12);
    leftArmPivot.add(lantern);
    leftArmPivot.rotation.x = -0.6;
  } else if (classId === 'sombra') {
    // Garras Gemelas de las Erinias (Katars) en ambas manos
    for (const pivot of [leftArmPivot, rightArmPivot]) {
      const katar = new THREE.Group();
      katar.position.set(0, -0.24, 0.12);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.1), bronzeMat);
      const blade1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.025, 0.32, 4),
        mat(0xf472b6, { emissive: 0xdb2777, emissiveIntensity: 0.8, metalness: 0.8 })
      );
      blade1.rotation.x = Math.PI / 2;
      blade1.position.set(-0.022, 0, 0.18);
      const blade2 = blade1.clone();
      blade2.position.x = 0.022;
      katar.add(guard, blade1, blade2);
      pivot.add(katar);
      pivot.rotation.x = -0.55;
    }
  } else if (classId === 'coribante') {
    // Gran Mazo Telúrico de Gea + Garras de Licaón
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
    rightArmPivot.add(maul);
    rightArmPivot.rotation.x = -0.45;
    leftArmPivot.rotation.x = -0.35;
  }

  enableShadows(root, true, true);

  root.userData.rig = {
    classId,
    bodyGroup,
    torsoPivot,
    headGroup,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    capePivot,
    baseRing,
    shieldAura,
    furyAura,
    defaultLeftArmX: leftArmPivot.rotation.x,
    defaultRightArmX: rightArmPivot.rotation.x,
    walkPhase: 0,
    attackTimer: 0,
    whirlwindTimer: 0,
    hitFlashTimer: 0,
    facing: 0,
  };

  return root;
}

/**
 * Construye el modelo 3D articulado de un enemigo según su especie (`skeleton`, `harpy`, `satyr`, `minotaur`)
 * y su rango (`normal`, `champion`, `boss`).
 */
export function createEnemyMesh3D(enemy) {
  const kind = enemy.kind || 'skeleton';
  const tier = enemy.tier || 'normal';
  const root = new THREE.Group();
  root.name = `enemy-${enemy.id}`;

  const tierScale = tier === 'boss' ? 1.48 : tier === 'champion' ? 1.18 : 1.0;
  const bodyGroup = new THREE.Group();
  bodyGroup.scale.setScalar(tierScale);
  root.add(bodyGroup);

  // Anillo en el suelo para Campeones y Jefes
  if (tier !== 'normal') {
    const ringColor = tier === 'boss' ? 0xf97316 : 0x38bdf8;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.32 * tierScale, 0.42 * tierScale, 24),
      new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    root.add(ring);
    root.userData.tierRing = ring;
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
    // Hoplita Caído: Esqueleto 3D con costillar, cráneo, escudo roto y kopis oxidado
    const boneMat = mat(tier === 'champion' ? 0xbae6fd : 0xe2e8f0, { roughness: 0.55, metalness: 0.15 });
    const rustMat = mat(0x78350f, { roughness: 0.6, metalness: 0.6 });
    const eyeMat = mat(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 1.0 });

    for (const p of [leftLegPivot, rightLegPivot]) {
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.3, 6), boneMat);
      bone.position.y = -0.15;
      p.add(bone);
    }

    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.32, 6), boneMat);
    spine.position.y = 0.16;
    const ribs = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.14), boneMat);
    ribs.position.y = 0.2;
    torsoPivot.add(spine, ribs);

    const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 1), boneMat);
    skull.position.y = 0.42;
    const helm = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 8), rustMat);
    helm.position.y = 0.5;
    torsoPivot.add(skull, helm);

    for (const ex of [-0.038, 0.038]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.02), eyeMat);
      eye.position.set(ex, 0.43, 0.095);
      torsoPivot.add(eye);
    }

    leftArmPivot.position.set(-0.15, 0.28, 0);
    rightArmPivot.position.set(0.15, 0.28, 0);
    torsoPivot.add(leftArmPivot, rightArmPivot);

    for (const p of [leftArmPivot, rightArmPivot]) {
      const armBone = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.24, 5), boneMat);
      armBone.position.y = -0.11;
      p.add(armBone);
    }

    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), rustMat);
    shield.rotation.x = Math.PI / 2;
    shield.position.set(-0.04, -0.16, 0.09);
    leftArmPivot.add(shield);

    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.36, 0.05), mat(0x94a3b8, { metalness: 0.7, roughness: 0.4 }));
    sword.position.set(0, -0.2, 0.14);
    sword.rotation.x = Math.PI / 2 - 0.3;
    rightArmPivot.add(sword);
  } else if (kind === 'harpy') {
    // Arpía del Estigia: Criatura alada suspendida con alas articuladas y garras
    const plumageMat = mat(tier === 'champion' ? 0x60a5fa : 0xc084fc, { roughness: 0.5, metalness: 0.25 });
    const darkWingMat = mat(0x581c87, { roughness: 0.6, metalness: 0.2 });
    const talonMat = mat(0xfacc15, { roughness: 0.4, metalness: 0.6 });

    bodyGroup.position.y = 0.22; // Flota sobre el suelo

    for (const p of [leftLegPivot, rightLegPivot]) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 5), talonMat);
      talon.position.y = -0.12;
      talon.rotation.x = 0.25;
      p.add(talon);
    }

    const body = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 8), plumageMat);
    body.position.y = 0.16;
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 1), plumageMat);
    head.position.y = 0.4;
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), darkWingMat);
    crest.position.set(0, 0.5, -0.03);
    crest.rotation.x = -0.35;
    torsoPivot.add(body, head, crest);

    // Alas grandes articuladas
    leftWingPivot.position.set(-0.1, 0.28, -0.04);
    rightWingPivot.position.set(0.1, 0.28, -0.04);
    torsoPivot.add(leftWingPivot, rightWingPivot);

    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.22), darkWingMat);
    leftWing.position.set(-0.2, 0.04, -0.02);
    leftWing.rotation.z = 0.25;
    leftWingPivot.add(leftWing);

    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.22), darkWingMat);
    rightWing.position.set(0.2, 0.04, -0.02);
    rightWing.rotation.z = -0.25;
    rightWingPivot.add(rightWing);
  } else if (kind === 'satyr') {
    // Sátiro Arquero: Piernas caprinas, cuernos curvados y arco de caza
    const furMat = mat(0x78350f, { roughness: 0.85, metalness: 0.05 });
    const skinMat = mat(0xd97706, { roughness: 0.65, metalness: 0.1 });
    const hornMat = mat(0xfef08a, { roughness: 0.4, metalness: 0.4 });

    for (const p of [leftLegPivot, rightLegPivot]) {
      const haunch = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.26, 7), furMat);
      haunch.position.y = -0.14;
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.11), hornMat);
      hoof.position.set(0, -0.28, 0.02);
      p.add(haunch, hoof);
    }

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.16), skinMat);
    chest.position.y = 0.16;
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 1), skinMat);
    head.position.y = 0.39;
    torsoPivot.add(chest, head);

    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 6), hornMat);
      horn.position.set(side * 0.1, 0.5, -0.02);
      horn.rotation.z = -side * 0.45;
      horn.rotation.x = -0.35;
      torsoPivot.add(horn);
    }

    leftArmPivot.position.set(-0.16, 0.26, 0);
    rightArmPivot.position.set(0.16, 0.26, 0);
    torsoPivot.add(leftArmPivot, rightArmPivot);

    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 12, Math.PI), hornMat);
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 2;
    bow.position.set(0, -0.12, 0.16);
    leftArmPivot.add(bow);
    leftArmPivot.rotation.x = -1.0;
  } else {
    // Minotauro Guardián (Boss / Élite): Coloso taurino con cuernos gigantes y Labrys bipenne
    const hideMat = mat(tier === 'boss' ? 0x9a3412 : 0x7c2d12, { roughness: 0.7, metalness: 0.15 });
    const bronzeMat = mat(0xf59e0b, { roughness: 0.3, metalness: 0.8 });
    const hornMat = mat(0xfef3c7, { roughness: 0.35, metalness: 0.3 });
    const eyeMat = mat(0xfacc15, { emissive: 0xef4444, emissiveIntensity: 1.2 });

    for (const p of [leftLegPivot, rightLegPivot]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.32, 8), hideMat);
      leg.position.y = -0.16;
      p.add(leg);
    }

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.26), hideMat);
    chest.position.y = 0.2;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 8), bronzeMat);
    belt.position.y = 0.03;
    torsoPivot.add(chest, belt);

    // Cabeza de toro con morro, anillo nasal dorado y cuernos curvos
    const bullHead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.24), hideMat);
    bullHead.position.set(0, 0.48, 0.04);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.16), hideMat);
    snout.position.set(0, 0.44, 0.18);
    const noseRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12), bronzeMat);
    noseRing.position.set(0, 0.4, 0.27);
    torsoPivot.add(bullHead, snout, noseRing);

    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 7), hornMat);
      horn.position.set(side * 0.19, 0.58, 0.06);
      horn.rotation.z = -side * 0.65;
      horn.rotation.x = 0.35;
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.02), eyeMat);
      eye.position.set(side * 0.065, 0.5, 0.165);
      const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), bronzeMat);
      pauldron.position.set(side * 0.24, 0.34, 0);
      torsoPivot.add(horn, eye, pauldron);
    }

    leftArmPivot.position.set(-0.24, 0.34, 0);
    rightArmPivot.position.set(0.24, 0.34, 0);
    torsoPivot.add(leftArmPivot, rightArmPivot);

    for (const p of [leftArmPivot, rightArmPivot]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.32, 7), hideMat);
      arm.position.y = -0.14;
      p.add(arm);
    }

    // Gran Hacha Labrys de doble filo
    const labrys = new THREE.Group();
    labrys.position.set(0, -0.26, 0.16);
    labrys.rotation.x = Math.PI / 2 - 0.35;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.92, 6), bronzeMat);
    pole.position.y = 0.2;
    const axeHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.32, 0.42),
      mat(0xf97316, { metalness: 0.75, roughness: 0.25, emissive: 0x7c2d12, emissiveIntensity: 0.45 })
    );
    axeHead.position.y = 0.54;
    labrys.add(pole, axeHead);
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

  // Sibila de Cumas
  const sibyl = new THREE.Group();
  const robeMat = mat(0xc026d3, { roughness: 0.55, metalness: 0.2, emissive: 0x4a044e, emissiveIntensity: 0.35 });
  const goldMat = mat(0xfde68a, { roughness: 0.2, metalness: 0.85, emissive: 0x78350f, emissiveIntensity: 0.4 });

  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.56, 10), robeMat);
  skirt.position.y = 0.28;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.28, 9), robeMat);
  torso.position.y = 0.58;
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 1), mat(0xfde68a, { roughness: 0.6 }));
  head.position.y = 0.82;
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 9), goldMat);
  hood.position.y = 0.88;

  // Anillo de oráculo flotante alrededor de la Sibila
  const oracleRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.018, 6, 24), goldMat);
  oracleRing.rotation.x = Math.PI / 2 - 0.25;
  oracleRing.position.y = 0.55;

  sibyl.add(skirt, torso, head, hood, oracleRing);
  group.add(sibyl);

  // Hoguera Sagrada (desplazada ligeramente como en el render 2D)
  const fireGroup = new THREE.Group();
  fireGroup.position.set(-0.45, 0, 0.35);

  const stoneMat = mat(0x475569, { roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065, 0), stoneMat);
    stone.position.set(Math.cos(ang) * 0.2, 0.04, Math.sin(ang) * 0.2);
    fireGroup.add(stone);
  }

  const outerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.38, 7),
    mat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 })
  );
  outerFlame.position.y = 0.19;

  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.26, 6),
    mat(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 1.4 })
  );
  innerFlame.position.y = 0.15;

  fireGroup.add(outerFlame, innerFlame);
  group.add(fireGroup);

  enableShadows(group, true, true);
  group.userData = { sibyl, oracleRing, outerFlame, innerFlame };
  return group;
}

/**
 * Actualiza las articulaciones de un héroe o enemigo 3D (caminar, atacar, respirar, girar).
 */
export function updateActorRig3D(mesh, { dt, moving = false, targetFacing = null, furyActive = false, shieldActive = false }) {
  const rig = mesh.userData.rig;
  if (!rig) return;

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
  if (moving) {
    rig.walkPhase += dt * 11.5;
    const swing = Math.sin(rig.walkPhase) * 0.65;
    const bob = Math.abs(Math.cos(rig.walkPhase)) * 0.045;
    rig.bodyGroup.position.y = (rig.kind === 'harpy' ? 0.22 : 0) + bob;
    if (rig.leftLegPivot) rig.leftLegPivot.rotation.x = swing;
    if (rig.rightLegPivot) rig.rightLegPivot.rotation.x = -swing;
    if (rig.leftArmPivot && rig.attackTimer <= 0) {
      rig.leftArmPivot.rotation.x = (rig.defaultLeftArmX ?? 0) - swing * 0.45;
    }
    if (rig.rightArmPivot && rig.attackTimer <= 0) {
      rig.rightArmPivot.rotation.x = (rig.defaultRightArmX ?? 0) + swing * 0.45;
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

  // Animación de golpe con el brazo derecho / cuerpo
  if (rig.attackTimer > 0) {
    rig.attackTimer = Math.max(0, rig.attackTimer - dt);
    const t = rig.attackTimer / 0.28; // 1 -> 0
    const swing = Math.sin(t * Math.PI);
    if (rig.rightArmPivot) {
      rig.rightArmPivot.rotation.x = (rig.defaultRightArmX ?? -0.3) - swing * 1.35;
    }
    if (rig.torsoPivot) {
      rig.torsoPivot.rotation.y = swing * 0.35;
    }
  } else if (rig.torsoPivot) {
    rig.torsoPivot.rotation.y *= 0.8;
  }
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
      this.projMeshes = [];
      this.activeVFX = [];
      this.zoom = 1.0;

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

  /** Reconstruye la geometría 3D del calabozo cuando se carga un nuevo piso */
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
    this.shrineGroup = null;
    this.npcGroup = null;

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

    const { width, height, grid, biome } = dungeon;
    const floorGeo = new THREE.BoxGeometry(0.98, 0.12, 0.98);
    const wallGeo = new THREE.BoxGeometry(0.98, 0.72, 0.98);
    const pillarGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.82, 8);

    for (let y = 0; y < height; y++) {
      this.tileMeshes[y] = [];
      for (let x = 0; x < width; x++) {
        const t = grid[y][x];
        let tileObj;

        if (t === TILE_WALL) {
          const wallMat = mat(biome.wall, { roughness: 0.85, metalness: 0.12 });
          // Alternar muros macizos y columnas dóricas en los bordes
          const isCornerColumn = (x + y) % 5 === 0;
          if (isCornerColumn) {
            tileObj = new THREE.Group();
            const base = new THREE.Mesh(wallGeo, wallMat);
            base.position.y = 0.36;
            const col = new THREE.Mesh(pillarGeo, mat(0x64748b, { roughness: 0.7 }));
            col.position.y = 0.45;
            tileObj.add(base, col);
          } else {
            tileObj = new THREE.Mesh(wallGeo, wallMat);
            tileObj.position.y = 0.36;
          }
          enableShadows(tileObj, true, true);
        } else {
          const color =
            t === TILE_STAIRS ? 0x422006 : t === TILE_SHRINE ? 0x164e63 : biome.floor;
          const floorMat = mat(color, { roughness: 0.88, metalness: 0.08 });
          tileObj = new THREE.Mesh(floorGeo, floorMat);
          tileObj.position.y = -0.06;
          tileObj.receiveShadow = true;

          if (t === TILE_STAIRS) {
            const stairsGroup = new THREE.Group();
            stairsGroup.add(tileObj);
            const archMat = mat(0xfacc15, { metalness: 0.7, roughness: 0.3, emissive: 0x713f12, emissiveIntensity: 0.4 });
            for (const sx of [-0.32, 0.32]) {
              const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 7), archMat);
              post.position.set(sx, 0.27, 0);
              stairsGroup.add(post);
            }
            const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.14), archMat);
            lintel.position.set(0, 0.56, 0);
            stairsGroup.add(lintel);
            tileObj = stairsGroup;
          } else if (t === TILE_SHRINE) {
            const sGroup = new THREE.Group();
            sGroup.add(tileObj);
            const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.24, 8), mat(0x94a3b8, { roughness: 0.5 }));
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

        tileObj.position.x = x + 0.5;
        tileObj.position.z = y + 0.5;
        tileObj.visible = false;
        this.dungeonGroup.add(tileObj);
        this.tileMeshes[y][x] = tileObj;
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

    // Sibila de Cumas y Hoguera 3D
    if (dungeon.npc) {
      this.npcGroup = createSibylAndCampfire3D();
      this.npcGroup.position.set(dungeon.npc.x, 0, dungeon.npc.y);
      this.dungeonGroup.add(this.npcGroup);
      this.campfireLight.position.set(dungeon.npc.x - 0.45, 0.85, dungeon.npc.y + 0.35);
      this.campfireLight.visible = true;
    } else {
      this.campfireLight.visible = false;
    }
  }

  /** Dispara animación de ataque o habilidad en el modelo 3D del héroe */
  triggerHeroAttack({ whirlwind = false } = {}) {
    if (!this.heroMesh?.userData?.rig) return;
    this.heroMesh.userData.rig.attackTimer = 0.28;
    if (whirlwind) {
      this.heroMesh.userData.rig.whirlwindTimer = 0.55;
    }
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
    const now = performance.now() * 0.001;

    // 1. Asegurar que el modelo 3D del héroe coincide con la clase actual
    if (!this.heroMesh || this.heroClassId !== hero.classId) {
      if (this.heroMesh) this.actorsGroup.remove(this.heroMesh);
      this.heroMesh = createHeroMesh3D(hero.classId);
      this.heroClassId = hero.classId;
      this.actorsGroup.add(this.heroMesh);
      this.lastHeroPos = { x: pos.x, y: pos.y };
    }

    // 2. Sincronizar cámara ortográfica con `game.cam` (proyección 2:1 idéntica a toIso)
    const camGridX = (cam.x / 28 + cam.y / 14) / 2;
    const camGridY = (cam.y / 14 - cam.x / 28) / 2;
    const dist = 60;
    this.camera.position.set(camGridX + dist, dist * CAM_ELEV_Y, camGridY + dist);
    this.camera.lookAt(camGridX, 0, camGridY);

    // Actualizar luz direccional de sombras centrada cerca del héroe
    this.dirLight.position.set(pos.x - 9, 18, pos.y + 6);
    this.dirLight.target.position.set(pos.x, 0, pos.y);
    this.heroLight.position.set(pos.x, 1.75, pos.y);
    this.heroLight.color.set(HERO_CLASSES[hero.classId]?.color || '#f59e0b');

    // 3. Visibilidad de celdas (Niebla de Guerra)
    const { width, height, explored } = dungeon;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileObj = this.tileMeshes[y]?.[x];
        if (!tileObj) continue;
        const vis = explored[y][x];
        tileObj.visible = vis > 0;
        if (vis > 0) {
          const dim = vis === 2 ? 1.0 : 0.35;
          tileObj.traverse((c) => {
            if (c.isMesh && c.material) {
              if (!c.userData.baseColor) c.userData.baseColor = c.material.color.clone();
              c.material.color.copy(c.userData.baseColor).multiplyScalar(dim);
            }
          });
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

    // Limpiar enemigos derrotados
    for (const [id, mesh] of this.enemyMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.actorsGroup.remove(mesh);
        this.enemyMeshes.delete(id);
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
    while (this.dropMeshes.length > groundDrops.length) {
      const m = this.dropMeshes.pop();
      this.fxGroup.remove(m);
      disposeObject3D(m);
    }
    while (this.dropMeshes.length < groundDrops.length) {
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11, 0),
        mat(0xfacc15, { metalness: 0.8, roughness: 0.2, emissive: 0x78350f, emissiveIntensity: 0.5 })
      );
      this.fxGroup.add(m);
      this.dropMeshes.push(m);
    }
    for (let i = 0; i < groundDrops.length; i++) {
      const d = groundDrops[i];
      const m = this.dropMeshes[i];
      const color = d.kind === 'gold' ? 0xfacc15 : d.kind === 'potion' ? 0xef4444 : d.item?.color || 0x38bdf8;
      m.material.color.set(color);
      m.material.emissive.set(color);
      m.position.set(d.x, 0.16 + Math.sin(now * 4 + i) * 0.04, d.y);
      m.rotation.y = now * 2.5 + i;
    }
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

  setClass(classId) {
    if (!this.enabled) return;
    if (this.heroMesh) this.scene.remove(this.heroMesh);
    this.heroMesh = createHeroMesh3D(classId);
    this.scene.add(this.heroMesh);
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
