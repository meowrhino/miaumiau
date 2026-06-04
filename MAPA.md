# Cómo funciona y cómo editar el MAPA (parque "El Retiro")

Todo el mapa es **DATOS** en un solo sitio: **`public/js/city.config.js`**.
Si editas ahí, el mapa cambia. No hace falta tocar el render.

## Lo básico
- **Mundo:** `W = 6400`, `H = 4800` (ancho × alto, en píxeles). La cámara **sigue al jugador**.
- **Coordenadas:** `x` crece a la derecha, `y` crece hacia abajo. (0,0) = esquina arriba-izquierda.
- El render lee estos datos y los pinta con los tiles de **Cainos** (`public/img/cainos/`).

## Qué hay en `city.config.js` (y cómo tocarlo)

| Dato | Qué es | Para editar |
|---|---|---|
| `W`, `H` | tamaño del mundo | cambia los números |
| `SPAWN` | dónde apareces `{x, y}` | mueve el punto |
| `VERJA` | el **muro/contorno** del parque, una lista de puntos `{x,y}` | añade/mueve puntos (es un polígono cerrado) |
| `WATER` | lagos y arroyo | `rect` (estanque), `ellipse` (charca), `stroke` (arroyo, lista de puntos + ancho `w`) |
| `PASEOS` | los **caminos**: cada uno es una lista de puntos `[{x,y}, {x,y}…]` | mueve/añade puntos; añade un camino nuevo metiendo otra lista |
| `PLAZA` | la explanada central de piedra `{x, y, rx, ry}` (elipse) | mueve/redimensiona |
| `ZONES` | **los 6 modos** (café, tablón, miradero…). Cada uno: `id`, `name`, `x`, `y`, `w`, `h`, `color` | cambia `x,y` para mover un modo; `name` es el cartel |
| `DECO_BUILDINGS` | deco suelto (puestos del feed + molino) | añade `{ kind, x, y, h }` |
| `TREES` | árboles (se generan solos por todo el césped) | cambia la fórmula del bucle, o mete puntos a mano |
| `LAMPS` | farolas `{x, y}` | añade/mueve |
| `GATES` | puertas de la verja (warps) | `{x, y, label}` |

## Recetas rápidas
- **Mover un modo** (p.ej. el café): busca en `ZONES` el de `id:'tweets'` y cambia su `x`/`y`.
- **Cambiar un camino:** edita su lista de puntos en `PASEOS`. Más puntos = más curva.
- **Cambiar la forma del parque:** mueve los puntos de `VERJA`.
- **Añadir agua:** mete un objeto nuevo en `WATER`.
- **Qué "cosa de parque" es cada modo** (fuente, setos, estatua…): eso está en
  `public/js/city.render.buildings.js`, función `drawZoneFeature` (un `if` por `id`).

## Dónde está cada cosa del render (por si quieres bajar más)
- `city.render.ground.js` → césped, **caminos**, agua, explanada, verja, warps.
- `city.render.buildings.js` → los 6 modos (`drawZoneFeature`) + deco + mascota + nombre.
- `city.render.entities.js` → árboles, farolas, fuente, jugador, otros, **chat** (HUD + ventana).
- `city.config.js` → **TODOS los datos del mapa** (lo de arriba).

## Pendiente (lo "fino" que falta)
Los **caminos** ahora son curvas pintadas a mano (se ven algo de boceto). Para que queden
como la referencia de Cainos (cobblestone con **bordes** de verdad) hace falta un sistema de
**autotile** (caminos en cuadrícula + reglas de borde). Es un rebuild grande — pendiente.
