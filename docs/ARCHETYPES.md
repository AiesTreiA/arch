# Matriz de Arquetipos Griegos — Ingeniería Inversa 1:1 de *Diablo II* (**ARCH**)

Este documento define la traducción mecánica y narrativa de las **7 clases de *Diablo II: Lord of Destruction*** al universo mitológico griego de **ARCH**, conservando la estructura de datos de `charstats.txt` y `skills.txt` (atributos iniciales, escalado por punto, 3 ramas de talentos con sinergias cruzadas y objetos exclusivos de clase).

---

## 1. Tabla Comparativa de Atributos Base (`charstats`)

Al igual que en *Diablo II*, todas las clases reciben **+5 puntos de atributo** (o **+3** en el modo compacto actual) y **+1 punto de habilidad** por nivel, pero el rendimiento marginal de cada punto en `Vitalidad` y `Espíritu` varía según la vocación marcial o mística de la clase:

| ID (`classId`) | Clase en **ARCH** | Análogo *D2* | Fuerza | Destreza | Espíritu | Vitalidad | +HP / Nivel | +HP / Vit | +Fervor / Nivel | +Fervor / Esp | Atributo Primario de Daño |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `campeon` | **Campeón de Ares** | Bárbaro | **16** | 10 | 5 | **15** | +16 | +6.0 | +4 | +2.0 | `Fuerza` |
| `hoplita` | **Hoplita de Esparta** | Paladín | **14** | 11 | 8 | 13 | +14 | +5.0 | +5 | +3.0 | `Fuerza` |
| `arquera` | **Cazadora de Artemisa** | Amazona | 9 | **16** | 9 | 11 | +12 | +4.5 | +5 | +3.0 | `Destreza` |
| `oraculo` | **Oráculo de Delfos** | Hechicera | 6 | 10 | **17** | 9 | +10 | +3.5 | +8 | +5.0 | `Espíritu` |
| `necromante` | **Necromante del Estigia** | Nigromante | 7 | 10 | **15** | 10 | +11 | +4.0 | +7 | +4.5 | `Espíritu` |
| `sombra` | **Sombra de Némesis** | Asesina | 10 | **15** | 10 | 11 | +12 | +4.5 | +5 | +3.2 | `Destreza` |
| `coribante` | **Coribante de Pan** | Druida | 11 | 9 | 12 | **14** | +14 | +5.5 | +6 | +3.8 | `Vitalidad` / `Espíritu` |

---

## 2. Desglose de las 7 Clases, Ramas de Talentos y Sinergias

Cada clase posee **3 ramas de habilidades (Trees)** con progresión en escalones (`Nv. 1 → Nv. 6 → Nv. 12 → Nv. 18 → Nv. 24 → Nv. 30`) y **sinergias puras** (solo los puntos base invertidos otorgan porcentaje adicional a habilidades hermanas).

---

### I. Campeón de Ares (`campeon` — *Bárbaro*)
* **Fantasía y Lore:** Mercenario tracio consagrado a Ares, Fobos y Deimos. Desprecia la formación defensiva para lanzarse al centro de la masacre con armas pesadas o doble empuñadura.
* **Objeto exclusivo de clase:** *Yelmo Tracio con Cresta de Crin* (`+1–3 a Gritos de Guerra / Furia Sangrienta`).
* **Habilidades activas en el prototipo (Vertical Slice):**
  * **`[Q]` Torbellino Tracio:** Giro brutal de bronce que golpea a todos los enemigos circundantes y drena sangre.
  * **`[E]` Grito de Fobos:** Rugido de guerra que intimida y empuja a la horda cercana mientras potencia el daño y la velocidad de ataque.
* **Las 3 Ramas de Habilidades:**
  1. **Clamor de Fobos (*Warcries*):**
     * *Aullido de Terror* (Nv. 1): dispersa enemigos menores.
     * *Orden de Batalla* (Nv. 18): incrementa un `%` la salud y el fervor máximos.
     * *Rugido de Guerra* (Nv. 30): daño físico radial + aturdimiento (*Sinergia:* `+6% daño` por punto en *Aullido* y *Orden*).
  2. **Maestría Marcial (*Combat Masteries*):**
     * *Maestría en Xiphos / Hachas / Mazas* (Nv. 1): aumenta precisión y probabilidad de golpe crítico.
     * *Piel de Bronce* (Nv. 18): incrementa la armadura base en `+15%` por nivel.
     * *Resistencia Olímpica* (Nv. 30): suma resistencias elementales con rendimientos decrecientes (*diminishing returns*).
  3. **Furia Sangrienta (*Combat Skills*):**
     * *Salto de Aquiles* (Nv. 6): salto que derriba al aterrizar.
     * *Frenesí de Ares* (Nv. 18): cada golpe consecutivo acelera la velocidad de movimiento y ataque.
     * *Torbellino Tracio* (Nv. 30): ataque continuo en movimiento sin interrupción.

