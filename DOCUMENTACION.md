# Documentación completa de ServiHogar

> Explicado desde cero, sin asumir conocimientos previos. Lee primero la sección
> "0. La idea general" para entender cómo encaja todo; luego cada archivo.

---

## 0. La idea general (cómo se conecta TODO)

ServiHogar es una página web donde **clientes** buscan y contactan a **trabajadores**
del hogar (gasfiteros, electricistas, limpieza, etc.), y los trabajadores **publican**
sus servicios. Tiene chat entre ambos.

El proyecto tiene **tres grandes piezas** que se hablan entre sí:

1. **El Frontend (lo que ves en el navegador).**
   Son los archivos `.html` (la estructura), `.css` (los colores y la forma) y los
   `.js` que están dentro de `assets/js/` (el comportamiento: botones, formularios, chat).
   Esto corre **en el navegador** de cada persona (Chrome, Edge, el celular...).

2. **El Backend / Servidor (`server.js`).**
   Es un programa hecho en **Node.js** que corre en una computadora servidor (tu laptop
   cuando pruebas, o **Render** cuando está en internet). Hace dos trabajos:
   - **Entrega los archivos** del frontend al navegador (sirve los `.html`, `.css`, `.js`).
   - Ofrece una **API**: un conjunto de "puertas" en direcciones que empiezan con `/api/`
     (por ejemplo `/api/login`). El frontend le pide o le manda datos a esas puertas.

3. **La Base de Datos (Supabase / PostgreSQL).**
   Es donde se **guardan permanentemente** los datos: usuarios, publicaciones, mensajes.
   Si no hay base en la nube, `server.js` usa un archivo local llamado `servihogar.db`
   (SQLite). En internet usa **Supabase** (PostgreSQL).

### El recorrido de un dato (ejemplo: iniciar sesión)
1. En el navegador escribes correo y contraseña y pulsas "Entrar" → eso lo maneja
   `assets/js/app.js`.
2. `app.js` llama a `DB.login(...)` que está en `assets/js/datos.js`.
3. `datos.js` hace un `fetch("/api/login", ...)` → o sea, **manda una petición por internet**
   al servidor `server.js`.
4. `server.js` recibe la petición, busca el usuario en la **base de datos** y compara la
   contraseña. Responde "sí, este es el usuario" o "no, incorrecto".
5. `datos.js` recibe la respuesta y se la devuelve a `app.js`, que entonces te deja entrar
   o te muestra el error.

Esa cadena **navegador → datos.js → server.js → base de datos → de vuelta** es el corazón
del proyecto. Cada vez que algo se guarda o se carga, pasa por ahí.

### Mapa de archivos
```
demoparadigma2-main2/
├── server.js               ← EL SERVIDOR (backend) + conexión a la base de datos
├── package.json            ← ficha del proyecto y su dependencia (pg)
├── package-lock.json       ← versiones exactas de las dependencias
├── iniciar-servidor.bat    ← arranca el servidor con doble clic (Windows)
├── .gitignore              ← qué NO subir a GitHub
├── README.md               ← instrucciones de uso
│
├── index.html              ← portada (pública)
├── login.html              ← iniciar sesión (pública)
├── registro.html           ← crear cuenta (pública)
├── como-funciona.html      ← información (pública)
├── sobre-nosotros.html     ← el equipo (pública)
│
├── app-inicio.html         ← dentro de la app: inicio/feed
├── app-buscar.html         ← buscar trabajadores
├── app-publicar.html       ← publicar un servicio (trabajador)
├── app-chat.html           ← chat
├── app-historial.html      ← historial
├── app-perfil.html         ← perfil
│
└── assets/
    ├── css/
    │   ├── styles.css        ← estilos de las páginas públicas
    │   ├── app.css           ← estilos de la app interna
    │   └── sobre-nosotros.css ← estilos extra de "sobre nosotros"
    ├── js/
    │   ├── datos.js          ← CAPA DE DATOS: habla con la API (fetch)
    │   ├── app.js            ← lógica del login
    │   ├── registro.js       ← lógica del registro
    │   ├── perfil.js         ← lógica del perfil
    │   └── app-interno.js    ← TODA la lógica de la app (feed, buscar, chat, etc.)
    └── images/               ← imágenes y logo
```

**Diferencia importante entre las dos "zonas":**
- **Páginas públicas** (`index`, `login`, `registro`, `como-funciona`, `sobre-nosotros`):
  usan `styles.css`. Cualquiera las ve sin haber iniciado sesión.
- **Páginas de la app** (`app-*.html`): usan `app.css` y `app-interno.js`. Solo se ven si
  has iniciado sesión; si no, te mandan al login.

---

## Archivo: server.js

### Propósito general
Es el **cerebro del backend**. Hace TODO lo del lado del servidor:
- Crea y conecta la base de datos (Supabase o SQLite).
- Crea las tablas si no existen y mete datos de ejemplo la primera vez.
- Define la **API** (las puertas `/api/...`) para registrar, iniciar sesión, publicar,
  chatear, etc.
- **Sirve** los archivos del frontend (html, css, js, imágenes).

Está escrito en **Node.js**. Para arrancarlo: `node server.js`.

### Bloque por bloque

```js
"use strict";
```
Activa el "modo estricto" de JavaScript: hace que el lenguaje sea más exigente y avise de
errores tontos (por ejemplo, usar una variable sin declararla). Es una buena práctica.

```js
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
```
`require(...)` es como decir "tráeme esta caja de herramientas". Aquí trae **módulos
integrados** de Node (no hay que instalarlos):
- `http`: para crear un servidor web que escucha peticiones.
- `fs` (file system): para **leer archivos** del disco (los html, css, imágenes).
- `path`: para armar rutas de carpetas/archivos sin equivocarse entre Windows y Linux.
- `crypto`: para **cifrar contraseñas** (convertirlas en un código irreversible).

