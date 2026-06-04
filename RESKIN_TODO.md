# Reskin "El Retiro" con Cainos — cola de revisión

Estilo: **Pixel Art Top Down - Basic** (Cainos, gratis+comercial, sin IA). Mundo = parque.
Avatares = poporings procedurales (NO se tocan).
Todo el mapa son DATOS en `public/js/city.config.js` → guía en `MAPA.md`.
Por cada paso: commit + `git push origin main` + `wrangler deploy` (en primer plano).

---

## 🐞 BUGS a arreglar PRIMERO (los marcó manu, 3 capturas)

1. **Props tapan al personaje (z-order).** En `city.render.buildings.js` → `drawZoneFeature`
   dibuja árbol/bancos/barriles/estatua anclados en `gy = z.y + z.h - 30`. El jugador es
   otra entidad, y el feature alto lo tapa. → o y-sort de verdad (walk-behind), o pintar
   SIEMPRE al jugador encima. (Ver orden de capas en `city.js`.)
2. **Los "bancos" parecen LÁPIDAS.** `BENCH = {sx:225, sy:36, sw:62, sh:26}` (cainos:props)
   sale como una losa gris. La coord seguramente está mal → re-inspeccionar `props.png` con
   el overlay de cuadrícula 32px en el navegador y buscar un banco real, o cambiar el prop.
   Afecta **el Parterre** y **la Casita**.
3. **El Parterre / la Casita quedan flojos** = son placeholders. Rehacer con buenos props
   (o con los assets propios del punto B).

---

## ✅ Hecho (en vivo en miaumiauonline.com)
- [x] Césped, caminos, verja, árboles, fuente del feed (tiles Cainos)
- [x] Agua del lago + arroyo (adaptada: azul apagado + orilla de piedra — Cainos no trae agua)
- [x] Las 6 casitas → "features de parque" (`drawZoneFeature`, un `if` por modo):
  - [x] 📌 tablón (posts) → carteles de madera
  - [x] 🪑 Rosaleda (chat) → setos / arbustos
  - [x] 🌙 Observatorio (stories) → estatua de piedra
  - [x] ☕ Parterre (tweets) → árbol + bancos  ← revisar (bugs 1,2,3)
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
