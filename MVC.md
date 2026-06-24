# Modelo Vista Controlador (MVC) de ServiHogar

## ¿Qué es MVC? (explicado fácil)

MVC es una forma de **organizar un proyecto en 3 partes** para que cada una tenga UN trabajo
claro. Imagina un restaurante:

- **Vista (View) = el comedor y la carta.** Es lo que el cliente VE y toca. No cocina ni guarda
  nada; solo muestra.
- **Controlador (Controller) = el mesero.** Recibe los pedidos del cliente, los lleva a la
  cocina, y trae la respuesta de vuelta a la mesa. Coordina, pero no cocina ni decide la receta.
- **Modelo (Model) = la cocina y la despensa.** Es donde están los ingredientes (los datos) y las
  recetas (las reglas). Prepara y guarda; no le importa cómo se ve la mesa.

La idea: la Vista no toca los datos directamente, y el Modelo no sabe cómo se ve la pantalla.
**Todo pasa por el Controlador.** Así, si cambias el diseño, no rompes los datos, y viceversa.

---

## Cómo se divide ServiHogar en MVC

| Capa | Qué hace | Archivos del proyecto |
|------|----------|------------------------|
| **VISTA** | Lo que el usuario ve y toca | Los `.html` (estructura) + los `.css` (apariencia) |
| **CONTROLADOR** | Recibe acciones y coordina | Frontend: `app.js`, `registro.js`, `perfil.js`, `app-interno.js`. Backend: las rutas `/api/...` dentro de `server.js` |
| **MODELO** | Guarda y maneja los datos y las reglas | La base de datos (Supabase/SQLite), el objeto `DB` de `server.js`, y `datos.js` (el "DB" del navegador) |

### VISTA (lo que se ve)
- **HTML** (`index.html`, `login.html`, `app-inicio.html`, `app-chat.html`, etc.): la estructura
  (formularios, botones, listas).
- **CSS** (`styles.css`, `app.css`, `sobre-nosotros.css`): los colores, tamaños y posiciones.
- La Vista **no decide nada**: solo muestra lo que el Controlador le dibuja y avisa cuando el
  usuario hace clic.

### CONTROLADOR (el que coordina)
- **Controladores del frontend (en el navegador):**
  - `app.js` → controla el login.
  - `registro.js` → controla el registro (validaciones + crear cuenta).
  - `perfil.js` → controla la pantalla de perfil.
  - `app-interno.js` → controla el feed, buscar, publicar, historial y chat.
  - Su trabajo: **escuchar eventos** (clic, enviar formulario), pedir datos al Modelo, y
    **actualizar la Vista** (dibujar tarjetas, mensajes, etc.).
- **Controlador del backend (en el servidor):**
  - La función `manejarApi` de `server.js`: recibe las peticiones a `/api/...`, le pide al
    Modelo (la base de datos) y responde. Es el "mesero" del lado del servidor.

### MODELO (los datos y las reglas)
- **La base de datos** (Supabase en internet, o SQLite local): las tablas `usuarios`,
  `publicaciones`, `mensajes`, `chats_ocultos`. Aquí viven los datos de verdad.
- **El objeto `DB` de `server.js`**: las funciones que consultan/guardan en la base (las
  consultas SQL), más reglas como cifrar contraseñas (`hashPassword`) o validar.
- **`datos.js` (el objeto `DB` del navegador)**: es el "modelo del lado del cliente". Guarda una
  copia (caché) y sabe cómo pedirle los datos al servidor. El Controlador del frontend nunca
  habla directo con la base: le pide a `datos.js`.

---

## Ejemplo de recorrido por el MVC: "Iniciar sesión"

1. **VISTA**: `login.html` muestra el formulario de correo y contraseña.
2. El usuario escribe y pulsa **"Entrar"**.
3. **CONTROLADOR (frontend)**: `app.js` escucha ese envío, lee lo escrito y llama al Modelo:
   `DB.login(correo, contraseña)`.
4. **MODELO (cliente)**: `datos.js` manda la petición al servidor → `fetch("/api/login")`.
5. **CONTROLADOR (backend)**: `manejarApi` en `server.js` recibe la petición.
6. **MODELO (servidor + base de datos)**: busca el usuario en la base y verifica la contraseña
   cifrada.
7. El servidor responde (usuario correcto / incorrecto).
8. **CONTROLADOR (frontend)**: `app.js` recibe la respuesta y **actualiza la VISTA**: si entró,
   te lleva a `app-inicio.html`; si no, muestra el error.

> Nota: como el proyecto tiene **frontend** (navegador) y **backend** (servidor), hay MVC en
> los dos lados, conectados por la API (`/api/...`). El Modelo final y real es la **base de
> datos** (Supabase).

---

## Diagrama (en texto)

```
        ┌──────────────────────────────────────────────┐
        │                    VISTA                       │
        │   index.html, login.html, app-*.html  (+ CSS)  │
        │         (lo que el usuario ve y toca)          │
        └───────────────┬───────────────▲────────────────┘
            el usuario   │               │  el controlador
            hace clic /  │               │  redibuja la vista
            envía form   ▼               │
        ┌──────────────────────────────────────────────┐
        │                 CONTROLADOR                    │
        │  Frontend: app.js, registro.js, perfil.js,     │
        │            app-interno.js                      │
        │  Backend:  /api/... en server.js (manejarApi)  │
        └───────────────┬───────────────▲────────────────┘
            pide / guarda│               │  devuelve
            datos        ▼               │  datos
        ┌──────────────────────────────────────────────┐
        │                    MODELO                      │
        │  datos.js (cliente)  →  DB en server.js  →     │
        │  Base de datos: Supabase (Postgres) / SQLite   │
        │     (usuarios, publicaciones, mensajes...)     │
        └──────────────────────────────────────────────┘
```

**Regla de oro de MVC en este proyecto:** la Vista (HTML/CSS) nunca toca la base de datos
directamente; siempre pasa por un Controlador (JS), que le pide al Modelo (`datos.js` →
`server.js` → base de datos).