```js
const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "servihogar.db");
const USE_PG = !!process.env.DATABASE_URL;
```
- `__dirname` es "la carpeta donde está este archivo". Lo guardamos en `ROOT`.
- `process.env.PORT` es una **variable de entorno**: un valor que viene de afuera (lo pone
  Render). Si no existe, usamos el `3000`. (`||` significa "si lo de la izquierda está
  vacío, usa lo de la derecha").
- `DB_PATH`: dónde se guarda la base local SQLite (si no hay Supabase).
- `USE_PG`: ¿hay una variable `DATABASE_URL`? Si la hay, significa que vamos a usar
  **Postgres (Supabase)**. El `!!` convierte el valor en verdadero/falso (true/false).
  **Aquí se decide automáticamente** si el proyecto usa Supabase o el archivo local.

#### La "capa de base de datos" (funciona igual con SQLite y con Postgres)

```js
let DB;
const BIG = USE_PG ? "BIGINT" : "INTEGER";
```
`DB` será un objeto con funciones para hablar con la base. `BIG` es el tipo de dato para
números grandes (las fechas se guardan como números enormes): en Postgres se llama
`BIGINT`, en SQLite `INTEGER`. El `? :` es un "si... entonces... si no..." corto.

```js
if (USE_PG) {
  const pg = require("pg");
  pg.types.setTypeParser(20, (v) => parseInt(v, 10)); // BIGINT -> número
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const conv = (sql) => { let i = 0; return sql.replace(/\?/g, () => "$" + (++i)); };
  DB = {
    async query(sql, params = []) { return (await pool.query(conv(sql), params)).rows; },
    async get(sql, params = []) { return (await pool.query(conv(sql), params)).rows[0]; },
    async run(sql, params = []) { await pool.query(conv(sql), params); },
    async exec(sql) { await pool.query(sql); },
  };
  console.log("Base de datos: PostgreSQL (Supabase)");
}
```
**ESTE es el bloque que conecta con Supabase.** Solo se ejecuta si `USE_PG` es verdadero
(o sea, si pusiste `DATABASE_URL`):
- `require("pg")`: trae la librería **`pg`** (la única que se instala con `npm install`;
  sirve para hablar con PostgreSQL).
- `pg.types.setTypeParser(20, ...)`: un arreglo técnico. Postgres devuelve los números
  gigantes (BIGINT, tipo número 20) como **texto** para no perder precisión; aquí le
  decimos "conviértelos a número normal". Sin esto, las fechas del chat fallarían.
- `new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: ... })`: crea un **"pool"**
  (un grupo de conexiones reutilizables) hacia tu base de Supabase. La dirección y la
  contraseña vienen dentro de `DATABASE_URL`. `ssl` activa la conexión segura (cifrada),
  obligatoria en Supabase.
- `conv(sql)`: SQLite usa `?` para los huecos de una consulta, pero Postgres usa `$1, $2`.
  Esta función reemplaza cada `?` por `$1`, `$2`, etc., para que el mismo código SQL sirva
  en ambos.
- `DB = { query, get, run, exec }`: definimos 4 funciones:
  - `query`: ejecuta una consulta y devuelve **todas** las filas.
  - `get`: igual pero devuelve solo la **primera** fila.
  - `run`: ejecuta algo que no devuelve filas (insertar, borrar, actualizar).
  - `exec`: ejecuta SQL "tal cual" (se usa para crear las tablas).
  Todas tienen `async` porque hablar con una base en internet **toma tiempo** y hay que
  "esperar" (más abajo se usa con `await`).

```js
} else {
  const { DatabaseSync } = require("node:sqlite");
  const sdb = new DatabaseSync(DB_PATH);
  DB = {
    async query(sql, params = []) { return sdb.prepare(sql).all(...params); },
    async get(sql, params = []) { return sdb.prepare(sql).get(...params); },
    async run(sql, params = []) { sdb.prepare(sql).run(...params); },
    async exec(sql) { sdb.exec(sql); },
  };
  console.log("Base de datos: SQLite local (" + DB_PATH + ")");
}
```
Si NO hay Supabase, se usa **SQLite**: una base de datos guardada en un solo archivo
(`servihogar.db`) que viene **integrada en Node** (módulo `node:sqlite`), sin instalar nada.
Se definen las MISMAS 4 funciones (`query/get/run/exec`) pero usando SQLite. Gracias a esto,
**el resto del programa no necesita saber** si está usando Supabase o SQLite: siempre llama
a `DB.query`, `DB.get`, etc.

#### Crear las tablas (el esquema)

```js
async function crearEsquema() {
  await DB.exec(`
    CREATE TABLE IF NOT EXISTS usuarios ( ... );
    CREATE TABLE IF NOT EXISTS publicaciones ( ... );
    CREATE TABLE IF NOT EXISTS mensajes ( ... );
    CREATE TABLE IF NOT EXISTS chats_ocultos ( ... );
  `);
}
```
Una **tabla** es como una hoja de Excel: filas y columnas. `CREATE TABLE IF NOT EXISTS`
significa "crea esta tabla solo si todavía no existe" (así no da error si ya estaba).
- **usuarios**: cada fila es una persona (nombre, correo, contraseña cifrada, tipo
  cliente/trabajador, dni, categoría, verificado...).
- **publicaciones**: cada fila es un servicio que publicó un trabajador.
- **mensajes**: cada fila es un mensaje del chat (de quién, para quién, texto, imagen, fecha).
- **chats_ocultos**: registra cuándo un usuario "vació" un chat (para ocultárselo solo a él).

`await` significa "espera a que esto termine antes de seguir" (porque crear tablas toma un
instante).

#### Utilidades (funciones de apoyo)

```js
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
```
Genera un **identificador único** (un código tipo `m3k1a2bq9`) mezclando la fecha actual y
un número al azar. Se usa para darle un `id` a cada usuario, publicación y mensaje.

```js
function norm(c) { return (c || "").trim().toLowerCase(); }
```
"Normaliza" un correo: le quita espacios (`trim`) y lo pasa a minúsculas (`toLowerCase`),
así `Juan@Mail.com ` y `juan@mail.com` se tratan igual.

```js
function claveChat(a, b) { return [norm(a), norm(b)].sort().join("|"); }
```
Crea una **clave única para una conversación entre dos correos**. Los ordena alfabéticamente
y los une con `|`. Así, la conversación entre Ana y Carlos siempre tiene la misma clave sin
importar quién escriba primero (`ana@..|carlos@..`).

```js
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, salt, 64).toString("hex");
  return salt + ":" + h;
}
```
**Cifra la contraseña.** Nunca se guarda la contraseña real. Se crea una "sal" (`salt`):
unos bytes al azar, y se usa el algoritmo `scrypt` para convertir contraseña+sal en un
código irreversible (`h`). Se guarda `sal:código`. Aunque alguien robe la base, no puede
saber la contraseña original.

```js
function verifyPassword(pw, stored) {
  if (!stored || stored.indexOf(":") === -1) return false;
  const [salt, h] = stored.split(":");
  const hh = crypto.scryptSync(pw, salt, 64).toString("hex");
  const a = Buffer.from(h, "hex"); const b = Buffer.from(hh, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```
**Comprueba una contraseña al iniciar sesión.** Separa la sal y el código guardados, vuelve
a cifrar la contraseña que el usuario escribió con esa misma sal, y compara los dos códigos.
`timingSafeEqual` compara de forma segura (evita un truco de hackers que mide el tiempo de
comparación). Devuelve verdadero solo si coinciden.

```js
function publicoUsuario(u) { ... return { id, nombre, ..., verificado: !!u.verificado }; }
function publicaPub(p) { ... }
```
Estas funciones toman una fila de la base y la convierten al formato que el frontend espera.
**Importante:** `publicoUsuario` **NO incluye la contraseña** → al navegador nunca se le
manda la contraseña (ni cifrada). `!!u.verificado` convierte 1/0 en true/false.

```js
async function corteDe(clave, correo) {
  const row = await DB.get("SELECT corte FROM chats_ocultos WHERE clave=? AND correo=?", [clave, norm(correo)]);
  return row ? row.corte : 0;
}
```
Devuelve el "punto de corte" de un usuario en una conversación: la fecha desde la cual él
vació el chat. Si nunca lo vació, devuelve 0 (ve todo). Esto hace que "vaciar chat" afecte
solo a quien lo hizo.

#### Datos de ejemplo (sembrado)

```js
async function sembrar() {
  const row = await DB.get("SELECT COUNT(*) AS n FROM usuarios");
  if (Number(row.n) > 0) return;
  ... inserta 3 usuarios, 2 publicaciones, 3 mensajes ...
}
```
"Sembrar" = meter datos iniciales. Primero cuenta los usuarios; **si ya hay alguno, no hace
nada** (`return`). Si la base está vacía (primera vez), crea las cuentas de ejemplo
(`cliente@`, `trabajador@`, `rosa@`, con contraseña `123456`), dos publicaciones y una
conversación de muestra. Por eso, al empezar de cero, ya tienes con qué probar.

#### La API (las puertas /api/...)

```js
function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
```
Función para **responder** al navegador en formato JSON (texto estructurado). `code` es el
código HTTP (200 = ok, 404 = no encontrado, 401 = no autorizado, etc.). `JSON.stringify`
convierte un objeto de JavaScript en texto para enviarlo.

```js
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 8*1024*1024) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
  });
}
```
**Lee lo que el navegador manda** (por ejemplo, los datos del formulario de registro). Los
datos llegan en pedacitos (`"data"`), se van juntando; al terminar (`"end"`) se convierten
de texto a objeto con `JSON.parse`. El `if (data.length > 8MB)` corta peticiones demasiado
grandes (protección). Devuelve una **Promesa** (algo que se resuelve "después").

```js
async function manejarApi(req, res, url) {
  const ruta = url.pathname;     // ej: "/api/login"
  const q = url.searchParams;    // ej: ?correo=...  -> q.get("correo")
  const metodo = req.method;     // "GET", "POST", "DELETE"
  ...
}
```
Esta es la función que **decide qué hacer según la puerta** que se pidió. Compara `ruta` y
`metodo` y entra al bloque correspondiente. A continuación, cada puerta:

- **`POST /api/registro`** — crear cuenta. Valida que no falten datos, que el correo no
  exista ya (`SELECT 1 ... WHERE correo`), que el DNI no esté repetido; cifra la contraseña
  con `hashPassword`, hace `INSERT INTO usuarios`, y responde con el usuario creado (sin
  contraseña). Se conecta con `registro.js` del frontend.

- **`POST /api/login`** — iniciar sesión. Busca el usuario por correo; usa `verifyPassword`.
  Si coincide responde el usuario; si no, responde código **401** ("incorrecto"). Se conecta
  con `app.js`.

- **`GET /api/usuarios`** — devuelve la lista de usuarios **sin contraseñas**. La usa el
  frontend para mostrar trabajadores en "Buscar" y para saber el nombre del otro en el chat.

- **`GET /api/publicaciones`** — devuelve todas las publicaciones (ordenadas por fecha).
  **`POST /api/publicaciones`** — crea una publicación (`INSERT`).
  **`DELETE /api/publicaciones/:id`** — borra una por su id.

- **`GET /api/conversaciones?correo=`** — arma la lista de chats de un usuario. Toma todos
  sus mensajes, los **agrupa por la otra persona**, aplica el "corte" (lo vaciado se oculta),
  y devuelve el último mensaje de cada conversación.

- **`GET /api/mensajes?viewer=&otro=`** — devuelve los mensajes entre dos personas,
  **filtrados** para "viewer" (no le muestra lo que él vació).
  **`POST /api/mensajes`** — guarda un mensaje nuevo (texto o imagen).

- **`POST /api/chats/vaciar`** — registra en `chats_ocultos` que un usuario vació un chat
  (guarda el momento del último mensaje como "corte").

Si la ruta no coincide con ninguna, responde **404**.

#### Servir los archivos del frontend

```js
const MIME = { ".html": "text/html; charset=utf-8", ".css": "...", ".js": "...", ... };
function servirEstatico(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const fp = path.join(ROOT, path.normalize(rel));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end("Prohibido"); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404, ...); return res.end("404 - No encontrado"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}
```
Cuando el navegador pide algo que NO empieza con `/api/` (un html, css, imagen...), entra
aquí:
- Si pide `/` (la raíz), se le da `index.html`.
- `path.join(ROOT, ...)` arma la ruta real del archivo en el disco.
- `if (!fp.startsWith(ROOT))`: **seguridad**. Evita que alguien pida algo fuera de la carpeta
  del proyecto (por ejemplo `../../contraseñas`). Si lo intenta, responde 403 (prohibido).
- `fs.readFile`: lee el archivo. Si no existe, responde 404. Si existe, responde 200 con el
  `Content-Type` correcto (el navegador necesita saber si es html, css, imagen...). El `MIME`
  es la tabla que relaciona la extensión (`.css`) con su tipo (`text/css`).

#### Arranque del servidor

```js
(async function iniciar() {
  await crearEsquema();
  await sembrar();
  http.createServer((req, res) => {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    if (url.pathname.startsWith("/api/")) {
      manejarApi(req, res, url).catch((e) => { console.error(e); sendJson(res, 500, { error: "Error del servidor." }); });
    } else {
      servirEstatico(req, res, url);
    }
  }).listen(PORT, () => {
    console.log("ServiHogar funcionando en  http://localhost:" + PORT);
    ...
  });
})().catch((e) => { console.error("No se pudo iniciar:", e); process.exit(1); });
```
Esto es lo que **realmente echa a andar todo**, en orden:
1. `await crearEsquema()`: crea las tablas.
2. `await sembrar()`: mete datos de ejemplo si hace falta.
3. `http.createServer(...)`: crea el servidor. Por **cada petición** que llega:
   - Si la dirección empieza con `/api/` → la maneja `manejarApi` (la API). El `.catch`
     atrapa cualquier error y responde 500 sin tumbar el servidor.
   - Si no → `servirEstatico` (entrega un archivo).
4. `.listen(PORT, ...)`: pone el servidor a **escuchar** en el puerto (3000 local, o el que
   ponga Render). Cuando está listo, imprime el mensaje en la consola.
- La forma `(async function iniciar(){ ... })()` significa "define esta función y ejecútala
  de inmediato". El `.catch` final atrapa errores de arranque (por ejemplo, si Supabase no
  conecta) y cierra el programa avisando.

