/* ============================================================
   ServiHogar — Capa de datos (cliente de la API / base de datos)
   ------------------------------------------------------------
   Ahora los datos viven en una BASE DE DATOS real en el servidor
   (ver server.js). Este archivo habla con la API en /api y guarda
   en memoria una copia (caché) para que el resto del código siga
   funcionando igual. La sesión (quién inició sesión) se guarda en
   localStorage porque es información solo de este navegador.
   ============================================================ */
(function () {
  "use strict";

  const API = "/api";
  const K_SESION = "servihogar_sesion";

  // Caché en memoria (se llena con DB.init())
  let _usuarios = [];
  let _publicaciones = [];
  let _conversaciones = [];
  const _mensajes = {}; // correoOtro -> [mensajes]

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
  const norm = (c) => (c || "").trim().toLowerCase();

  const DB = {
    /* ---------- Inicialización (carga la caché) ---------- */
    async init() {
      const sesion = this.getSesion();
      const tareas = [
        pedir("/usuarios").then((d) => { _usuarios = d || []; }),
        pedir("/publicaciones").then((d) => { _publicaciones = d || []; }),
      ];
      if (sesion) {
        tareas.push(this.cargarConversaciones(sesion.correo));
      }
      await Promise.all(tareas);
    },

    /* ---------- Usuarios / autenticación ---------- */
    getUsuarios() { return _usuarios; },
    getUsuarioPorCorreo(correo) {
      const c = norm(correo);
      return _usuarios.find((u) => norm(u.correo) === c) || null;
    },
    async registrar(datos) {
      // Devuelve el usuario creado o lanza error con .message
      const r = await pedir("/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      return r.usuario;
    },
    async login(correo, contrasena) {
      try {
        const r = await pedir("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correo, contrasena }),
        });
        return r.usuario;
      } catch (e) {
        if (e.status === 401) return null;
        throw e;
      }
    },

    /* ---------- Sesión (local de este navegador) ---------- */
    getSesion() {
      try { return JSON.parse(localStorage.getItem(K_SESION)); }
      catch (e) { return null; }
    },
    setSesion(usuario) { localStorage.setItem(K_SESION, JSON.stringify(usuario)); },
    cerrarSesion() { localStorage.removeItem(K_SESION); },

    /* ---------- Publicaciones ---------- */
    getPublicaciones() { return _publicaciones; },
    getPublicacionesDe(correo) {
      const c = norm(correo);
      return _publicaciones.filter((p) => norm(p.trabajadorCorreo) === c);
    },
    async addPublicacion(pub) {
      await pedir("/publicaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pub),
      });
      _publicaciones = await pedir("/publicaciones");
    },
    async eliminarPublicacion(id) {
      await pedir("/publicaciones/" + encodeURIComponent(id), { method: "DELETE" });
      _publicaciones = await pedir("/publicaciones");
    },

    /* ---------- Chats ---------- */
    getConversacionesDe() { return _conversaciones; },
    async cargarConversaciones(correo) {
      _conversaciones = await pedir("/conversaciones?correo=" + encodeURIComponent(norm(correo)));
      return _conversaciones;
    },
    getMensajes(viewerCorreo, otroCorreo) {
      return _mensajes[norm(otroCorreo)] || [];
    },
    async cargarMensajes(viewerCorreo, otroCorreo) {
      const data = await pedir("/mensajes?viewer=" + encodeURIComponent(norm(viewerCorreo)) +
        "&otro=" + encodeURIComponent(norm(otroCorreo)));
      _mensajes[norm(otroCorreo)] = data;
      return data;
    },
    async addMensaje(deCorreo, paraCorreo, texto, imagen) {
      await pedir("/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ de: deCorreo, para: paraCorreo, texto: texto, imagen: imagen }),
      });
      await this.cargarMensajes(deCorreo, paraCorreo);
    },
    async vaciarMensajes(usuarioCorreo, otroCorreo) {
      await pedir("/chats/vaciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuarioCorreo, otro: otroCorreo }),
      });
      await this.cargarMensajes(usuarioCorreo, otroCorreo);
    },

    /* ---------- Utilidades ---------- */
    iniciales(usuario) {
      if (!usuario || !usuario.nombre) return "?";
      const a = usuario.nombre.trim()[0] || "";
      const b = usuario.apellido ? usuario.apellido.trim()[0] : "";
      return (a + b).toUpperCase();
    },
    capitalizar(txt) {
      if (!txt) return "";
      return txt.charAt(0).toUpperCase() + txt.slice(1);
    },
  };

  window.DB = DB;
})();