---

### II. Hoplita de Esparta (`hoplita` — *Paladín*)
* **Fantasía y Lore:** Guerrero lacedemonio juramentado ante los altares de Atenea y Apolo. Combate en falange proyectando auras divinas que consagran el suelo y bloqueando embestidas con su escudo (*Aspis*).
* **Objeto exclusivo de clase:** *Aspis Lacedemonio* (escudo con resistencias implícitas y bonificador a Auras).
* **Habilidades activas en el prototipo (Vertical Slice):**
  * **`[Q]` Golpe de Égida:** Impacto frontal con el escudo que inflige daño contundente y empuja a los enemigos.
  * **`[E]` Aura de Apolo:** Desata un pulso solar abrasador alrededor del hoplita y eleva su fervor y armadura.
* **Las 3 Ramas de Habilidades:**
  1. **Auras Olímpicas (*Offensive Auras*):**
     * *Fuego de Helios* (Nv. 6): añade daño ígneo pasivo y pulsos radiales.
     * *Fanatismo de Esparta* (Nv. 30): incrementa velocidad de ataque, daño físico y precisión.
  2. **Auras de Falange (*Defensive Auras*):**
     * *Plegaria de Asclepio* (Nv. 1): regeneración constante de vida.
     * *Muro de Bronce* (Nv. 18): multiplica la defensa total del equipo.
  3. **Artes de Égida (*Combat Skills*):**
     * *Golpe de Égida / Smite* (Nv. 1): golpe con escudo que nunca falla (*ignora defensa*).
     * *Fervor de Lanza / Zeal* (Nv. 12): ráfaga de estocadas veloces contra objetivos adyacentes.
     * *Lanza Consagrada* (Nv. 18): proyectil sagrado en espiral (*Sinergia:* `+14% daño` por punto en *Vigor* y *Campo Bendito*).

---

### III. Cazadora de Artemisa (`arquera` — *Amazona*)
* **Fantasía y Lore:** Iniciada de los bosques de Arcadia y Ortigia. Alterna el arco plateado de larga distancia con venablos cargados de relámpagos.
* **Objeto exclusivo de clase:** *Arco Reflex de Ortigia* y *Jabalina de Cazadora* (reabastecimiento automático).
* **Habilidades activas en el prototipo (Vertical Slice):**
  * **`[Q]` Flecha Lunar:** Disparo plateado perforante (*Pierce*) con alta probabilidad crítica.
  * **`[E]` Salva de Ortigia:** Abanico de flechas lunares acompañado de un paso ágil que restaura aliento.
* **Las 3 Ramas de Habilidades:**
  1. **Arco Lunar (*Bow & Crossbow*):**
     * *Salva Múltiple* (Nv. 6): dispara un cono de hasta 12 flechas.
     * *Flecha Guiada por Artemisa* (Nv. 18): proyectil que persigue al objetivo.
     * *Flecha de Escarcha* (Nv. 30): congela en área al impactar (*Sinergia:* `+12% daño frío` por punto en *Flecha Helada*).
  2. **Venablo y Relámpago (*Javelin & Spear*):**
     * *Estocada Eléctrica* (Nv. 6): libera centellas al golpear cuerpo a cuerpo.
     * *Furia de Relámpago* (Nv. 30): jabalina arrojadiza que se divide en decenas de rayos al impactar.
  3. **Instinto Silvestre (*Passive & Magic*):**
     * *Ojo de Halcón* (Nv. 1): probabilidad de doble daño (*Critical Strike*).
     * *Reflejos de Cierva* (Nv. 12): probabilidad de esquivar ataques cuerpo a cuerpo y proyectiles.
     * *Perforación Lunar* (Nv. 30): probabilidad de que los proyectiles atraviesen enemigos para volver a detonar efectos.

---

### IV. Oráculo de Delfos (`oraculo` — *Hechicera*)
* **Fantasía y Lore:** Pitia que inhaló los vapores del abismo de Delfos y sobrevivió a la voz directa de los Olímpicos. Canaliza las tres fuerzas primordiales: el rayo de Zeus, el fuego robado de Prometeo y el viento helado de Bóreas.
* **Objeto exclusivo de clase:** *Trípode / Orbe Pitio* (arma a una mano con `+Espíritu` y maestría elemental implícita).
* **Habilidades activas en el prototipo (Vertical Slice):**
  * **`[Q]` Rayo de Zeus:** Descarga celestial en área sobre el enemigo más próximo.
  * **`[E]` Égida Etérea:** Paso astral instantáneo y escudo de energía que mitiga el daño entrante.