### Conexiones de server.js con el resto
- **Con el frontend:** le entrega los `.html/.css/.js` y responde a sus `fetch` a `/api/...`.
  Quien llama a esas puertas desde el navegador es `assets/js/datos.js`.
- **Con la base de datos:** mediante el objeto `DB` (Supabase con `pg`, o SQLite local).
- **Con Supabase concretamente:** a través de `process.env.DATABASE_URL` y el `pg.Pool`.
  En Render, esa variable se configura en el panel; en tu laptop, con `$env:DATABASE_URL`.

---

## Archivo: assets/js/datos.js

### Propósito general
Es el **puente entre el navegador y el servidor**. Antes (versión vieja) guardaba todo en el
navegador (`localStorage`); **ahora habla con la API** (`server.js`) usando `fetch`. Ofrece un
objeto global llamado **`DB`** con funciones que el resto del frontend usa para registrar,
iniciar sesión, leer publicaciones, mandar mensajes, etc. Guarda en memoria una **copia
(caché)** de los datos para que las demás partes funcionen rápido.

> Aunque se llama igual (`DB`) que el del servidor, **son distintos**: el del servidor habla
> con la base de datos; el de `datos.js` habla con el servidor.

### Bloque por bloque

```js
(function () {
  "use strict";
  ...
  window.DB = DB;
})();
```
Todo el archivo está envuelto en una función que se ejecuta sola (un "IIFE"). Esto **encierra**
las variables internas para que no choquen con otras del proyecto. Al final, expone solo `DB`
poniéndolo en `window.DB` (así otros archivos pueden usar `DB.login(...)`, etc.).

```js
const API = "/api";
const K_SESION = "servihogar_sesion";
let _usuarios = [];
let _publicaciones = [];
let _conversaciones = [];
const _mensajes = {}; // correoOtro -> [mensajes]
```
- `API`: el prefijo de todas las puertas del servidor.
- `K_SESION`: el nombre con el que se guarda la sesión en el navegador.
- `_usuarios`, `_publicaciones`, `_conversaciones`, `_mensajes`: la **caché** (copia en
  memoria). El guion bajo `_` es una costumbre para decir "esto es interno/privado".

```js
async function pedir(ruta, opciones) {
  const res = await fetch(API + ruta, opciones);
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    const err = new Error((data && data.error) || ("Error " + res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}
```
Función central que **hace la llamada al servidor**. `fetch` envía la petición y espera la
respuesta (`await`). Convierte la respuesta a objeto con `res.json()`. Si el servidor
respondió con error (`!res.ok`, por ejemplo 401 o 409), **lanza** un error con el mensaje y
el código, para que quien la llamó pueda mostrarlo. Si todo bien, devuelve los datos.

```js
const norm = (c) => (c || "").trim().toLowerCase();
```
Igual que en el servidor: limpia un correo (minúsculas, sin espacios).

#### El objeto DB y sus funciones

```js
async init() {
  const sesion = this.getSesion();
  const tareas = [
    pedir("/usuarios").then((d) => { _usuarios = d || []; }),
    pedir("/publicaciones").then((d) => { _publicaciones = d || []; }),
  ];
  if (sesion) tareas.push(this.cargarConversaciones(sesion.correo));
  await Promise.all(tareas);
}
```
`init` **carga los datos del servidor a la caché** al abrir una página de la app. Pide los
usuarios y las publicaciones (y, si hay sesión, las conversaciones) **en paralelo**
(`Promise.all` = "espera a que todas terminen"). `app-interno.js` llama a `DB.init()` antes
de dibujar la pantalla.

```js
getUsuarios() { return _usuarios; }
getUsuarioPorCorreo(correo) { const c = norm(correo); return _usuarios.find(u => norm(u.correo) === c) || null; }
```
Leen de la caché (rápido, sin internet). `getUsuarioPorCorreo` busca a una persona por su
correo (se usa en el chat para saber el nombre del otro).

```js
async registrar(datos) {
  const r = await pedir("/registro", { method: "POST", headers: {...}, body: JSON.stringify(datos) });
  return r.usuario;
}
async login(correo, contrasena) {
  try {
    const r = await pedir("/login", { method: "POST", ..., body: JSON.stringify({ correo, contrasena }) });
    return r.usuario;
  } catch (e) { if (e.status === 401) return null; throw e; }
}
```
- `registrar`: manda los datos del formulario a `POST /api/registro`. Devuelve el usuario
  creado (o lanza error si el correo ya existe, que `registro.js` muestra).
- `login`: manda correo y contraseña a `POST /api/login`. Si el servidor responde 401
  (incorrecto), devuelve `null`; cualquier otro error (servidor caído) lo relanza.

```js
getSesion() { try { return JSON.parse(localStorage.getItem(K_SESION)); } catch (e) { return null; } }
setSesion(usuario) { localStorage.setItem(K_SESION, JSON.stringify(usuario)); }
cerrarSesion() { localStorage.removeItem(K_SESION); }
```
La **sesión** (quién inició sesión) sí se guarda en el navegador (`localStorage`), porque es
información de **este** navegador. `setSesion` la guarda al entrar; `getSesion` la lee;
`cerrarSesion` la borra (botón "Cerrar sesión"). Nota: aquí NO se guarda la contraseña, solo
los datos públicos del usuario.

```js
getPublicaciones() { return _publicaciones; }
getPublicacionesDe(correo) { const c = norm(correo); return _publicaciones.filter(p => norm(p.trabajadorCorreo) === c); }
async addPublicacion(pub) { await pedir("/publicaciones", { method:"POST", ..., body: JSON.stringify(pub) }); _publicaciones = await pedir("/publicaciones"); }
async eliminarPublicacion(id) { await pedir("/publicaciones/" + encodeURIComponent(id), { method:"DELETE" }); _publicaciones = await pedir("/publicaciones"); }
```
- `getPublicaciones`: todas (de la caché). `getPublicacionesDe`: solo las de un trabajador.
- `addPublicacion`: las manda al servidor y luego **recarga** la caché para tenerla al día.
- `eliminarPublicacion`: pide borrarla y recarga.

