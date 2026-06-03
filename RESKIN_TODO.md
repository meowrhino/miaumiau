# Reskin "El Retiro" con Cainos — cola de revisión

Estilo: **Pixel Art Top Down - Basic** (Cainos, gratis+comercial). Mundo = parque.
Avatares = poporings procedurales (NO se tocan).

## ✅ Hecho (en vivo)
- [x] Césped (textura Cainos)
- [x] Caminos / paseos (piedra Cainos)
- [x] Verja (muro de piedra Cainos)
- [x] Árboles (3 variantes Cainos)
- [x] Fuente del feed (pila de piedra Cainos)
- [x] Agua del lago + arroyo (adaptada: azul apagado + orilla de piedra — Cainos no trae agua)

## ⚠️ A REHACER — caminos y agua salieron PLANOS (manu: "no se ve suficiente")
Atajo usado: textura lisa repetida (CanvasPattern). **Ruta nueva a decidir:**
- (a) colocar tiles de Cainos CON BORDES (autotile: camino con borde de hierba, etc.)
- (b) o BAKEAR el suelo del parque entero como una imagen compuesta (mejor look; mapa es fijo)

## ⏳ Pendiente

### Los 6 modos (casitas → "cosas de parque") — modo a modo
- [x] 📌 el tablón (posts) → carteles de madera ✅ EN VIVO
- [x] 🪑 la Rosaleda (chat) → setos / arbustos ✅ EN VIVO
- [x] 🌙 el Observatorio (stories) → estatua/monumento de piedra ✅ EN VIVO
- [x] ☕ el Parterre (tweets) → árbol grande + bancos ✅ EN VIVO
- [~] 📷 el Palacio de Cristal (bereal) → placeholder (pila de piedra) ✅; PENDIENTE asset propio
- [~] 🏠 la Casita (profile) → placeholder (barriles + banco) ✅; PENDIENTE asset propio
  (los 6 modos ya NO son casitas — mecanismo drawZoneFeature)

### ⚠️ Deco procedural que AÚN CANTA (choca con Cainos) — REVISAR JUNTOS
- [ ] **Cottages residenciales** (casitas tejado azul/teja del fondo) — el estilo viejo, choca fuerte
- [ ] bakery / barn / mill / workshop / well / stage — procedurales
- [ ] Puestos de mercado (a rayas) + farolas — procedurales
→ opción: quitarlos, o cambiarlos por props/estructuras de Cainos, o assets propios

### Pulido
- [ ] Bordes de los caminos (transición césped↔piedra, autotile de Cainos)
- [ ] Arbustos/setos + flores sueltos por el parque (Cainos los tiene)
- [ ] Props extra: barriles, bancos, lápidas, estatua

### Cosas que Cainos NO cubre → inventar / adaptar / custom
- Agua → ✅ adaptada (procedural reestilizada)
- Palacio de Cristal, Casita (edificios) → arte a medida a futuro
- Farolas → buscar prop o inventar