* **Las 3 Ramas de Habilidades:**
  1. **Ira de Zeus (*Lightning Spells*):**
     * *Nova Olímpica* (Nv. 12): anillo eléctrico de corto alcance sin enfriamiento.
     * *Paso Etéreo / Teleport* (Nv. 18): desplazamiento instantáneo ignorando obstáculos.
     * *Cadena de Relámpagos* (Nv. 24) y *Maestría del Rayo* (Nv. 30): multiplica el daño eléctrico directo.
  2. **Fuego de Prometeo (*Fire Spells*):**
     * *Esfera Ígnea* (Nv. 12): explosión de radio medio.
     * *Meteoro del Etna* (Nv. 24): impacto retardado con suelo en llamas (*Sinergia:* `+5% daño` por punto en *Esfera Ígnea*).
     * *Hidra de Fuego* (Nv. 30): invoca cabezas ígneas que escupen proyectiles.
  3. **Hielo de Bóreas (*Cold Spells*):**
     * *Armadura Escarchada* (Nv. 1): congela atacantes cuerpo a cuerpo.
     * *Ventisca Hiperbórea* (Nv. 24): lluvia de fragmentos glaciales en área.
     * *Orbe de Bóreas* (Nv. 30): esfera giratoria que dispara agujas de hielo en 360° y reduce la resistencia al frío enemiga.

---

### V. Necromante del Estigia (`necromante` — *Nigromante*)
* **Fantasía y Lore:** Sacerdote órfico de Hades, Perséfone y Hécate. Conoce el precio del óbolo de Caronte: reclama las sombras de los caídos para que luchen a su favor y pronuncia las maldiciones de las Moiras.
* **Objeto exclusivo de clase:** *Óbolo / Cráneo Órfico* (escudo ritual que otorga bonificaciones a maldiciones e invocaciones).
* **Habilidades activas en el prototipo (Vertical Slice):**
  * **`[Q]` Lanza de Caronte:** Proyectil de hueso estigio que perfora filas de enemigos y drena vitalidad.
  * **`[E]` Condena de Átropos:** Detonación de almas en área que quebranta a la horda y restaura salud/fervor al invocador.
* **Las 3 Ramas de Habilidades:**
  1. **Legión de Sombras (*Summoning Spells*):**
     * *Alzar Hoplita Caído* (Nv. 1): levanta esqueletos guerreros a partir de cadáveres.
     * *Autómata de Arcilla Estigia* (Nv. 6): golem que ralentiza enemigos al golpear.
     * *Dominio de las Sombras* (Nv. 12): incrementa vida y daño de todas las invocaciones.
  2. **Peste y Hueso (*Poison & Bone*):**
     * *Armadura de Osario* (Nv. 1): escudo giratorio que absorbe daño físico.
     * *Pira de Cadáveres* (Nv. 6): hace estallar un cuerpo caído infligiendo `70–120%` de su vida máxima como daño mitad físico y mitad fuego.
     * *Lanza de Caronte* (Nv. 18) y *Espíritu del Estigia* (Nv. 30): proyectiles mágicos puros (*Sinergia:* `+7% daño` entre sí).
  3. **Maldiciones de las Moiras (*Curses*):**
     * *Hilo de Cloto (Amplificar Daño)* (Nv. 1): reduce la resistencia física enemiga en `-100%`.
     * *Velo de Láquesis (Decrepitud)* (Nv. 24): reduce velocidad, daño y resistencia física de jefes en `-50%`.
     * *Corte de Átropos (Reducción de Resistencias)* (Nv. 30): merma todas las resistencias elementales.

---

### VI. Sombra de Némesis (`sombra` — *Asesina*)
* **Fantasía y Lore:** Ejecutora silenciosa consagrada a Nix y a las Erinias (Tisífone, Megera y Alecto). Castiga la *hybris* combinando hojas gemelas impregnadas de veneno con artilugios mecánicos robados de las forjas de Hefesto.
* **Objeto exclusivo de clase:** *Garras de las Erinias / Katar de Bronce* (permite bloqueo dual y ataques de carga).
* **Habilidades activas en el prototipo (Vertical Slice):**
  * **`[Q]` Filo de las Erinias:** Paso sombrío instantáneo hacia el objetivo que ejecuta una cuchillada letal con crítico aumentado.
  * **`[E]` Centinela de Hefesto:** Descarga en abanico de saetas eléctricas automatizadas mientras envuelve a la asesina en velocidad de Nix.