```js
getConversacionesDe() { return _conversaciones; }
async cargarConversaciones(correo) { _conversaciones = await pedir("/conversaciones?correo=" + encodeURIComponent(norm(correo))); return _conversaciones; }
getMensajes(viewerCorreo, otroCorreo) { return _mensajes[norm(otroCorreo)] || []; }
async cargarMensajes(viewerCorreo, otroCorreo) { const data = await pedir("/mensajes?viewer=...&otro=..."); _mensajes[norm(otroCorreo)] = data; return data; }
async addMensaje(deCorreo, paraCorreo, texto, imagen) { await pedir("/mensajes", { method:"POST", ..., body: JSON.stringify({...}) }); await this.cargarMensajes(deCorreo, paraCorreo); }
async vaciarMensajes(usuarioCorreo, otroCorreo) { await pedir("/chats/vaciar", { method:"POST", ... }); await this.cargarMensajes(usuarioCorreo, otroCorreo); }
```
Funciones del **chat**:
- `cargarConversaciones`: trae del servidor la lista de chats del usuario y la guarda en
  caché. `getConversacionesDe`: la lee.
- `cargarMensajes`: trae los mensajes con una persona; `getMensajes`: los lee de la caché.
- `addMensaje`: manda un mensaje (texto o imagen) y vuelve a cargar para verlo al instante.
- `vaciarMensajes`: pide vaciar el chat (solo para mí) y recarga.

```js
iniciales(usuario) { ... return (a+b).toUpperCase(); }
capitalizar(txt) { ... }
```
Utilidades visuales: `iniciales` saca las iniciales del nombre (ej. "Ana Rodríguez" → "AR")
para los avatares; `capitalizar` pone la primera letra en mayúscula.

### Conexiones de datos.js con el resto
- **Lo usan** `app.js` (login), `registro.js` (registro), `perfil.js` (perfil) y, sobre todo,
  `app-interno.js` (feed, buscar, publicar, chat). Todos llaman a funciones de `DB`.
- **Habla con** `server.js` por medio de `fetch` a las puertas `/api/...`.
- **Guarda la sesión** en el `localStorage` del navegador.

---

# PARTE 2 — Los archivos HTML (la estructura)

## Conceptos de HTML que se repiten en TODAS las páginas

Antes de ir archivo por archivo, esto aparece en todas y conviene entenderlo una vez:

```html
<!DOCTYPE html>
<html lang="es">
<head> ... </head>
<body> ... </body>
</html>
```
- `<!DOCTYPE html>`: le dice al navegador "esto es HTML moderno (HTML5)". Siempre va primero.
- `<html lang="es">`: la etiqueta que envuelve todo. `lang="es"` indica que el idioma es
  español (ayuda a buscadores y lectores de pantalla).
- `<head>`: la "cabeza". NO se ve; contiene información sobre la página (título, estilos,
  icono).
- `<body>`: el "cuerpo". TODO lo que se ve está aquí.

Dentro del `<head>` se repite:
```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Inicio | ServiHogar</title>
<link rel="stylesheet" href="assets/css/...css">
<link rel="icon" type="image/jpeg" href="assets/images/logo.jpg">
```
- `<meta charset="UTF-8">`: el "alfabeto" que usa la página. UTF-8 permite tildes y ñ.
- `<meta name="viewport" ...>`: **clave para móviles.** Le dice al navegador que use el ancho
  real del dispositivo y no haga zoom raro. Sin esto, en el celular la página se vería
  diminuta.
- `<title>`: el texto que sale en la **pestaña** del navegador.
- `<link rel="stylesheet" href="...css">`: **conecta el archivo CSS** con esta página (los
  estilos). Las públicas usan `styles.css`; las de la app usan `app.css`.
- `<link rel="icon" ...>`: el **favicon** (el logo en la pestaña).

**Atributos que verás siempre:**
- `class="..."`: una "etiqueta de grupo". El CSS y el JS la usan para encontrar elementos.
  Varios elementos pueden tener la misma clase.
- `id="..."`: un **identificador único** (solo uno por página). El JS lo usa para agarrar UN
  elemento exacto con `document.getElementById("...")`.
- `href="..."`: a dónde apunta un enlace `<a>`. Puede ser otra página (`login.html`), una
  sección de la misma página (`#servicios`), un correo (`mailto:...`) o nada todavía (`#`).
- `src="..."`: la fuente de una imagen `<img>` o de un `<script>`.

**Etiquetas semánticas** ("semántica" = que el nombre dice para qué sirve, no solo cómo se
ve):
- `<header>`: la cabecera superior (logo + menú).
- `<nav>`: una zona de **navegación** (enlaces de menú).
- `<main>` / `<section>`: secciones de contenido.
- `<article>`: un bloque que tiene sentido por sí solo (ej. una tarjeta de servicio).
- `<aside>`: contenido "al lado" (la barra lateral de la app).
- `<footer>`: el pie de página.
- `<form>`: un formulario (campos para que el usuario escriba y envíe).

---

## Bloque común A: el HEADER de las páginas públicas

Está casi idéntico en `index`, `login`, `registro`, `como-funciona` y `sobre-nosotros`:

```html
<header>
    <a href="index.html" class="logo">
        <img src="assets/images/logo.jpg" alt="Logo ServiHogar">
        <h4>Servi<span>Hogar</span></h4>
    </a>
    <input type="checkbox" id="nav-toggle" class="nav-toggle" hidden>
    <label for="nav-toggle" class="nav-burger" aria-label="Menu"><span></span><span></span><span></span></label>
    <nav>
        <a href="index.html">Inicio</a>
        <a href="index.html#servicios">Servicios</a>
        <a href="como-funciona.html">Cómo funciona</a>
        <a href="sobre-nosotros.html">Sobre nosotros</a>
        <a href="login.html">Iniciar sesión</a>
        <a href="login.html" class="boton-principal">Solicitar servicio ahora</a>
    </nav>
</header>
```
- `<a href="index.html" class="logo">`: el logo es un **enlace** que lleva a la portada. Dentro
  tiene la imagen del logo (`<img>`, con `alt` = texto alternativo si la imagen no carga) y el
  nombre. El `<span>` dentro del `<h4>` envuelve "Hogar" para pintarlo de amarillo por CSS.
- `<input type="checkbox" id="nav-toggle" hidden>` + `<label for="nav-toggle" class="nav-burger">`:
  **el menú hamburguesa de móvil, hecho solo con CSS** (sin JavaScript). El truco: el `<label>`
  está conectado al checkbox por `for="nav-toggle"`; al tocar la hamburguesa se marca/desmarca
  el checkbox (que está oculto con `hidden`), y el CSS muestra u oculta el `<nav>` según esté
  marcado. Los tres `<span></span>` son las tres rayitas del icono. `aria-label="Menu"` es para
  accesibilidad (lectores de pantalla).
- `<nav>`: los enlaces del menú. Cada `<a href="...">` lleva a una página. `index.html#servicios`
  lleva a la portada y baja hasta la sección con `id="servicios"` (eso es un "ancla"). El último
  enlace tiene `class="boton-principal"` para verse como botón amarillo.

> En `login.html` el `<nav>` no incluye "Solicitar servicio ahora" (es la única diferencia,
> porque ya estás por entrar).

---

## Bloque común B: el "APP SHELL" de las páginas internas

Todas las `app-*.html` comparten esta estructura (la barra lateral + barra superior):

```html
<body>
<div class="app-shell">
    <aside class="sidebar">
        <a href="app-inicio.html" class="sidebar-logo"> ... </a>
        <nav class="sidebar-nav">
            <a href="app-inicio.html" class="nav-item active"><span>Inicio</span></a>
            <a href="app-buscar.html" class="nav-item"><span>Buscar</span></a>
            <a href="app-chat.html" class="nav-item"><span>Chats</span></a>
            <a href="app-historial.html" class="nav-item"><span>Historial</span></a>
            <a href="app-perfil.html" class="nav-item"><span>Perfil</span></a>
        </nav>
        <div class="sidebar-user">
            <div class="user-name" id="sidebar-name">Cargando...</div>
            <div class="user-type" id="sidebar-type">Cliente</div>
            <a href="#" class="btn-salir" id="btn-salir">← Cerrar sesión</a>
        </div>
    </aside>

    <div class="main">
        <div class="topbar">
            <div class="topbar-title">Trabajos recientes</div>
        </div>
        <div class="page">
            ... (lo único que cambia entre páginas) ...
        </div>
    </div>
</div>

<script src="assets/js/datos.js"></script>
<script src="assets/js/app-interno.js"></script>
</body>
```
- `<div class="app-shell">`: el contenedor general. Por CSS es un *flex* que pone la barra
  lateral y el contenido lado a lado (y en móvil cambia a barra inferior).
