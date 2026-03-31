# miaumiau — Desglose Completo del Sistema

## 1. NAVEGACIÓN

La app es una SPA (Single Page Application) con 4 modos. Un solo `index.html` con 4 `<section>` que se muestran/ocultan.

```
┌─────────────────────────────┐
│  [avatar]   miaumiau   [⚙]  │  ← header fijo
├─────────────────────────────┤
│                             │
│    contenido del modo       │  ← scroll vertical
│    activo                   │
│                             │
├─────────────────────────────┤
│  🔥  📷  💬  ✉️             │  ← tab bar fijo (bottom)
│ stories posts tweets chat   │
└─────────────────────────────┘
```

**Flujo de navegación:**
- Al abrir → si no hay usuario → pantalla de registro (elegir nombre, color, ver avatar generado)
- Al abrir → si hay usuario → modo tweets (default)
- Tap en tab → oculta sección actual, muestra la nueva, carga datos
- Tap en avatar (header) → modal de settings (cambiar color, tema, bio)
- Tap en ⚙ → mismo modal de settings

**Cambio de modo (código mínimo):**
```
go(mode):
  para cada <section>: hidden = true
  section#mode-{mode}: hidden = false
  ejecutar enter_{mode}()
  actualizar tab activo en nav
```

---

## 2. USUARIOS

### Registro
1. Usuario elige un `username` (1-25 chars, alfanumérico + guiones)
2. El sistema genera un `secret` aleatorio (12 chars)
3. Se muestra: "Tu clave es username#secret — guárdala, no se puede recuperar"
4. Se genera un `avatar_seed` aleatorio (entero 32 bits)
5. Se envía POST /api/users con {username, tripcode: hash(secret), color, avatar_seed}
6. Se guarda en localStorage: {username, secret, color, theme}

### Login (reconexión)
No hay login. El secret está en localStorage. Si cambias de dispositivo:
1. Escribes `username#secret` en un campo
2. Se verifica contra el tripcode guardado en D1
3. Se guarda en localStorage

### Tripcode (identidad sin contraseña)
```
tripcode(secret):
  bytes = SHA-256(secret)
  return base36(bytes).slice(0, 8)
```

Cada request autenticado lleva header `X-Miau: username#secret`.
El middleware:
```
auth(request):
  header = request.header('X-Miau')
  {username, secret} = parsear(header)  // split por #
  trip = tripcode(secret)
  user = db.getUser(username)
  si user.tripcode != trip → 401
  sino → request.user = user
```

### Datos del usuario en D1
```
users: id, username, tripcode, color, theme, avatar_seed, bio, created_at, last_seen_at
```

### Avatar (gato procedural SVG)
Endpoint GET /api/users/:id/avatar.svg → genera SVG determinista desde avatar_seed.
Cache-Control: 86400s. Zero storage.

```
avatar(seed):
  rng = seedRandom(seed)
  body = BODIES[rng.int(4)]        // redondo, delgado, gordito, pequeño
  ears = EARS[rng.int(4)]          // puntudo, doblado, mechón, redondo
  eyes = EYES[rng.int(5)]          // redondo, rasgado, grande, dormilón, guiño
  mouth = MOUTHS[rng.int(4)]      // sonrisa, :3, abierto, lengua
  pattern = PATTERNS[rng.int(5)]   // sólido, tabby, tuxedo, calico, manchas
  accessory = ACCESSORIES[rng.int(6)]
  tail = TAILS[rng.int(3)]
  whiskers = WHISKERS[rng.int(3)]
  return SVG(body, ears, eyes, mouth, pattern, accessory, tail, whiskers, userColor)
```

---

## 3. ALMACENAMIENTO

### Dónde vive cada cosa
```
D1 (SQLite):
  └── users, tweets, posts, post_comments, reactions, stories, story_views, messages, conversations

R2 (object storage):
  └── media/
      ├── posts/{id}.webp       (max 300KB)
      ├── stories/{id}.webp     (max 200KB, se borra a las 24h)
      └── chat/{id}.webp        (max 150KB)

localStorage (navegador):
  └── miau_user: {username, secret, color, theme}
```