* **Las 3 Ramas de Habilidades:**
  1. **Artes de Castigo (*Martial Arts*):**
     * *Golpe de Tigre / Furia de Tisífone* (Nv. 1): acumula hasta 3 cargas que multiplican el daño del siguiente remate.
     * *Garras de Trueno* (Nv. 18): libera nova y rayos cargados.
     * *Vuelo de la Erinia* (Nv. 24): teletransporte con patada de remate sobre el objetivo.
  2. **Trampas de Hefesto (*Traps*):**
     * *Red de Fuego* (Nv. 1): bombas incendiarias arrojadizas.
     * *Centinela de Relámpago* (Nv. 24): torreta que dispara rayos perforantes (*Sinergia:* `+12% daño` por punto en *Centinela de Muerte*).
     * *Centinela de Tártaro* (Nv. 30): dispara rayos y detona cadáveres cercanos automáticamente.
  3. **Velo de Nix (*Shadow Disciplines*):**
     * *Ráfaga de Sombra* (Nv. 6): acelera movimiento y ataque.
     * *Desvanecimiento en el Érebo* (Nv. 18): otorga resistencias elementales y reducción de daño físico oculto (`1% DR` por nivel base).
     * *Reflejo de Némesis* (Nv. 30): invoca un doble sombrío que replica tus habilidades.

---

### VII. Coribante de Pan (`coribante` — *Druida*)
* **Fantasía y Lore:** Sacerdote extático de los misterios de Dioniso, Pan y Cibeles. Al ritmo de tambores y aulos entra en trance teriantrópico —adoptando la forma del *Lobo de Licaón* o la *Osa de Calisto*— o desata cataclismos sísmicos de Gea.
* **Objeto exclusivo de clase:** *Piel de Licaón / Máscara de Sátiro* (yelmo totémico con bonos a Metamorfosis y Cataclismo).
* **Habilidades activas en el prototipo (Vertical Slice):**
  * **`[Q]` Cólera de Gea:** Erupción telúrica y vendaval alrededor del coribante que aplasta y empuja a las criaturas cercanas.
  * **`[E]` Forma de Licaón:** Trance licántropo que regenera salud al instante y desata furia salvaje y robo de vida.
* **Las 3 Ramas de Habilidades:**
  1. **Metamorfosis (*Shape Shifting*):**
     * *Forma de Licaón (Hombre Lobo)* (Nv. 1): gran velocidad de ataque y robo de vida (*Feral Rage*).
     * *Forma de Calisto (Hombre Oso)* (Nv. 6): enorme bonificación de vida, defensa y onda de choque aturdidora.
     * *Furia Salvaje* (Nv. 30): ráfaga de 5 zarpazos consecutivos en forma de Licaón.
  2. **Cataclismo de Gea (*Elemental*):**
     * *Fisura del Etna* (Nv. 12): abre grietas volcánicas bajo los pies de la horda.
     * *Armadura de Céfiro* (Nv. 12): absorbe daño elemental y alimenta la duración del *Huracán*.
     * *Tornado de Eolo* (Nv. 24) y *Huracán* (Nv. 30): daño físico de viento + tormenta gélida constante alrededor del coribante.
  3. **Llamado del Bosque (*Summoning*):**
     * *Espíritu de la Encina Sagrada* (Nv. 6): aura totémica que incrementa la vida máxima del grupo entre `+30%` y `+125%`.
     * *Jauría de Arcadia* (Nv. 18): lobos espectrales de caza.
     * *Oso de Bronce de Calisto* (Nv. 30): invocación tanque de alto impacto.

---

## 3. Fórmulas de Sinergia y Escalado para `src/core/combat.js`

Para mantener la fidelidad matemática con *Diablo II*:

1. **Bono de Sinergia (`synergyMult`):**
   $$\text{Daño Final Habilidad} = \text{Daño Base}(slvl) \times \left(1 + \sum_{i} \text{ basePoints}_i \times \text{synergyPct}_i\right)$$
   *Nota:* Solo cuentan los puntos reales invertidos (`basePoints`), nunca los puntos otorgados por equipo (`+all skills`), evitando inflación exponencial.
2. **Escalado por Escalones de Nivel (`slvl` brackets):**
   * Niveles `1–8`: crecimiento lineal base.
   * Niveles `9–16`: `+1.4×` pendiente.
   * Niveles `17–22`: `+1.8×` pendiente.
   * Niveles `23+`: `+2.3×` pendiente (recompensa la especialización extrema con objetos únicos y reliquias).