- `<aside class="sidebar">`: la **barra lateral** (menú izquierdo). `<aside>` se usa porque es
  contenido secundario al lado del principal.
  - `<nav class="sidebar-nav">`: el menú de la app. Cada `<a class="nav-item">` lleva a una
    sección. El que tiene `active` es la página actual (se pinta resaltado). **El JS le
    cambia el `href` de "Buscar" por "Publicar" cuando entra un trabajador**, y le agrega un
    número rojo a "Chats" si hay mensajes sin leer.
  - `<div class="sidebar-user">`: muestra el nombre y tipo del usuario. Tienen `id`
    (`sidebar-name`, `sidebar-type`) **vacíos/"Cargando..."** porque el JS los rellena al
    cargar. `btn-salir` (id `btn-salir`) es el botón de cerrar sesión que controla el JS.
- `<div class="main">`: la zona de contenido a la derecha.
  - `<div class="topbar">`: barra superior con el título de la sección.
  - `<div class="page">`: aquí va el contenido propio de cada página.
- Al final del `<body>`:
  - `<script src="assets/js/datos.js">`: carga **primero** la capa de datos (define `DB`).
  - `<script src="assets/js/app-interno.js">`: carga **después** la lógica que usa `DB`.
  El **orden importa**: `app-interno.js` necesita que `DB` ya exista.

A continuación, archivo por archivo, su propósito y lo que tiene de único.

---

## Archivo: index.html
**Propósito:** la **portada** pública. Es lo primero que ve un visitante. Vende la idea y lleva
al login/registro.

Estructura (después del header común):
- `<section class="hero">`: la zona principal grande de arriba. Dentro, `<div class="hero-contenido hero-centrado">` (la clase `hero-centrado` la agregamos para centrar el texto al quitar la imagen) con el título `<h1>` (la frase principal; el `<span>` pinta "confianza" de amarillo), un párrafo `<p>` y dos botones `<a>` ("Solicitar servicio ahora" → login, "¿Cómo funciona?" → como-funciona).
- `<section class="info">`: tres `<div class="card">` con los pasos 1-2-3 de cómo funciona.
- `<section class="servicios" id="servicios">`: la lista de servicios. Tiene `id="servicios"`
  para que el enlace "Servicios" del menú baje hasta aquí. Dentro, `<div class="servicios-grid">`
  con varios `<article class="servicio-item">`; cada uno es una tarjeta con un **ícono SVG**
  (dibujado con vectores, no es una imagen ni un emoji), un `<h3>` (nombre), un `<p>`, una lista
  `<ul>` de detalles y un `<span class="servicio-tag">` (etiqueta).
- `<section class="contacto">`: una llamada final a la acción.
- `<footer>`: el pie de página completo (ver Tarea 1: Acerca, Equipo, Navegación, Legal,
  Síguenos/Contacto).

**Conexiones:** usa `styles.css`. **No carga ningún JavaScript** (es solo informativa). Sus
enlaces llevan a `login.html`, `registro.html`, `como-funciona.html`, `sobre-nosotros.html`.

---

## Archivo: login.html
**Propósito:** **iniciar sesión.** El usuario escribe correo y contraseña.

Lo único propio:
```html
<section class="login">
    <h2>Iniciar sesión</h2>
    <form>
        <input type="email" placeholder="Correo electrónico" required>
        <input type="password" placeholder="Contraseña" required>
        <button type="submit">Entrar a ServiHogar</button>
        <p>¿No tienes cuenta? <a href="registro.html">Regístrate aquí</a></p>
    </form>
    <div class="cuentas-demo"> ... cuentas de ejemplo ... </div>
</section>
```
- `<form>`: el formulario. Al pulsar el botón `type="submit"` se "envía".
- `<input type="email">`: caja de texto para correo (el tipo `email` ayuda en móvil mostrando
  el teclado con @). `<input type="password">`: oculta lo que escribes con puntitos.
- `required`: el navegador no deja enviar si está vacío.
- `<div class="cuentas-demo">`: un recuadro que muestra las cuentas de ejemplo para probar.
- Al final carga `datos.js` y luego `app.js`.

**Conexiones:** `app.js` es quien **escucha el envío** de este formulario, llama a `DB.login`
(en `datos.js`), que pega a `/api/login` en `server.js`. Si entra bien, guarda la sesión y va a
`app-inicio.html`.

---

## Archivo: registro.html
**Propósito:** **crear una cuenta** (cliente o trabajador).

Lo propio es el `<form id="form-registro" novalidate>`:
- `novalidate`: apaga la validación automática del navegador, **porque la hacemos nosotros con
  JavaScript** (`registro.js`), para dar mensajes propios.
- Campos comunes: nombre, apellido, teléfono (`type="tel"`, `maxlength="9"`), correo
  (`type="email"`), distrito, y un `<select name="tipo">` con opciones cliente/trabajador.
  - `<select>` es una lista desplegable; cada `<option value="...">` es una opción. El `value`
    es lo que el programa lee (ej. `"trabajador"`), aunque el usuario vea otro texto.
- `<div id="bloque-trabajador" class="bloque-trabajador" hidden>`: un bloque **oculto** (atributo
  `hidden`) que **solo aparece si eliges "trabajador"** (lo muestra el JS). Contiene DNI,
  categoría, años de experiencia (`type="number"`), descripción (`<textarea>` = caja de texto
  grande) y un `<input type="checkbox">` de declaración. Esto es la "verificación de trabajador".
- Contraseña y confirmar contraseña, y el botón "Registrarme".

**Conexiones:** carga `datos.js` y `registro.js`. `registro.js` valida, muestra/oculta el bloque
de trabajador, y llama a `DB.registrar` → `/api/registro` en `server.js`.

---

## Archivo: como-funciona.html
**Propósito:** página informativa que explica el funcionamiento con más detalle. Header y footer
comunes; en medio, secciones (`<section class="funcionamiento">`, pasos, etc.) con texto e
imágenes. **No carga JavaScript.** Usa `styles.css`.

## Archivo: sobre-nosotros.html
**Propósito:** presenta al **equipo** y los valores del proyecto. Tiene secciones con tarjetas
del equipo y una sección "Lo que nos diferencia" con tres bloques (cada uno con un ícono SVG).
Usa `styles.css` **y además** `sobre-nosotros.css` (estilos extra solo de esta página). No carga
JavaScript.

---

## Archivo: app-inicio.html
**Propósito:** la **pantalla principal de la app** tras iniciar sesión (el "feed").

Contenido propio dentro de `<div class="page">`:
- `<div class="welcome" id="welcome"></div>`: vacío; el JS escribe aquí el saludo "Hola, [nombre]".
- `<div class="stats-row" id="stats-row"></div>`: vacío; el JS pinta aquí las **métricas reales**
  (servicios disponibles, trabajadores verificados, categorías).
- `<div class="feed-topbar">`: una barra con las pestañas (`<button class="tab">`
  Recientes/Populares) y el botón "+ Solicitar servicio".
- `<div class="feed"></div>`: **vacío**; el JS rellena aquí las publicaciones (tarjetas de
  servicios). 

> Que estos `<div>` estén vacíos con un `id` es a propósito: son "cajas" que el JavaScript
> llena con datos traídos de la base. Por eso esta página **sí** carga `datos.js` y
> `app-interno.js`.

**Conexiones:** `app-interno.js` detecta el `.feed`, el `#welcome` y el `#stats-row` y los
rellena con datos de `DB` (que vienen del servidor/Supabase). Distingue si eres cliente o
trabajador y muestra cosas distintas.

## Archivo: app-buscar.html
**Propósito:** que el **cliente busque trabajadores**. Tiene:
- `<input id="buscador">`: caja para escribir y filtrar.
- `<div class="pills-row">`: botones de categoría (`<button class="pill" onclick="filtrar('...')">`).
  El `onclick` llama a una función global que define `app-interno.js`.
- `<div id="lista-trabajadores" class="workers-grid"></div>`: vacío; el JS pinta aquí las
  tarjetas de trabajadores.

## Archivo: app-publicar.html
**Propósito:** que el **trabajador publique un servicio**. Tiene un `<form id="form-publicar">`
con título, categoría (`<select>`), distrito, precio y descripción (`<textarea>`), y abajo
`<div id="mis-publicaciones">` donde el JS lista las publicaciones propias (con botón Eliminar).
**Conexiones:** `app-interno.js` valida el formulario y llama a `DB.addPublicacion` →
`/api/publicaciones`.

