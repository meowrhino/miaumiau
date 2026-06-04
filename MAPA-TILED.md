# Editar el mapa del parque en Tiled 🗺️

El parque (el Retiro) ahora vive en **`public/data/park.tmj`**, un mapa de
[**Tiled**](https://www.mapeditor.org) (editor visual de mapas, gratis). Lo abres,
pintas/colocas a ratón, guardas, y recargas el juego. **Tú no tocas código.**

> Para verlo en el juego mientras es de prueba: **`miaumiauonline.com/?map=tiled`**
> (sin `?map=tiled` se ve el parque viejo). Tras guardar en Tiled: sube los cambios
> (o pídemelo) y recarga con **⌘⇧R**.

---

## 1. Instalar y abrir

1. Baja Tiled: https://www.mapeditor.org → Download (gratis, mac).
2. En Tiled: **File → Open** → elige `public/data/park.tmj`.
3. Deberías ver el parque con sus tilesets cargados (si saliera "archivos no
   encontrados", File → Reload; las rutas son relativas a `public/data/`).

---

## 2. Lo que verás: 4 capas (panel **Capas**, derecha)

De abajo a arriba (se pintan en ese orden):

| Capa | Tipo | Qué es | Con qué se pinta |
|---|---|---|---|
| **suelo** | tiles | césped + flores (todo el fondo) | tileset **grass** |
| **caminos** | tiles | adoquín (avenidas) + plaza de piedra | **grass** (baldosas) / **stone** |
| **terraza** | tiles | plataformas elevadas (mirador) | **stone** (9-slice) |
| **muros** | tiles | muros/paredes de piedra (las haces tú) | tileset **wall** |
| **props** | objetos | árboles, bancos, estatua, fuente… (tuyos) | colecciones **plants / struct / deco** |
| **estructuras** | objetos | escaleras, arcos, pilares, monumentos | colecciones **struct / deco** |
| **agua** | tiles | estanque/arroyo (créala tú) | tileset **water** |
| **colision** *(oculta)* | tiles | dónde NO se puede andar | cualquier tile (no se ve) |

Haz clic en una capa para seleccionarla **antes** de pintar/colocar en ella.

> 🚧 **Navegabilidad (colisión):** en el juego, **NO se anda** por las celdas que tengan
> tile en las capas **`muros`**, **`agua`** o **`colision`**. Así tus muros son sólidos.
> Para una **terraza navegable** (subir por escaleras): pinta la plataforma en `terraza`,
> pon su **borde** en la capa `colision` (bloquea) dejando un **hueco** donde va la escalera,
> y coloca la escalera (objeto de `struct`) en ese hueco. ¡Subes por la escalera, no atraviesas!

## 3. Los tilesets (panel **Conjunto de Patrones**, abajo-derecha)

- **grass** (rejilla): césped liso, césped con flores, y el **adoquín-sobre-césped**
  (las baldosas grises de abajo). Para suelo y caminos.
- **stone** (rejilla): piedra lisa + decoraciones. Para plazas/suelo de piedra.
- **wall** (rejilla): ladrillo y muros de terraza. Para la capa `muros`.
- **plants / struct / deco** (colecciones de imágenes): árboles, arbustos, escaleras,
  arcos, pilares, bancos, barriles, estatuas, lápidas, fuente, pozo… Para `props`.

---

## 4. Cómo hacer las cosas

**Modificar el suelo / pintar adoquín** (capas de tiles):
1. Selecciona la capa (`suelo` o `caminos`).
2. En el tileset (grass/stone), clic en el tile que quieras.
3. Herramienta **Pincel** (B) → pinta en el mapa. **Cubo** (F) rellena un área.
   **Goma** (E) borra.

**Añadir un árbol / banco / estatua / etc.** (capa de objetos):
1. Selecciona la capa **props**.
2. Herramienta **Insertar Patrón** (la del icono de estampar objeto).
3. En una colección (plants/struct/deco), clic en el sprite que quieras.
4. Clic en el mapa para colocarlo. Con la **flecha de objetos** (S) lo
   mueves, rotas o redimensionas.

**Mover/quitar un árbol existente:** capa `props` → herramienta flecha de objetos →
clic en el árbol → arrastra, o Supr para borrar.

---

## 5. Guardar (importante para que el juego lo lea)

- **⌘S**. Mantén el formato **.tmj / JSON**.
- Si Tiled pregunta: tilesets **embebidos** (no externos) y capas **sin comprimir**
  (CSV/array), que es como está ahora. Así el cargador del juego lo entiende.
- Sube el archivo (git) o dímelo, y recarga `?map=tiled` con ⌘⇧R.

---

## 6. Estado actual (v1) y qué pulir

Hecho: césped+flores, adoquín (avenidas+plaza), 132 árboles en bosquecillos,
landmarks (Parterre, Rosaleda, Observatorio, Cristal, Casita, Moyano), fuente,
escaleras, arcos en las puertas. Los 6 tilesets vinculados.

Por pulir (fácil en Tiled, o dímelo):
- **Muros**: ahora el borde usa un tile que parece suelo. Hay que pintarlos con
  los tiles de muro/terraza de `wall` (cara de ladrillo + remate) para que se vean
  como pared. (Es lo que mejor harás tú a ojo.)
- **Agua** (estanque/arroyo): Cainos no trae tile de agua → pendiente de decidir
  (tile a medida o color).
- **Farolas**: el pack no trae farola → pendiente.
- **Niveles/terrazas**: con la capa `muros` + escaleras de `struct` se pueden hacer
  zonas elevadas; lo montamos cuando quieras.