### Flujo de guardado de contenido

**Tweet:**
```
1. usuario escribe texto (max 1000 chars)
2. POST /api/tweets {content}  (con header X-Miau)
3. servidor: sanitize(content), validate, INSERT INTO tweets
4. respuesta: tweet creado con id, created_at
5. cliente: añadir al timeline sin recargar
```

**Post (imagen):**
```
1. usuario selecciona imagen
2. CLIENTE: compressImage(file) → webp (max 1080px, quality 0.8, target 300KB)
3. CLIENTE: muestra preview + tamaño
4. usuario escribe caption (max 500 chars)
5. POST /api/posts (multipart: image blob + caption)  (con header X-Miau)
6. servidor: validate image (tipo, tamaño), PUT en R2 media/posts/{id}.webp
7. INSERT INTO posts con media_key
8. respuesta: post creado
```

**Story:**
```
1. usuario selecciona imagen de fondo
2. CLIENTE: compressImage(file) → webp (max 1080x1920, quality 0.75, target 200KB)
3. EDITOR: usuario dibuja, añade texto, añade links
4. EXPORTAR: composite de capas → webp final + layers_json
5. POST /api/stories (multipart: image + layers_json)
6. servidor: PUT en R2 media/stories/{id}.webp
7. INSERT INTO stories con expires_at = now + 24h
8. CRON diario: DELETE stories expiradas de D1 y R2
```

**Mensaje de chat:**
```
1. usuario escribe texto (o adjunta imagen comprimida)
2. POST /api/chat/{receiverId} {content, ?image}
3. servidor: INSERT INTO messages, UPDATE conversations
4. receptor: polling GET /api/chat/poll?since=timestamp → recibe mensaje nuevo
```

---

## 4. GENERACIÓN DE CONTENIDO

### 4a. Compresión de imagen (client-side, zero dependencias)
```
compressImage(file, maxW, maxH, quality):
  img = createImageBitmap(file)
  ratio = min(maxW/img.w, maxH/img.h, 1)  // nunca agrandar
  w = round(img.w * ratio)
  h = round(img.h * ratio)
  canvas = OffscreenCanvas(w, h)
  canvas.ctx.drawImage(img, 0, 0, w, h)
  return canvas.toBlob('image/webp', quality)
```

### 4b. Editor de Stories (canvas)

**3 capas apiladas:**
```
┌─────────────────┐
│ capa de links    │  ← <div> con posición absoluta, z-index 3
├─────────────────┤
│ capa de texto    │  ← <div> con posición absoluta, z-index 2
├─────────────────┤
│ capa de dibujo   │  ← <canvas> transparente, z-index 1
├─────────────────┤
│ imagen de fondo  │  ← <img>, z-index 0
└─────────────────┘
```

**Dibujo:**
```
onPointerDown: ctx.beginPath(), ctx.moveTo(x,y), drawing=true
onPointerMove: si drawing → ctx.lineTo(x,y), ctx.stroke()
onPointerUp: drawing=false
```

**Texto:**
```
onTap(modo texto): crear <div contenteditable> en posición del tap
  → usuario escribe
  → arrastrar para mover (touch/mouse drag)
  → toolbar: bold, italic, color (de jordis editor-core)
```

**Links:**
```
onTap(modo link): prompt URL + label
  → crear <div> rectángulo semi-transparente
  → arrastrar para posicionar
```

**Exportación:**
```
export():
  // 1. compositar todo en un canvas
  canvas.drawImage(imagenFondo)
  canvas.drawImage(canvasDibujo)
  // textos y links se renderizan como divs sobre la imagen

  // 2. generar layers_json (para el visor interactivo)
  layers = {
    texts: [{x: 0.5, y: 0.3, text: "hola", size: 24, color: "#fff"}],
    links: [{x: 0.2, y: 0.8, w: 0.6, h: 0.08, url: "...", label: "..."}]
  }

  // 3. comprimir imagen compuesta
  blob = compressImage(canvas, 1080, 1920, 0.75)

  return {blob, layers}
```