## Archivo: app-chat.html
**Propósito:** el **chat**. Es la página más interactiva. Dos zonas:
- `<div class="chat-sidebar">` con `<div id="chat-list"></div>`: la lista de conversaciones
  (la rellena el JS).
- `<div class="chat-window">`: la conversación abierta:
  - `<div class="chat-window-header">`: tiene el botón `<button id="chat-back" class="chat-back">←</button>`
    (volver, **solo se ve en móvil**), el `<span id="chat-header">` (nombre del otro, lo pone
    el JS) y el botón "Vaciar chat".
  - `<div id="chat-messages" class="chat-messages"></div>`: donde aparecen los mensajes.
  - `<form id="chat-form">`: con un `<label class="chat-attach">` que envuelve un
    `<input type="file" accept="image/*" hidden>` (para **adjuntar imagen**) y un ícono SVG de
    clip; un `<input id="chat-input">` para escribir; y el botón "Enviar".
- `accept="image/*"` limita la selección a imágenes; `hidden` oculta el input feo de archivos y
  se activa al tocar el clip (el `<label>` lo dispara).

**Conexiones:** `app-interno.js` maneja todo el chat: pinta la lista y los mensajes, envía
(`DB.addMensaje`), adjunta imágenes, vacía el chat, y cada 3 segundos consulta al servidor por
mensajes nuevos. En móvil, al tocar una conversación añade la clase `chat-abierto` para mostrar
la ventana y ocultar la lista.

## Archivo: app-historial.html
**Propósito:** muestra el **historial de servicios**. Tiene pestañas
(`<button onclick="mostrarTab('completado', this)">`) y `<div id="lista-historial"></div>` que el
JS rellena. Para un usuario nuevo aparece vacío.

## Archivo: app-perfil.html
**Propósito:** los **datos del usuario**. Tiene un recuadro con avatar (iniciales), nombre, y
filas con correo, teléfono, distrito y tipo de cuenta — todas con un `id` que el JS rellena con
los datos de la sesión. Hay filas extra (`class="perfil-fila-trab" hidden`) que **solo se
muestran a trabajadores** (categoría, experiencia, verificación). Carga `datos.js`, `perfil.js`
y `app-interno.js`.

**Conexiones:** `perfil.js` lee la sesión (`DB.getSesion`) y rellena los campos; `app-interno.js`
se encarga de la barra lateral y el botón de cerrar sesión.

---

# PARTE 3 — Los archivos CSS (los estilos)

El CSS es el que da **color, tamaño, posición y forma**. Un archivo CSS son muchas "reglas":
```css
.selector {
    propiedad: valor;
}
```
- El **selector** dice a QUÉ elementos aplica: `.clase` (por clase), `#id` (por id),
  `etiqueta` (ej. `body`), o combinaciones.
- Cada **propiedad: valor** cambia algo (color, tamaño, etc.). `;` separa cada una.

## Conceptos clave que se usan en todo el proyecto

### 1) Variables de color (`:root` y `var(...)`)
Al inicio de `styles.css` y de `app.css` hay un bloque `:root` con **variables**:
```css
:root {
    --color-primario: #fbbf26;   /* el amarillo de la marca */
    --color-oscuro: #111827;     /* el azul oscuro casi negro */
    --radio-sm: 8px;             /* esquinas redondeadas */
    --transicion: all 0.3s ...;  /* suavidad en cambios */
}
```
- `:root` significa "todo el documento". Las variables empiezan con `--`.
- Luego se usan con `var(--color-primario)`. **Ventaja:** si quieres cambiar el amarillo de toda
  la página, cambias UNA línea y se actualiza en todos lados. (`app.css` usa nombres como
  `--amarillo`, `--oscuro`, `--gris-fondo`, etc.; misma idea.)

### 2) Flexbox (acomodar en fila o columna)
`display: flex` convierte a un elemento en "contenedor flexible": sus hijos se acomodan en una
línea. Propiedades típicas:
- `justify-content`: cómo se reparten en horizontal (`space-between` = uno a cada extremo,
  `center` = al centro).
- `align-items: center`: los centra en vertical.
- `gap`: espacio entre los hijos.
- `flex-direction: column`: en vez de fila, los apila en columna.
- `flex: 1`: hace que un hijo crezca para ocupar el espacio sobrante.

Ejemplos en el proyecto: el `<header>` (`display:flex; justify-content:space-between`), la
`.app-shell` (barra lateral + contenido), la `.feed-topbar`, el `.chat-form`.

### 3) Grid (cuadrículas)
`display: grid` arma una **cuadrícula** de filas y columnas. Se usa para galerías:
```css
.servicios-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
```
- `grid-template-columns: repeat(3, 1fr)`: 3 columnas iguales (`1fr` = "una fracción", todas del
  mismo ancho).
- Se usa en `.servicios-grid` (servicios de la portada), `.stats-row` (las 3 tarjetas de
  métricas) y `.workers-grid` (tarjetas de trabajadores).

### 4) Media queries (diseño responsivo)
Una **media query** aplica reglas solo cuando la pantalla cumple una condición de tamaño:
```css
@media (max-width: 768px) {
    /* estas reglas solo valen si la pantalla mide 768px de ancho o menos (celular/tablet) */
}
```
Así la página se reordena en el celular sin tocar el HTML. El proyecto usa varios cortes:
900px, 768px, 640px y 600px.

---

## Archivo: assets/css/styles.css
**Propósito:** estilos de **todas las páginas públicas** (portada, login, registro, cómo
funciona, sobre nosotros). Define la identidad visual: amarillo + azul oscuro, tipografías
(importa "Poppins" y "Montserrat" de Google Fonts con `@import` arriba).

Reglas clave:
- `:root { ... }`: las variables de color, sombras, radios y transición (explicado arriba).
- `* { box-sizing: border-box; margin:0; padding:0; }`: el `*` aplica a TODO. `box-sizing:
  border-box` hace que el ancho de un elemento incluya su borde y relleno (evita
  descuadres). Quitar márgenes/relleno por defecto da un punto de partida limpio.
- `header { position: fixed; ... }`: la cabecera queda **fija** arriba aunque hagas scroll.
- `nav a { ... }` y `.boton-principal { ... }`: estilo de los enlaces y el botón del menú.
- `.hero`, `.hero-centrado`, `.servicios-grid`, `.servicio-item`: la portada (degradado oscuro,
  cuadrícula de servicios con tarjetas que se elevan al pasar el mouse con `transform`).
- `.login, .registro { ... }`: centran el formulario y le dan el fondo oscuro. `.campo input`,
  `select`, `textarea`: estilan los campos del formulario (borde, foco amarillo).
- `.footer`, `.footer-contenido`, `.footer-col`, `.footer-contacto`: el pie de página
  (`display:flex; flex-wrap:wrap` para que las 5 columnas se acomoden y se apilen en móvil).
- **Menú hamburguesa:** `.nav-burger { display:none }` (oculto en escritorio) y, dentro de
  `@media (max-width:768px)`, se muestra la hamburguesa y el `<nav>` pasa a un desplegable.
  La regla mágica es `.nav-toggle:checked ~ nav { display: flex; }`: "si el checkbox está
  marcado, muestra el nav que viene después" (el `~` significa "hermano siguiente").
- **Media queries** (900px y 768px): apilan el hero, el footer, las cuadrículas y activan la
  hamburguesa.

**Conexiones:** lo enlazan en el `<head>` de las 5 páginas públicas con `<link rel="stylesheet">`.

## Archivo: assets/css/app.css
**Propósito:** estilos de **la app interna** (todas las `app-*.html`). Define el layout de
"barra lateral + contenido" y todos los componentes (tarjetas de publicación, chat, perfil...).

Reglas clave:
- `:root { ... }`: sus propias variables (`--amarillo`, `--oscuro`, `--gris-fondo`, `--radio`...).
- `.app-shell { display: flex; }`: pone la barra lateral y el contenido lado a lado.
- `.sidebar { position: fixed; width: 240px; ... }`: la barra lateral fija a la izquierda.
  `.main { margin-left: 240px; }`: empuja el contenido para que no quede debajo de la barra.
- `.nav-item`, `.nav-item.active`: los enlaces del menú lateral (el `active` resaltado en
  amarillo). `.nav-badge`: el **número rojo** de mensajes no leídos (`background:#ef4444`,
  redondo; `margin-left:auto` lo empuja a la derecha).
- `.topbar`, `.page`: la barra superior y el área de contenido.
- `.stats-row` (grid de 3), `.welcome`, `.feed`, `.post-card`: el inicio/feed.
- `.worker-card`, `.workers-grid`, `.pill`: la página Buscar.
- `.chat-page` (flex), `.chat-sidebar`, `.chat-window`, `.msg`, `.msg-bubble`, `.msg-image`,
  `.chat-form`, `.chat-attach`: todo el chat. `.msg.sent` alinea a la derecha los mensajes
  propios; los recibidos van a la izquierda con avatar.
