# ServiHogar (versión con base de datos)

Plataforma que conecta clientes con trabajadores del hogar verificados.
Esta versión guarda los datos en una **base de datos real (SQLite)** en el servidor,
por lo que los usuarios, publicaciones y chats **se comparten entre dispositivos**
(todos los que se conecten al mismo servidor ven los mismos datos).

## Requisitos

- **Node.js 22 o superior** (ya lo tienes: v24). Descarga: https://nodejs.org
- Nada más. **No se necesita instalar ninguna base de datos ni ejecutar `npm install`**:
  el servidor usa el SQLite que viene integrado en Node y solo módulos nativos.

## Cómo ejecutarlo

**Opción A (la más fácil):** doble clic en **`iniciar-servidor.bat`**.

**Opción B (terminal):** abre una terminal en esta carpeta y ejecuta:

```bash
node server.js
```

Luego abre en el navegador: **http://localhost:3000**

La primera vez se crea solo el archivo `servihogar.db` con las cuentas de ejemplo.

## Subirlo a internet (Render + Supabase, datos permanentes)

El servidor detecta solo el modo: si existe la variable `DATABASE_URL` usa **PostgreSQL
(Supabase)**; si no, usa el SQLite local. Así, en la nube los datos **no se borran**.

1. **Supabase:** crea un proyecto gratis en supabase.com y copia la cadena de conexión
   del botón **Connect → Direct/Connection string → Session pooler** (reemplaza
   `[YOUR-PASSWORD]` por tu contraseña). Es tu `DATABASE_URL`.
2. **(Opcional) Probar local contra Supabase** — en PowerShell, en esta carpeta:
   ```powershell
   npm install
   $env:DATABASE_URL="postgresql://...tu-cadena..."
   node server.js
   ```
   Si arranca y dice "Base de datos: PostgreSQL (Supabase)", funciona. Verás los datos
   en Supabase → Table Editor.
3. **Render:** sube el código a GitHub y crea un **Web Service** con:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment: `DATABASE_URL` = tu cadena de Supabase, y `NODE_VERSION` = `24`.

> Nunca subas la `DATABASE_URL` a GitHub: ponla solo como variable de entorno en Render.

## Cuentas de ejemplo

| Rol        | Correo                      | Contraseña |
|------------|-----------------------------|------------|
| Cliente    | cliente@servihogar.com      | 123456     |
| Trabajador | trabajador@servihogar.com   | 123456     |

## Probar el chat entre dos cuentas a la vez

1. Inicia sesión como **cliente** en tu navegador normal.
2. Abre una **ventana de incógnito** (o un navegador distinto) e inicia sesión como **trabajador**.
3. Escríbanse: los mensajes aparecen en ambos lados en unos segundos (el chat se
   actualiza solo). El que envía se ve como emisor (derecha) y el otro como receptor (izquierda).

> Para usarlo entre **computadoras distintas** en la misma red (Wi‑Fi), en la otra PC abre
> `http://LA-IP-DE-TU-PC:3000` (averigua tu IP con `ipconfig`). Para usarlo por **internet**
> habría que subir el servidor a un hosting (Render, Railway, etc.).

## ¿Cómo está hecho?

- **`server.js`** — servidor en Node puro. Sirve la página y expone una API en `/api`
  (registro, login, publicaciones, mensajes…). Guarda todo en SQLite. Las contraseñas se
  guardan **cifradas** (hash con `crypto.scrypt`), no en texto plano.
- **`assets/js/datos.js`** — en el navegador, habla con la API (`fetch`) en lugar de
  `localStorage`. El resto del frontend (HTML/CSS) es el mismo de siempre.
- **`servihogar.db`** — el archivo de la base de datos (se crea solo). Para **reiniciar**
  todos los datos, cierra el servidor y borra ese archivo: al volver a iniciar se crea limpio.

## Estructura de la base de datos

- `usuarios` — clientes y trabajadores (con DNI, categoría, verificación, etc.).
- `publicaciones` — servicios publicados por los trabajadores.
- `mensajes` — chats entre usuarios.
- `chats_ocultos` — registro de "vaciar chat" por usuario (vaciar solo afecta a quien lo hace).

## Endpoints de la API (referencia rápida)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/registro` | Crear cuenta |
| POST | `/api/login` | Iniciar sesión |
| GET  | `/api/usuarios` | Lista de usuarios (sin contraseñas) |
| GET/POST | `/api/publicaciones` | Listar / crear publicaciones |
| DELETE | `/api/publicaciones/:id` | Eliminar publicación |
| GET  | `/api/conversaciones?correo=` | Conversaciones de un usuario |
| GET  | `/api/mensajes?viewer=&otro=` | Mensajes entre dos usuarios |
| POST | `/api/mensajes` | Enviar mensaje (texto o imagen) |
| POST | `/api/chats/vaciar` | Vaciar chat solo para un usuario |