### 4c. Visor de Stories
```
┌─────────────────┐
│ ████░░░░░░░░░░░ │  ← barras de progreso (1 por story del usuario)
│                 │
│   imagen story  │  ← <img> con overlays de texto y links
│   + textos      │
│   + links       │
│                 │
│ ← tap    tap →  │  ← navegación: izq=anterior, der=siguiente
└─────────────────┘

visor(stories):
  i = 0
  mostrar(stories[i])
  timer = setInterval(5000): i++, mostrar(stories[i])
  onTapDerecha: clearInterval, i++, mostrar, resetTimer
  onTapIzquierda: clearInterval, i--, mostrar, resetTimer

mostrar(story):
  img.src = media/stories/{id}.webp
  layers = JSON.parse(story.layers_json)
  renderTexts(layers.texts)  // divs posicionados con ratios
  renderLinks(layers.links)  // divs clicables posicionados
  POST /api/stories/{id}/view  // marcar vista
```

### 4d. Rich Text (para tweets y captions)
```
Reutilizar de jordis editor-core.js:
  toggleInlineTag(tag):  // bold, italic, underline
    selection = getSelection()
    si ya tiene tag → quitar
    sino → envolver en <tag>

  applyColor(color):
    selection = getSelection()
    envolver en <span class="c-{color}">

  applyLink():
    url = prompt("URL:")
    envolver en <a href=url target=_blank>
```

### 4e. Feed cronológico (sin algoritmos)
```
loadFeed(mode, page):
  data = GET /api/{mode}?page={page}&limit=20
  para cada item:
    renderItem(item)  // tweet, post, o story según modo
  si hay más → mostrar botón "cargar más"

// sin algoritmos = ORDER BY created_at DESC
// sin publicidad = literalmente no hay ads
// sin tracking = no hay analytics ni cookies de terceros
```

---

## 5. API COMPLETA

```
// Usuarios
GET    /api/users                    → lista usuarios + colores + temas
POST   /api/users                    → registrar {username, secret, color}
PUT    /api/users/:id                → actualizar {color, theme, bio}  [auth]
DELETE /api/users/:id                → borrar cuenta  [auth]
GET    /api/users/:id/avatar.svg     → SVG de gato procedural

// Tweets
GET    /api/tweets?page=1&limit=20   → timeline cronológico
GET    /api/tweets/:id               → tweet + respuestas
POST   /api/tweets                   → crear {content, ?parent_id}  [auth]
POST   /api/tweets/:id/report        → reportar (oculta a 5 reports)

// Posts
GET    /api/posts?page=1&limit=20    → feed cronológico
GET    /api/posts/:id                → post + comentarios
POST   /api/posts                    → crear (multipart: image + caption)  [auth]
POST   /api/posts/:id/comments       → comentar {content}  [auth]

// Reactions (unificado)
POST   /api/reactions                → toggle {target_type, target_id, emoji}  [auth]

// Stories
GET    /api/stories                  → stories activas agrupadas por usuario
POST   /api/stories                  → crear (multipart: image + layers_json)  [auth]
POST   /api/stories/:id/view         → marcar vista  [auth]

// Chat
GET    /api/chat/conversations       → lista conversaciones  [auth]
GET    /api/chat/:userId?before=id   → mensajes con cursor  [auth]
POST   /api/chat/:userId             → enviar {content, ?image}  [auth]
POST   /api/chat/:userId/read        → marcar leídos  [auth]
GET    /api/chat/poll?since=ts       → polling nuevos mensajes  [auth]

// Media
GET    /media/*                      → servir desde R2 (con Range support)
```

---

## 6. TEMAS Y COLORES

**8 temas** (CSS variables, cambian todo el look):
Oscuro, Claro, Terminal, Oceano, Atardecer, Nord, Monokai, Vampiro

**Colores de usuario** (subconjunto curado de W3C):
~30 colores elegidos por categoría (Rojos, Naranjas, Amarillos, Verdes, Azules, Violetas, Rosas)
El color determina: username coloreado + color base del avatar gatuno.

**Aplicación del tema:**
```
applyTheme(id):
  tema = THEMES[id]
  para cada variable en tema:
    document.documentElement.style.setProperty('--' + key, value)
```