- `.lightbox`, `.lightbox-img`, `.lightbox-controls`: el **visor de imágenes con zoom** (la capa
  oscura a pantalla completa). `position: fixed; inset: 0` lo hace cubrir toda la pantalla;
  `.lightbox.open` lo muestra.
- `.empty-state`: el mensaje cuando algo está vacío (ej. "Aún no tienes servicios").
- **Media queries:**
  - `@media (max-width: 900px)`: reduce la barra y pasa las cuadrículas a 1 columna.
  - `@media (max-width: 640px)` (**la importante para móvil**): convierte la **barra lateral en
    barra inferior** (`.sidebar` pasa a `bottom:0; flex-direction:row`), oculta el logo y el
    usuario, pone el contenido a ancho completo (`.main { margin-left:0; padding-bottom:64px }`),
    y hace que el **chat alterne** lista/conversación con la clase `.chat-abierto` y el botón
    `.chat-back`.

**Conexiones:** lo enlazan las `app-*.html`. Las clases que aquí se estilizan son las mismas que
`app-interno.js` crea o modifica desde JavaScript (por eso van de la mano).

## Archivo: assets/css/sobre-nosotros.css
**Propósito:** estilos **extra** solo para `sobre-nosotros.html` (tarjetas del equipo, sección
"Lo que nos diferencia", `.icono`, `.icono-emoji`, etc.). Se carga **además** de `styles.css`
(esa página tiene los dos `<link>`). Usa flex/grid para acomodar las tarjetas y media queries
para el móvil.

---

# PARTE 4 — Los archivos JavaScript (el comportamiento)

El JavaScript es lo que hace que la página **reaccione**: que un botón haga algo, que un
formulario se valide, que el chat se actualice. Conceptos que se repiten:

- **`document.getElementById("x")`**: agarra el elemento del HTML que tiene `id="x"`.
- **`document.querySelector(".clase")`**: agarra el primer elemento que tenga esa clase.
- **`elemento.addEventListener("click", función)`**: "cuando ocurra el evento *click* en este
  elemento, ejecuta esta función". Hay eventos `click`, `submit` (enviar formulario),
  `input` (escribir), `change` (cambiar selección), `DOMContentLoaded` (la página terminó de
  cargar).
- **`async` / `await`**: hablar con el servidor toma tiempo. `async` marca una función que
  "espera"; `await` significa "espera a que esto termine antes de seguir". Casi todo lo que
  toca la base de datos los usa.
- **`.innerHTML = "..."`**: reemplaza el contenido HTML de un elemento (así el JS "dibuja"
  tarjetas, mensajes, etc.).
- **Plantillas `` `texto ${variable}` ``**: texto con comillas invertidas donde `${...}` mete el
  valor de una variable. Se usa muchísimo para construir HTML.

Todos estos archivos usan el objeto **`DB`** que define `datos.js` (ver Parte 1).

---

## Archivo: assets/js/app.js
**Propósito:** controla **únicamente el formulario de iniciar sesión** (`login.html`).

```js
document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const correo = form.querySelector('input[type="email"]').value.trim().toLowerCase();
    const contrasena = form.querySelector('input[type="password"]').value;
    if (!correo || !contrasena) { alert("Por favor, completa ambos campos."); return; }
    try {
      const usuario = await DB.login(correo, contrasena);
      if (usuario) {
        DB.setSesion(usuario);
        alert("¡Bienvenido de nuevo, " + usuario.nombre + "!");
        setTimeout(() => { window.location.href = "app-inicio.html"; }, 400);
      } else {
        alert("Correo o contraseña incorrectos...");
      }
    } catch (e) { alert("No se pudo conectar con el servidor..."); }
  });
});
```
- `DOMContentLoaded`: espera a que el HTML esté listo antes de buscar el formulario.
- `event.preventDefault()`: **evita que el formulario se envíe a la antigua** (recargando la
  página). Así lo manejamos nosotros con JavaScript.
- Lee el correo y la contraseña de los `<input>`. `.value` es lo escrito; `.trim()` quita
  espacios; `.toLowerCase()` pasa el correo a minúsculas.
- Si falta algo, avisa con `alert` y corta (`return`).
- `await DB.login(...)`: pide al servidor verificar (ver Parte 1). Si devuelve un usuario,
  guarda la sesión (`DB.setSesion`) y **redirige** a `app-inicio.html` (`window.location.href`).
  Si devuelve `null`, dice "incorrectos". Si el servidor está caído, el `catch` avisa.

**Conexiones:** lo carga `login.html`. Usa `DB.login` y `DB.setSesion` de `datos.js`.

## Archivo: assets/js/registro.js
**Propósito:** controla el **formulario de registro** (`registro.html`): muestra/oculta el
bloque de trabajador, valida los datos y crea la cuenta.

Partes:
```js
const tipo = document.getElementById("tipo");
const bloqueTrabajador = document.getElementById("bloque-trabajador");
function actualizarBloque() { bloqueTrabajador.hidden = (tipo.value !== "trabajador"); }
tipo.addEventListener("change", actualizarBloque);
```
- Cuando cambias el `<select>` de tipo (`change`), si eliges "trabajador" **muestra** el bloque
  de verificación (le quita el atributo `hidden`); si no, lo oculta.

