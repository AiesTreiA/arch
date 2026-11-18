# ARCH — ARPG de Mitología Griega (Ingeniería Inversa de Diablo II)

Proyecto independiente de desarrollo e ingeniería inversa algorítmica inspirado en **Diablo II**, ambientado en los **mitos griegos** (*El Umbral del Estigia, Laberinto de Creta, Forjas de Hefesto y el Tártaro*).

> **Nombre:** **ARCH** (*Arkhé / ἀρχή* — principio u origen, y *Archonte*).  
> **Principio operativo:** arquitectura modular pura en JavaScript ES Modules, `$0` de costo inicial, 60 fps en navegador y escalado gradual de arte/audio (Suno, sprites/3D) recién cuando las mecánicas estén validadas.

## Arranque rápido

```bash
cd /home/astro/dev/arch
npm test      # Pruebas unitarias de RNG, mazmorras, loot/afijos y combate
npm run dev   # Levanta servidor local en http://127.0.0.1:4173
```

## Estructura del proyecto

- `docs/INGENIERIA_INVERSA_D2.md`: desglose técnico y matemático de los 7 sistemas núcleo de Diablo II adaptados a mitología griega.
- `src/core/rng.js`: PRNG determinista (`mulberry32`) y generador de semillas reproducibles.
- `src/core/dungeon.js`: generador procedural de mazmorras (salas, corredores, santuarios, cofres, descenso y spawning).
- `src/core/loot.js`: motor de botín y afijos (Común, Mágico, Raro y Reliquias Únicas griegas).
- `src/core/combat.js`: clases iniciales (*Hoplita*, *Arquera*, *Oráculo*), atributos, fórmulas de impacto/mitigación y progresión.
- `src/game/engine.js`: motor isométrico Canvas 2D con niebla de guerra, combate en tiempo real, IA por estados y gestión de equipo.
- `index.html` / `styles.css`: interfaz jugable (*Vertical Slice v0.1*).
- `tests/core.test.mjs`: suite de pruebas con `node --test`.
