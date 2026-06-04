# Reskin "El Retiro" con Cainos — cola de revisión

Estilo: **Pixel Art Top Down - Basic** (Cainos, gratis+comercial, sin IA). Mundo = parque.
Avatares = poporings procedurales (NO se tocan).
Todo el mapa son DATOS en `public/js/city.config.js` → guía en `MAPA.md`.
Por cada paso: commit + `git push origin main` + `wrangler deploy` (en primer plano).

---

## 🐞 BUGS marcados por manu (3 capturas)

1. [x] **Props tapaban al personaje (z-order)** — ARREGLADO. Cada prop de zona (árbol,
   banco, estatua, barril…) entra ahora individualmente al y-sort por su base →
   **walk-behind real**: `getZoneProps` + `drawProp` en `city.render.buildings.js`,
   expandidos como entidades `'prop'` en el sort de `city.render.js`. (Antes toda la zona
   se pintaba en un único punto y el feature alto saltaba delante del jugador.)
2. [x] **El "banco" parecía una LÁPIDA** — ARREGLADO. `BENCH` apuntaba a `{225,36}` = la
   lápida gris del atlas. Movido al banco real `{292,19,56,41}` (verificado con análisis
   de cajas por alpha). Estatua → `{445,21,37,72}` y barril → `{162,153,28,36}` también a
   sus cajas exactas. Afecta **el Parterre** y **la Casita**.
3. [~] **Parterre / Casita flojos** — con el banco bueno + z-order ya respiran; lo que
   queda de verdad (Palacio de Cristal, Casita del Pescador, agua) es la tarea (B) de
   assets propios → más abajo.

---

## ✅ Hecho (en vivo en miaumiauonline.com)
- [x] Césped, caminos, verja, árboles, fuente del feed (tiles Cainos)
- [x] Agua del lago + arroyo (adaptada: azul apagado + orilla de piedra — Cainos no trae agua)
- [x] Las 6 casitas → "features de parque" (`drawZoneFeature`, un `if` por modo):
  - [x] 📌 tablón (posts) → carteles de madera
  - [x] 🪑 Rosaleda (chat) → setos / arbustos
  - [x] 🌙 Observatorio (stories) → estatua de piedra
  - [x] ☕ Parterre (tweets) → árbol + bancos (banco real + walk-behind, bugs 1,2 ✓)
  - [~] 📷 Palacio de Cristal (bereal) → placeholder pila de piedra (falta asset propio)
  - [~] 🏠 Casita del Pescador (profile) → placeholder barriles+banco (falta asset propio)
- [x] Deco procedural que chocaba: QUITADO (cottages/bakery/barn/workshop/well/stage)
- [x] Purga round 1 (drawHouseOverlay, ZONE_ANCHORS, loadSprites slim)
- [x] `MAPA.md` = guía para editar el mapa fácil

---

## ⏳ Pendiente (después de los bugs)

### (B) Assets propios — manu: "los haces tú y lo vemos"
- [ ] **Palacio de Cristal** (bereal) — construir con piezas Cainos (wall+arcos+tejado de `struct.png`)
- [ ] **Casita del Pescador** (profile) — ídem, cabañita junto al agua
- [ ] **Agua / lago** — tile de agua a medida (la actual es un parche de color)

### (C) Caminos "terminados" (autotile) — rebuild grande
Hoy los caminos son curvas pintadas (se ven de boceto). La ref de manu (**Cainos Scene
Overview**) usa cobblestone con **bordes reales** + escaleras + muros de piedra.
- [ ] Caminos en cuadrícula + rule-tile de Cainos (autotile centro/bordes/esquinas)
- [ ] (alternativa más barata) bakear el suelo entero como una imagen compuesta

### (D) Purga round 2 (invisible, no rompe nada)
- [ ] `sprites.js` (~62KB) tiene generadores procedurales SIN uso (house/cottage/bakery/barn/
  workshop/well/stage/fountain/bush/bench/fence/trees/grassTile/cobbleTile/dirtPathTile).
  Solo se usan mill/marketStall/lampPost/cloud. Quitar el resto (verificar con smoke-test).

### Pulido suelto (cuando apetezca)
- [ ] Arbustos/setos/flores sueltos por el parque (Cainos los tiene)
- [ ] Props extra bien colocados: barriles, bancos buenos, estatuas