```js
["telefono", "dni"].forEach(function (campo) {
  form.elements[campo].addEventListener("input", function () { this.value = this.value.replace(/\D/g, ""); });
});
```
- Mientras escribes en teléfono o DNI, borra todo lo que no sea número (`/\D/g` = "cualquier
  cosa que NO sea dígito").

```js
form.addEventListener("submit", async function (event) {
  event.preventDefault();
  // ...lee todos los campos...
  // VALIDACIONES: nombre/apellido solo letras, teléfono 9 dígitos que empieza en 9,
  //   correo con formato válido, contraseña mínimo 6, contraseñas iguales...
  // si es trabajador: DNI 8 dígitos, categoría, experiencia 0-60, descripción >= 15, checkbox.
  try {
    const usuario = await DB.registrar(nuevoUsuario);
    DB.setSesion(usuario);
    // si es trabajador -> app-publicar.html ; si es cliente -> app-inicio.html
  } catch (e) { alert(e.message || "No se pudo completar el registro..."); }
});
```
- `event.preventDefault()`: igual que en login.
- Hace **muchas validaciones** con expresiones regulares (`/.../`, patrones de texto). Si algo
  está mal, muestra un `alert` y corta.
- Si todo está bien, llama a `DB.registrar` (→ `/api/registro`). El **servidor** vuelve a
  comprobar que el correo y el DNI no existan (doble seguridad). Si el servidor responde error
  (ej. correo repetido), el `catch` muestra `e.message`.
- Tras crear la cuenta, guarda la sesión y redirige: trabajador → publicar; cliente → inicio.

**Conexiones:** lo carga `registro.html`. Usa `DB.registrar` y `DB.setSesion`.

## Archivo: assets/js/perfil.js
**Propósito:** llena la página de **perfil** con los datos de la sesión.
```js
const sesion = DB.getSesion();
if (!sesion) { window.location.href = "login.html"; return; }
document.getElementById("perfil-nombre").textContent = sesion.nombre + " " + (sesion.apellido || "");
// ...rellena correo, teléfono, distrito, tipo...
// si es trabajador, muestra las filas extra (categoría, experiencia, verificación).
document.getElementById("btn-cerrar-sesion").addEventListener("click", function () {
  if (confirm("¿Cerrar sesión?")) { DB.cerrarSesion(); window.location.href = "index.html"; }
});
```
- `DB.getSesion()`: lee quién inició sesión (del navegador). Si no hay nadie, manda al login.
- `.textContent = ...`: escribe texto en cada campo (a diferencia de `innerHTML`, `textContent`
  pone texto plano, más seguro).
- El botón de cerrar sesión pide confirmación (`confirm`), borra la sesión y va a la portada.

**Conexiones:** lo carga `app-perfil.html` (junto con `datos.js` y `app-interno.js`).

---

## Archivo: assets/js/app-interno.js
**Propósito:** es el **archivo más grande y completo**. Contiene la lógica de **todas** las
páginas internas (inicio/feed, buscar, publicar, historial, chat, notificaciones). Como todas
las `app-*.html` lo cargan, el archivo **detecta en qué página está** preguntando si existe cierto
elemento (por ejemplo, si existe `.feed`, está en el inicio).

### Arranque y guardia de sesión
```js
document.addEventListener("DOMContentLoaded", async function () {
  const sesion = DB.getSesion();
  if (!sesion) { window.location.href = "login.html"; return; }
  try { await DB.init(); } catch (e) { alert("No se pudo conectar con el servidor..."); return; }
  const esTrabajador = sesion.tipo === "trabajador";
  ...
});
```
- Toda la lógica corre cuando la página cargó (`DOMContentLoaded`) y es `async`.
- **Guardia:** si no hay sesión, te saca al login. Así nadie ve la app sin entrar.
- `await DB.init()`: **carga los datos del servidor** (usuarios, publicaciones, conversaciones)
  a la caché antes de dibujar. Si el servidor está caído, avisa y para.
- `esTrabajador`: true/false según el tipo de cuenta; se usa para mostrar cosas distintas.

### Barra lateral (común a todas las páginas)
- Rellena el nombre y tipo del usuario (`#sidebar-name`, `#sidebar-type`) y el avatar.
- Botón **cerrar sesión** (`#btn-salir`): borra la sesión y va a la portada.
- **Nav según rol:** si eres trabajador, cambia el enlace "Buscar" por "Publicar"
  (`linkBuscar.setAttribute("href", "app-publicar.html")`).

### Notificación de chats no leídos (el número rojo)
```js
function getLeido() { ...lee localStorage 'servihogar_leido'... }
function contarNoLeidos() { /* cuenta conversaciones cuyo último mensaje es de otro y es más nuevo que lo ya leído */ }
function marcarLeido(correo) { /* guarda la fecha del último mensaje como "ya leído" */ }
function actualizarBadgeChats() { /* crea o quita el <span class="nav-badge"> con el número junto a "Chats" */ }
actualizarBadgeChats();
```
- "Leído" se guarda en el **navegador** (`localStorage`, clave `servihogar_leido`): por cada
  conversación, hasta qué fecha ya viste.
- `contarNoLeidos`: cuenta las conversaciones cuyo último mensaje lo mandó **la otra persona** y
  es **más nuevo** que lo que ya leíste → esos son "no leídos".
- `actualizarBadgeChats`: si hay no leídos, agrega el número rojo al enlace "Chats"; si no, lo
  quita. Se vuelve a llamar cuando abres un chat (para que el número baje).

### INICIO (el feed) — solo corre si existe `.feed`
```js
const feed = document.querySelector(".feed");
if (feed) { ... }
```
- `pintarResumen()`: escribe el saludo "Hola, [nombre]" y las **métricas reales** (cuenta
  publicaciones, trabajadores verificados, categorías). Para el trabajador muestra sus propias
  cifras.
- `cardPublicacion(p, propia)`: arma el HTML de **una tarjeta de servicio** con plantillas
  `` `...${...}` ``. Si es propia (trabajador), muestra botón "Eliminar"; si no, "Contactar".
- `pintarFeed()`: decide qué mostrar. Si eres **trabajador**, el título pasa a "Mis
  publicaciones" y muestra las tuyas. Si eres **cliente**, "Servicios disponibles" con todas.
- `enlazarFeed()`: a cada botón recién creado le pone su acción: "Me gusta" (suma/resta),
  "Contactar" (guarda con quién y va al chat), "Eliminar" (`await DB.eliminarPublicacion`).
- `esc(s)`: **función de seguridad**. Convierte caracteres peligrosos (`<`, `>`, `"`) en texto
  inofensivo, para que si alguien escribe `<script>` en una publicación no se ejecute. Se usa
  en todo lo que viene de la base.

### BUSCAR — solo si existe `#lista-trabajadores`
- `trabajadores()`: saca de la caché los usuarios tipo trabajador.
- `renderTrabajadores(lista)`: dibuja una tarjeta por cada uno (avatar con iniciales, nombre,
  "Verificado", años de experiencia, botón **Contactar**).
- `window.filtrar(cat, btn)` y el buscador (`input`): filtran por categoría o por texto.
  (`window.` las hace **globales** para que el `onclick="filtrar(...)"` del HTML las encuentre.)
- "Contactar" guarda en `localStorage` con quién quieres hablar y te lleva a `app-chat.html`.

### HISTORIAL — solo si existe `#lista-historial`
- Tiene datos de ejemplo, pero **solo se muestran a las cuentas demo**
  (`cliente@`, `trabajador@`, `rosa@`). Un usuario **nuevo** ve el historial **vacío**.
- `renderHistorial(lista)` dibuja las tarjetas; `window.mostrarTab(...)` filtra por estado
  (completado/pendiente).

### PUBLICAR — solo si existe `#form-publicar`
- Si **no** eres trabajador, te saca (solo trabajadores publican).
- Al enviar el formulario: valida (título ≥5, descripción ≥15...) y llama a
  `await DB.addPublicacion(...)` (→ `/api/publicaciones`). Luego limpia el formulario y
  repinta "Mis publicaciones".
- Cada publicación propia tiene botón Eliminar (`await DB.eliminarPublicacion`).

### CHAT — solo si existe `#chat-list` (la parte más compleja)
- `pintarLista()`: dibuja la lista de conversaciones (`DB.getConversacionesDe`). Cada una, al
  hacer clic, abre el chat.
- `pintarMensajes()`: dibuja los mensajes del chat abierto. Para cada mensaje decide si es
  **mío** (`m.de === sesion.correo` → burbuja a la derecha) o **del otro** (izquierda con
  avatar). Si tiene imagen, la muestra con `<img class="msg-image">`.
- `abrirChat(correo)` (async): carga del servidor los mensajes con esa persona
  (`await DB.cargarMensajes`), los pinta, marca como leídos y, **en móvil**, añade la clase
  `chat-abierto` para mostrar la conversación y ocultar la lista.
- **Enviar** (`chat-form` submit, async): `await DB.addMensaje(...)` (→ `/api/mensajes`), luego
  recarga conversaciones y repinta.
- **Adjuntar imagen** (`chat-image` change): valida que sea imagen y pese ≤2MB; usa un
  `FileReader` para convertir la imagen a texto (base64) y la manda como mensaje con imagen.
- **Vaciar chat** (`btn-vaciar-chat`): `await DB.vaciarMensajes(...)` (→ `/api/chats/vaciar`).
  Solo te lo vacía a ti.
- **Botón volver** (`chat-back`, móvil): quita la clase `chat-abierto` para regresar a la lista.
- **Visor de imágenes (lightbox):** al hacer clic en una imagen del chat, `abrirLightbox(src)`
  crea una capa oscura a pantalla completa con la imagen grande. Tiene zoom con botones (+/−),
  con la rueda del mouse y doble clic, y se puede **arrastrar** para moverla (eventos
  `pointerdown/move/up`). Se cierra con la ✕, tocando el fondo, o con la tecla Escape.
- **Sondeo en vivo (`setInterval` cada 3s):** cada 3 segundos vuelve a pedir las conversaciones
  y, si hay un chat abierto, los mensajes; si hay algo nuevo, repinta. **Esto hace que los
  mensajes del otro aparezcan solos** sin recargar la página. Usa una "firma" (cantidad +
  fecha del último) para repintar solo cuando de verdad cambió algo.

### Conexiones de app-interno.js con el resto
- Lo cargan **todas** las páginas `app-*.html` (siempre después de `datos.js`).
- Usa `DB` (de `datos.js`) para TODO lo que toca datos → que a su vez habla con `server.js` →
  que habla con **Supabase**.
- Crea y modifica elementos cuyas clases están estilizadas en `app.css`.
- Guarda en `localStorage` lo "leído" de los chats y a quién quieres contactar.

---

## Resumen final de conexiones (el mapa completo)

```
[ Navegador ]
   │  carga las páginas .html  ─────────────►  estilos: styles.css / app.css / sobre-nosotros.css
   │
   │  login.html ───► app.js ─────┐
   │  registro.html ─► registro.js ┤
   │  app-perfil.html ► perfil.js  ┤  todos usan ►  datos.js  (objeto DB)
   │  app-*.html ────► app-interno.js ┘                 │
   │                                                     │  fetch("/api/...")
   ▼                                                     ▼
                                              [ server.js  (Node) ]
                                                     │  DB.query / get / run
                                                     ▼
                                  [ Base de datos: Supabase (Postgres) o SQLite local ]
```

- El **navegador** muestra el HTML/CSS y ejecuta los JS.
- Los JS de página (`app.js`, `registro.js`, `perfil.js`, `app-interno.js`) **nunca hablan
  directamente con la base**: siempre pasan por **`datos.js`** (el objeto `DB`).
- `datos.js` habla con **`server.js`** por `fetch` a las puertas `/api/...`.
- `server.js` habla con la **base de datos** (Supabase en internet, SQLite en tu laptop).
- La **sesión** y lo "leído" de los chats viven en el navegador (`localStorage`); todo lo demás
  (usuarios, publicaciones, mensajes) vive en la **base de datos**.

**FIN de la documentación.**
