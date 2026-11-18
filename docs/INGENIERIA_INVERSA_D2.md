# Ingeniería Inversa de Diablo II aplicada a Mitología Griega (**ARCH**)

Este documento descompone los **7 sistemas algorítmicos** que hicieron legendario a *Diablo II* y define cómo replicarlos de forma limpia, determinista y progresiva en un motor web 2D/isométrico de costo `$0`.

---

## 1. Proyección Isométrica 2:1 y Niebla de Guerra (*Fog of War*)
- **Matemática de cámara:** las coordenadas lógicas `(gx, gy)` se mantienen en un mapa 2D ortogonal limpio (colisiones, pathfinding y visibilidad en grilla), y solo al dibujar se proyectan en diamante 2:1:
  - `isoX = (gx - gy) * (TILE_W / 2)`
  - `isoY = (gx + gy) * (TILE_H / 2)`
- **Orden de pintado (*Painter's Algorithm*):** ordenar entidades y muros por `gx + gy` (profundidad isométrica) garantiza oclusión correcta sin Z-buffer 3D.
- **Visibilidad de 3 estados por celda:** `0 = oculta`, `1 = explorada (recordada en penumbra)`, `2 = visible ahora` (calculada con *raycast* radial / línea de visión sobre muros).

## 2. Generación Procedural por Semilla (`PRNG`)
- **Principio D2:** cada piso del laberinto nace de una semilla (`seed`) que alimenta un generador determinista (`mulberry32`). Cualquier bug o mapa interesante se puede reproducir exacto compartiendo la semilla.
- **Algoritmo base (v0.1 → evolución):**
  1. Partición por salas no solapadas con margen de muro.
  2. Conexión garantizada mediante corredor en L entre centros consecutivos (árbol generador mínimo implícito: **100% de las salas son alcanzables**).
  3. Marcado semántico de hitos: *Entrada*, *Altar de Hermes / Santuario de Asclepio* (curación), *Cofre del Tesoro*, *Escalera al Tártaro* (sala más lejana) y oleadas de monstruos según distancia.

## 3. Arquetipos (3 Clases Griegas) y Atributos
Cada clase parte con estadísticas diferenciadas y 2 habilidades activas iniciales (expandible a 3 ramas × 3 poderes):

| Clase | Análogo D2 | Rol | Habilidad Q | Habilidad E |
|---|---|---|---|---|
| **Hoplita de Esparta** | Bárbaro / Paladín | Tanque cuerpo a cuerpo | **Golpe de Égida** (cono + empuje) | **Furia de Ares** (+daño y velocidad temporal) |
| **Arquera de Artemisa** | Amazona / Asesina | Daño a distancia y control | **Flecha Lunar** (proyectil perforante) | **Paso de Cierva** (esquive + disparo ralentizador) |
| **Oráculo de Delfos** | Hechicera / Nigromante | Daño elemental y área | **Rayo de Zeus** (impacto en área) | **Égida Etérea** (escudo que absorbe daño) |

- **Atributos primarios:** `Fuerza` (daño físico), `Destreza` (precisión/crítico/esquive), `Espíritu` (daño elemental y fervor/maná), `Vitalidad` (vida máxima).

## 4. Motor de *Loot* y Afijos (el núcleo adictivo)
En *Diablo II* el equipo no es estático: se genera combinando **Base + Rareza + Prefijos + Sufijos**.

- **Rarezas implementadas:**
  1. **Común** (`#d6d3d1`): ítem base limpio (ej. *Xiphos de Bronce*).
  2. **Mágico** (`#60a5fa`): 1–2 afijos (ej. *Xiphos de Bronce Ígneo del Halcón*).
  3. **Raro** (`#facc15`): 3–4 afijos + nombre mítico generado (ej. *Filo de Teseo*).
  4. **Reliquia Única** (`#f97316`): tabla fija legendaria con modificadores únicos (ej. *Lanza de Aquiles*, *Égida de Atenea*, *Sandalias de Hermes*, *Arco de Apolo*, *Cetro de Hades*).
- **Escala por nivel (`ilvl`):** los afijos tienen rangos `(min, max)` que escalan con el nivel de mazmorra y modificador de rareza.

## 5. Combate en Tiempo Real e IA por Estados
- **Fórmula de impacto D2 simplificada:**
  - `probAcierto = clamp(0.55 + (ataqueDestreza - defensaObjetivo) * 0.015, 0.25, 0.95)`
  - `mitigación = armadura / (armadura + 60 + 12 * nivelAtacante)`
  - Crítico base + bonos de equipo (`1.75×` daño).
- **Máquina de estados de enemigos:** `IDLE` → `CHASE` (al entrar en radio de detección con línea de vista) → `ATTACK` (respetando *wind-up* y *cooldown*) → `DEAD` (soltando XP + tirada de tabla de *loot*).
- **Bestiario inicial por actos (roadmap):**
  - *Acto I — Umbral del Estigia:* Esqueletos Hoplitas, Arpías Veloz, Sátiros Arqueros, Minotauro Campeón (Jefe de piso).
  - *Acto II — Laberinto de Creta / Forjas de Hefesto:* Autómatas de Bronce, Górgonas (veneno/ralentización), Quimera.

## 6. Progresión y Bucle de Juego (*Core Loop*)
`Explorar niebla → Combatir oleadas → Recoger oro y afijos → Evaluar mejoras en mochila → Subir nivel y repartir stats → Descender al siguiente piso más difícil`.

## 7. Estrategia Gradual de Inversión (Roadmap)
- **Fase 1 (`$0`, actual):** motor isométrico, procedural, afijos, combate y 3 clases jugables en Canvas 2D con audio WebAudio mínimo opcional y formas geométricas claras.
- **Fase 2 (mecánica validada):** añadir árbol de habilidades, santuario/herrería, guardado persistente y telemetría de balance (qué afijos y clases rinden mejor).
- **Fase 3 (inversión gradual sobre diseño cerrado):** música épica/oscura con **Suno**, retratos/sprites generados por IA con estilo coherente, o salto a shader/3D isométrico ligero sin desperdiciar el core lógico.
