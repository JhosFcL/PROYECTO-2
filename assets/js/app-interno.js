/* ============================================================
   ServiHogar — Lógica de la app interna (requiere datos.js)
   ============================================================ */
document.addEventListener("DOMContentLoaded", async function () {
  const sesion = DB.getSesion();

  // Sin sesion, ir al login
  if (!sesion) {
    window.location.href = "login.html";
    return;
  }

  // Cargar los datos desde la base de datos antes de pintar la página
  try {
    await DB.init();
  } catch (e) {
    alert("No se pudo conectar con el servidor. Asegúrate de ejecutar: node server.js");
    return;
  }

  const esTrabajador = sesion.tipo === "trabajador";

  // Escapar texto para insertarlo de forma segura en el HTML
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Iniciales a partir de un nombre completo (para los avatares)
  function inicialesDe(nombre) {
    const p = String(nombre || "").trim().split(/\s+/);
    return ((p[0] ? p[0][0] : "") + (p[1] ? p[1][0] : "")).toUpperCase() || "?";
  }

  function horaDe(ts) {
    const d = new Date(ts);
    return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
  }

  // ── Barra lateral (común a todas las páginas internas) ──
  const iniciales = DB.iniciales(sesion);
  const topAvatar = document.getElementById("topbar-avatar");
  if (topAvatar) topAvatar.textContent = iniciales;

  const sidebarName = document.getElementById("sidebar-name");
  const sidebarType = document.getElementById("sidebar-type");
  if (sidebarName) sidebarName.textContent = sesion.nombre + " " + (sesion.apellido || "");
  if (sidebarType) sidebarType.textContent = esTrabajador ? "Trabajador · Verificado" : "Cliente";

  const btnSalir = document.getElementById("btn-salir");
  if (btnSalir) {
    btnSalir.addEventListener("click", function (e) {
      e.preventDefault();
      DB.cerrarSesion();
      window.location.href = "index.html";
    });
  }

  // ── Nav adaptado al rol: el trabajador publica, el cliente busca ──
  const linkBuscar = document.querySelector('.sidebar-nav a[href="app-buscar.html"]');
  if (linkBuscar && esTrabajador) {
    linkBuscar.setAttribute("href", "app-publicar.html");
    const label = linkBuscar.querySelector("span:last-child");
    if (label) label.textContent = "Publicar";
  }

  // ── Notificación de chats no leídos (número rojo junto a "Chats") ──
  function getLeido() {
    try { return JSON.parse(localStorage.getItem("servihogar_leido")) || {}; }
    catch (e) { return {}; }
  }
  function setLeido(obj) { localStorage.setItem("servihogar_leido", JSON.stringify(obj)); }
  function contarNoLeidos() {
    const leido = getLeido();
    const yo = sesion.correo.toLowerCase();
    let n = 0;
    DB.getConversacionesDe(sesion.correo).forEach((c) => {
      if (c.ultimo && (c.ultimo.de || "").toLowerCase() !== yo && c.ultimo.ts > (leido[c.correo] || 0)) n++;
    });
    return n;
  }
  function marcarLeido(correo) {
    const leido = getLeido();
    const msgs = DB.getMensajes(sesion.correo, correo);
    const conv = DB.getConversacionesDe(sesion.correo).find((c) => c.correo === correo);
    leido[correo] = msgs.length ? msgs[msgs.length - 1].ts : (conv && conv.ultimo ? conv.ultimo.ts : Date.now());
    setLeido(leido);
  }
  function actualizarBadgeChats() {
    const link = document.querySelector('.sidebar-nav a[href="app-chat.html"]');
    if (!link) return;
    let badge = link.querySelector(".nav-badge");
    const n = contarNoLeidos();
    if (n > 0) {
      if (!badge) { badge = document.createElement("span"); badge.className = "nav-badge"; link.appendChild(badge); }
      badge.textContent = n > 99 ? "99+" : n;
    } else if (badge) {
      badge.remove();
    }
  }
  actualizarBadgeChats();

  /* ========================================================
     INICIO — apartado distinto para cliente y trabajador
     ======================================================== */
  const feed = document.querySelector(".feed");
  if (feed) {
    const topTitle = document.querySelector(".topbar-title");
    const feedBtn = document.querySelector(".btn-solicitar");
    const tabs = document.querySelectorAll(".feed-topbar .tab");

    // Saludo personalizado + métricas reales (en vez de cifras inventadas)
    const welcome = document.getElementById("welcome");
    const statsRow = document.getElementById("stats-row");
    const statCard = (val, lbl) =>
      `<div class="stat-card"><div class="stat-val">${val}</div><div class="stat-lbl">${esc(lbl)}</div></div>`;

    function pintarResumen() {
      const pubs = DB.getPublicaciones();
      const trabajadores = DB.getUsuarios().filter((u) => u.tipo === "trabajador");
      if (welcome) {
        const sub = esTrabajador
          ? "Gestiona tus publicaciones y conversaciones."
          : "Encuentra y contrata servicios verificados cerca de ti.";
        welcome.innerHTML = `<h2>Hola, ${esc(sesion.nombre)}</h2><p>${sub}</p>`;
      }
      if (statsRow) {
        if (esTrabajador) {
          const mias = pubs.filter((p) => (p.trabajadorCorreo || "").toLowerCase() === sesion.correo.toLowerCase());
          const convs = DB.getConversacionesDe(sesion.correo).length;
          statsRow.innerHTML =
            statCard(mias.length, "Servicios publicados") +
            statCard(convs, "Conversaciones") +
            statCard(sesion.verificado ? "Sí" : "No", "Cuenta verificada");
        } else {
          const categorias = new Set(pubs.map((p) => p.categoria)).size;
          const verificados = trabajadores.filter((t) => t.verificado).length;
          statsRow.innerHTML =
            statCard(pubs.length, "Servicios disponibles") +
            statCard(verificados, "Trabajadores verificados") +
            statCard(categorias, "Categorías");
        }
      }
    }

    const publicaciones = DB.getPublicaciones();

    function cardPublicacion(p, propia) {
      return `
        <div class="post-card">
            <div class="post-header">
                <div class="post-user">
                    <div class="post-avatar-placeholder">${inicialesDe(p.trabajadorNombre)}</div>
                    <div>
                        <div class="post-name">${esc(p.trabajadorNombre)} ${propia ? '<span class="badge-propio">Tú</span>' : ''}</div>
                        <div class="post-meta">${esc(DB.capitalizar(p.categoria))} · ${esc(p.distrito || "Lima")} · ${horaDe(p.ts)}</div>
                    </div>
                </div>
                <span class="post-tag">${esc(DB.capitalizar(p.categoria))}</span>
            </div>
            <div class="post-body">
                <h3>${esc(p.titulo)}</h3>
                <p>${esc(p.descripcion)}</p>
            </div>
            <div class="post-calificacion">Precio: ${esc(p.precio || "A convenir")}${p.trabajadorVerificado === false ? "" : " · Trabajador verificado"}</div>
            <div class="post-footer">
                ${propia
                  ? `<button class="post-action btn-eliminar-pub" data-id="${p.id}">Eliminar</button>`
                  : `<button class="post-action btn-contactar-pub" data-correo="${esc(p.trabajadorCorreo)}">Contactar</button>`}
                <button class="post-action like-btn">Me gusta <span class="like-count">0</span></button>
            </div>
        </div>`;
    }

    function pintarFeed() {
      const pubs = DB.getPublicaciones();
      if (esTrabajador) {
        if (topTitle) topTitle.textContent = "Mis publicaciones";
        if (feedBtn) { feedBtn.textContent = "+ Publicar servicio"; feedBtn.setAttribute("href", "app-publicar.html"); }
        if (tabs[0]) tabs[0].textContent = "Mis servicios";
        if (tabs[1]) tabs[1].textContent = "Todos";

        const mias = pubs.filter((p) => (p.trabajadorCorreo || "").toLowerCase() === sesion.correo.toLowerCase());
        feed.innerHTML = mias.length
          ? mias.map((p) => cardPublicacion(p, true)).join("")
          : `<div class="empty-state">
                <h3>Aún no has publicado servicios</h3>
                <p>Publica tus servicios para que los clientes puedan encontrarte y contactarte.</p>
                <a href="app-publicar.html" class="btn-primary" style="max-width:220px;margin:10px auto 0;">+ Publicar mi primer servicio</a>
             </div>`;
      } else {
        if (topTitle) topTitle.textContent = "Servicios disponibles";
        feed.innerHTML = pubs.length
          ? pubs.map((p) => cardPublicacion(p, false)).join("")
          : `<div class="empty-state"><h3>Todavía no hay servicios publicados</h3><p>Vuelve pronto, los trabajadores publicarán sus servicios.</p></div>`;
      }
      enlazarFeed();
    }

    function enlazarFeed() {
      feed.querySelectorAll(".like-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          this.classList.toggle("liked");
          const count = this.querySelector(".like-count");
          let n = parseInt(count.textContent, 10) || 0;
          count.textContent = this.classList.contains("liked") ? n + 1 : Math.max(0, n - 1);
        });
      });
      feed.querySelectorAll(".btn-contactar-pub").forEach((btn) => {
        btn.addEventListener("click", function () {
          localStorage.setItem("servihogar_chat_target", this.dataset.correo);
          window.location.href = "app-chat.html";
        });
      });
      feed.querySelectorAll(".btn-eliminar-pub").forEach((btn) => {
        btn.addEventListener("click", async function () {
          if (confirm("¿Eliminar esta publicación?")) {
            await DB.eliminarPublicacion(this.dataset.id);
            pintarFeed();
            pintarResumen();
          }
        });
      });
    }

    // Tabs del feed
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", function () {
        tabs.forEach((t) => t.classList.remove("active"));
        this.classList.add("active");
        const pubs = DB.getPublicaciones();
        if (esTrabajador) {
          const lista = i === 0
            ? pubs.filter((p) => (p.trabajadorCorreo || "").toLowerCase() === sesion.correo.toLowerCase())
            : pubs;
          feed.innerHTML = lista.length ? lista.map((p) => cardPublicacion(p, i === 0)).join("") : `<div class="empty-state"><h3>Sin publicaciones</h3></div>`;
          enlazarFeed();
        }
      });
    });

    pintarResumen();
    pintarFeed();
  }

  /* ========================================================
     BUSCAR — el cliente encuentra trabajadores verificados
     ======================================================== */
  const listaTrab = document.getElementById("lista-trabajadores");
  if (listaTrab) {
    function trabajadores() {
      return DB.getUsuarios().filter((u) => u.tipo === "trabajador");
    }

    window.renderTrabajadores = function (lista) {
      listaTrab.innerHTML = lista.length ? lista.map((t) => {
        const nPubs = DB.getPublicacionesDe(t.correo).length;
        return `
        <div class="worker-card">
            <div style="display:flex;align-items:center;gap:12px;">
                <div class="worker-avatar">${inicialesDe(t.nombre + " " + (t.apellido || ""))}</div>
                <div>
                    <div class="worker-name">${esc(t.nombre)} ${esc(t.apellido || "")} ${t.verificado ? '<span class="badge-verif">Verificado</span>' : ''}</div>
                    <div class="worker-cat">${esc(DB.capitalizar(t.categoria))} · ${esc(t.distrito || "Lima")}</div>
                </div>
            </div>
            <div class="worker-rating">${esc(t.experiencia || 0)} años de experiencia · ${nPubs} servicio(s)</div>
            <button class="btn-contactar" data-correo="${esc(t.correo)}">Contactar</button>
        </div>`;
      }).join("") : `<div class="empty-state"><h3>No se encontraron trabajadores</h3></div>`;

      listaTrab.querySelectorAll(".btn-contactar").forEach((btn) => {
        btn.addEventListener("click", function () {
          localStorage.setItem("servihogar_chat_target", this.dataset.correo);
          window.location.href = "app-chat.html";
        });
      });
    };

    window.filtrar = function (cat, btn) {
      document.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
      if (btn) btn.classList.add("active");
      const lista = cat === "todos" ? trabajadores() : trabajadores().filter((t) => t.categoria === cat);
      window.renderTrabajadores(lista);
    };

    const buscador = document.getElementById("buscador");
    if (buscador) {
      buscador.addEventListener("input", function () {
        const q = this.value.toLowerCase();
        window.renderTrabajadores(trabajadores().filter((t) =>
          (t.nombre + " " + (t.apellido || "")).toLowerCase().includes(q) ||
          (t.categoria || "").toLowerCase().includes(q) ||
          (t.distrito || "").toLowerCase().includes(q)
        ));
      });
    }

    window.renderTrabajadores(trabajadores());
  }

  /* ========================================================
     HISTORIAL — demostración por rol
     ======================================================== */
  const listaHist = document.getElementById("lista-historial");
  if (listaHist) {
    // Datos de demostración coherentes con el rol: el cliente ve a los
    // trabajadores que contrató; el trabajador ve a los clientes que atendió.
    const historialCliente = [
      { servicio: "Reparación de tubería", contraparte: "Carlos Quispe", fecha: "12 may 2025", monto: "S/ 80", estado: "completado" },
      { servicio: "Limpieza del hogar", contraparte: "Rosa Flores", fecha: "05 may 2025", monto: "S/ 120", estado: "completado" },
      { servicio: "Instalación eléctrica", contraparte: "Pedro Mamani", fecha: "28 abr 2025", monto: "S/ 150", estado: "completado" },
      { servicio: "Mudanza de oficina", contraparte: "Juan Huanca", fecha: "30 may 2025", monto: "S/ 200", estado: "pendiente" },
    ];
    const historialTrabajador = [
      { servicio: "Reparación de tubería", contraparte: "Ana Rodríguez", fecha: "12 may 2025", monto: "S/ 80", estado: "completado" },
      { servicio: "Desatoro de desagüe", contraparte: "María Salas", fecha: "06 may 2025", monto: "S/ 90", estado: "completado" },
      { servicio: "Cambio de grifería", contraparte: "Jorge Ramos", fecha: "29 abr 2025", monto: "S/ 110", estado: "completado" },
      { servicio: "Instalación de termas", contraparte: "Lucía Paredes", fecha: "30 may 2025", monto: "S/ 160", estado: "pendiente" },
    ];
    // Los datos de ejemplo solo se muestran en las cuentas de demostración.
    // Un usuario nuevo empieza con el historial vacío.
    const correosDemo = ["cliente@servihogar.com", "trabajador@servihogar.com", "rosa@servihogar.com"];
    const esDemo = correosDemo.indexOf(sesion.correo.toLowerCase()) !== -1;
    const historial = !esDemo ? [] : (esTrabajador ? historialTrabajador : historialCliente);
    const etiqueta = esTrabajador ? "Cliente" : "Trabajador";

    function renderHistorial(lista) {
      listaHist.innerHTML = lista.length ? lista.map((h) => `
        <div class="historial-card">
            <div style="display:flex;align-items:center;gap:14px;">
                <div class="hist-avatar">${inicialesDe(h.contraparte)}</div>
                <div>
                    <div style="font-weight:600;font-size:15px;">${h.servicio}</div>
                    <div style="font-size:13px;color:#6b7280;">${etiqueta}: ${h.contraparte} · ${h.fecha}</div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-weight:600;">${h.monto}</span>
                <span class="badge-estado badge-${h.estado}">${DB.capitalizar(h.estado)}</span>
            </div>
        </div>`).join("") : `<div class="empty-state"><h3>Aún no tienes servicios en tu historial</h3><p>Cuando completes un servicio aparecerá aquí.</p></div>`;
    }

    window.mostrarTab = function (filtro, btn) {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      renderHistorial(filtro === "todos" ? historial : historial.filter((h) => h.estado === filtro));
    };

    renderHistorial(historial);
  }

  /* ========================================================
     PUBLICAR — el trabajador publica sus servicios
     ======================================================== */
  const formPublicar = document.getElementById("form-publicar");
  if (formPublicar) {
    // Solo trabajadores pueden publicar
    if (!esTrabajador) {
      alert("Solo los trabajadores pueden publicar servicios.");
      window.location.href = "app-inicio.html";
      return;
    }

    const misPubs = document.getElementById("mis-publicaciones");

    // Precargar categoría del trabajador
    if (sesion.categoria) formPublicar.categoria.value = sesion.categoria;
    if (sesion.distrito) formPublicar.distrito.value = sesion.distrito;

    function pintarMisPubs() {
      const pubs = DB.getPublicacionesDe(sesion.correo);
      misPubs.innerHTML = pubs.length ? pubs.map((p) => `
        <div class="post-card">
            <div class="post-header">
                <div class="post-user">
                    <div class="post-avatar-placeholder">${inicialesDe(p.trabajadorNombre || sesion.nombre)}</div>
                    <div>
                        <div class="post-name">${esc(p.titulo)}</div>
                        <div class="post-meta">${esc(DB.capitalizar(p.categoria))} · ${esc(p.distrito || "Lima")} · ${esc(p.precio || "A convenir")}</div>
                    </div>
                </div>
                <button class="post-action btn-eliminar-pub" data-id="${p.id}">Eliminar</button>
            </div>
            <div class="post-body"><p>${esc(p.descripcion)}</p></div>
        </div>`).join("") : `<div class="empty-state"><h3>Aún no tienes publicaciones</h3><p>Completa el formulario para publicar tu primer servicio.</p></div>`;

      misPubs.querySelectorAll(".btn-eliminar-pub").forEach((btn) => {
        btn.addEventListener("click", async function () {
          if (confirm("¿Eliminar esta publicación?")) {
            await DB.eliminarPublicacion(this.dataset.id);
            pintarMisPubs();
          }
        });
      });
    }

    formPublicar.addEventListener("submit", async function (e) {
      e.preventDefault();
      const titulo = formPublicar.titulo.value.trim();
      const categoria = formPublicar.categoria.value;
      const distrito = formPublicar.distrito.value.trim();
      const precio = formPublicar.precio.value.trim();
      const descripcion = formPublicar.descripcion.value.trim();

      if (!titulo || !categoria || !distrito || !descripcion) {
        alert("Completa el título, la categoría, el distrito y la descripción.");
        return;
      }
      if (titulo.length < 5) { alert("El título debe ser más descriptivo (mínimo 5 caracteres)."); return; }
      if (descripcion.length < 15) { alert("La descripción debe tener al menos 15 caracteres."); return; }

      try {
        await DB.addPublicacion({
          trabajadorCorreo: sesion.correo,
          trabajadorNombre: sesion.nombre + " " + (sesion.apellido || ""),
          trabajadorVerificado: !!sesion.verificado,
          categoria,
          titulo, descripcion, distrito,
          precio: precio || "A convenir",
        });
      } catch (err) {
        alert("No se pudo publicar. Verifica que el servidor esté encendido.");
        return;
      }

      formPublicar.reset();
      if (sesion.categoria) formPublicar.categoria.value = sesion.categoria;
      if (sesion.distrito) formPublicar.distrito.value = sesion.distrito;
      alert("¡Servicio publicado! Ya es visible para los clientes.");
      pintarMisPubs();
    });

    pintarMisPubs();
  }

  /* ========================================================
     CHAT — mensajería funcional cliente <-> trabajador
     ======================================================== */
  const chatList = document.getElementById("chat-list");
  if (chatList) {
    const chatHeader = document.getElementById("chat-header");
    const chatMessages = document.getElementById("chat-messages");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatImage = document.getElementById("chat-image");
    const chatHeaderActions = document.getElementById("chat-header-actions");
    const btnVaciarChat = document.getElementById("btn-vaciar-chat");
    const chatPage = document.querySelector(".chat-page");
    const chatBack = document.getElementById("chat-back");
    if (chatBack) {
      chatBack.addEventListener("click", function () {
        if (chatPage) chatPage.classList.remove("chat-abierto");
      });
    }
    let chatActual = null; // correo de la otra persona
    let ultimaFirma = "";  // para detectar mensajes nuevos en el sondeo

    function pintarLista() {
      const convs = DB.getConversacionesDe(sesion.correo);
      if (!convs.length) {
        chatList.innerHTML = `<div class="empty-state" style="padding:24px;"><p>No tienes conversaciones todavía.</p></div>`;
        return;
      }
      chatList.innerHTML = convs.map((c) => `
        <div class="chat-item ${c.correo === chatActual ? "active" : ""}" data-correo="${esc(c.correo)}">
            <div class="chat-item-name">${esc(c.nombre)} <span class="chat-item-rol">${c.tipo === "trabajador" ? "Trabajador" : "Cliente"}</span></div>
            <div class="chat-item-last">${c.ultimo ? (c.ultimo.texto ? esc(c.ultimo.texto.substring(0, 38)) : "(imagen)") : "Nueva conversación"}</div>
        </div>`).join("");

      chatList.querySelectorAll(".chat-item").forEach((item) => {
        item.addEventListener("click", function () {
          abrirChat(this.dataset.correo);
        });
      });
    }

    function pintarMensajes() {
      if (!chatActual) return;
      const otro = DB.getUsuarioPorCorreo(chatActual);
      const msgs = DB.getMensajes(sesion.correo, chatActual);
      chatMessages.innerHTML = msgs.length ? msgs.map((m) => {
        const mio = (m.de || "").toLowerCase() === sesion.correo.toLowerCase();
        const avatar = otro ? DB.iniciales(otro) : "?";
        const imagenHtml = m.imagen ? `<img class="msg-image" src="${m.imagen}" alt="Imagen enviada">` : "";
        const textoHtml = m.texto ? `<div>${esc(m.texto)}</div>` : "";
        return `
          <div class="msg ${mio ? "sent" : ""}">
              ${mio ? "" : `<div class="msg-avatar">${avatar}</div>`}
              <div>
                  <div class="msg-bubble">${imagenHtml}${textoHtml}</div>
                  <div class="msg-time">${horaDe(m.ts)}</div>
              </div>
          </div>`;
      }).join("") : `<div class="empty-state" style="margin:auto;"><p>Escribe el primer mensaje.</p></div>`;
      chatMessages.scrollTop = chatMessages.scrollHeight;
      ultimaFirma = firmaDe(msgs);
    }

    function firmaDe(msgs) {
      return msgs.length + ":" + (msgs.length ? msgs[msgs.length - 1].ts : 0);
    }

    async function abrirChat(correo) {
      chatActual = correo.toLowerCase();
      const otro = DB.getUsuarioPorCorreo(chatActual);
      const nombre = otro ? otro.nombre + " " + (otro.apellido || "") : chatActual;
      const rol = otro ? (otro.tipo === "trabajador" ? "Trabajador" : "Cliente") : "";
      chatHeader.textContent = nombre + (rol ? " · " + rol : "");
      if (chatHeaderActions) chatHeaderActions.hidden = false;
      if (chatPage) chatPage.classList.add("chat-abierto"); // en móvil muestra la conversación
      try { await DB.cargarMensajes(sesion.correo, chatActual); } catch (e) {}
      pintarMensajes();
      reactivarSeleccion();
      marcarLeido(chatActual);
      actualizarBadgeChats();
    }

    function reactivarSeleccion() {
      chatList.querySelectorAll(".chat-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.correo === chatActual);
      });
    }

    if (chatForm) {
      chatForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const texto = chatInput.value.trim();
        if (!texto || !chatActual) {
          if (!chatActual) alert("Selecciona una conversación primero.");
          return;
        }
        chatInput.value = "";
        try {
          await DB.addMensaje(sesion.correo, chatActual, texto);
          await DB.cargarConversaciones(sesion.correo);
        } catch (err) {
          alert("No se pudo enviar el mensaje. ¿El servidor está encendido?");
          return;
        }
        pintarMensajes();
        pintarLista();
        reactivarSeleccion();
      });
    }

    // Adjuntar imagen: se envía como un mensaje con imagen
    if (chatImage) {
      chatImage.addEventListener("change", function () {
        const file = this.files && this.files[0];
        this.value = ""; // permitir volver a elegir la misma imagen
        if (!file) return;
        if (!chatActual) { alert("Selecciona una conversación primero."); return; }
        if (!file.type.startsWith("image/")) { alert("Solo se permiten imágenes."); return; }
        if (file.size > 2 * 1024 * 1024) { alert("La imagen es muy grande (máximo 2 MB)."); return; }
        const reader = new FileReader();
        reader.onload = async function () {
          try {
            await DB.addMensaje(sesion.correo, chatActual, chatInput.value.trim(), reader.result);
            await DB.cargarConversaciones(sesion.correo);
            chatInput.value = "";
            pintarMensajes();
            pintarLista();
            reactivarSeleccion();
          } catch (err) {
            alert("No se pudo enviar la imagen (puede ser muy grande o el servidor está caído).");
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Vaciar el chat solo para el usuario actual (el contacto lo sigue viendo)
    if (btnVaciarChat) {
      btnVaciarChat.addEventListener("click", async function () {
        if (!chatActual) return;
        if (confirm("¿Vaciar este chat? Solo se borrará para ti; el contacto seguirá viendo los mensajes.")) {
          await DB.vaciarMensajes(sesion.correo, chatActual);
          await DB.cargarConversaciones(sesion.correo);
          pintarMensajes();
          pintarLista();
          reactivarSeleccion();
        }
      });
    }

    // ---- Visor de imágenes (lightbox con zoom) ----
    let lb, lbImg, lbScale = 1, lbX = 0, lbY = 0, lbDrag = false, lbDX = 0, lbDY = 0;

    function lbAplicar() {
      lbImg.style.transform = "translate(" + lbX + "px," + lbY + "px) scale(" + lbScale + ")";
    }
    function lbZoom(z) {
      lbScale = Math.min(5, Math.max(0.5, Math.round(z * 100) / 100));
      if (lbScale <= 1) { lbX = 0; lbY = 0; }
      lbAplicar();
      const lbl = lb.querySelector(".lightbox-zoom-reset");
      if (lbl) lbl.textContent = Math.round(lbScale * 100) + "%";
    }
    function crearLightbox() {
      lb = document.createElement("div");
      lb.className = "lightbox";
      lb.innerHTML =
        '<button class="lightbox-close" type="button" aria-label="Cerrar">×</button>' +
        '<img class="lightbox-img" alt="Imagen ampliada" draggable="false">' +
        '<div class="lightbox-controls">' +
          '<button type="button" data-z="out" aria-label="Alejar">−</button>' +
          '<button type="button" class="lightbox-zoom-reset" data-z="reset">100%</button>' +
          '<button type="button" data-z="in" aria-label="Acercar">+</button>' +
        '</div>';
      document.body.appendChild(lb);
      lbImg = lb.querySelector(".lightbox-img");

      lb.querySelector(".lightbox-close").addEventListener("click", cerrarLightbox);
      lb.addEventListener("click", function (e) { if (e.target === lb) cerrarLightbox(); });
      lb.querySelectorAll(".lightbox-controls button").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          if (b.dataset.z === "in") lbZoom(lbScale + 0.25);
          else if (b.dataset.z === "out") lbZoom(lbScale - 0.25);
          else lbZoom(1);
        });
      });
      lbImg.addEventListener("wheel", function (e) {
        e.preventDefault();
        lbZoom(lbScale + (e.deltaY < 0 ? 0.2 : -0.2));
      }, { passive: false });
      lbImg.addEventListener("dblclick", function (e) {
        e.preventDefault();
        lbZoom(lbScale > 1 ? 1 : 2);
      });
      lbImg.addEventListener("pointerdown", function (e) {
        lbDrag = true; lbDX = e.clientX - lbX; lbDY = e.clientY - lbY;
        lbImg.setPointerCapture(e.pointerId);
      });
      lbImg.addEventListener("pointermove", function (e) {
        if (!lbDrag) return;
        lbX = e.clientX - lbDX; lbY = e.clientY - lbDY; lbAplicar();
      });
      lbImg.addEventListener("pointerup", function () { lbDrag = false; });
    }
    function abrirLightbox(src) {
      if (!lb) crearLightbox();
      lbImg.src = src;
      lbX = 0; lbY = 0;
      lbZoom(1);
      lb.classList.add("open");
    }
    function cerrarLightbox() { if (lb) lb.classList.remove("open"); }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") cerrarLightbox();
    });
    chatMessages.addEventListener("click", function (e) {
      const img = e.target.closest(".msg-image");
      if (img) abrirLightbox(img.src);
    });

    pintarLista();

    // Si venimos de "Contactar", abrir/crear esa conversación
    const target = localStorage.getItem("servihogar_chat_target");
    if (target) {
      localStorage.removeItem("servihogar_chat_target");
      const t = target.toLowerCase();
      if (t !== sesion.correo.toLowerCase()) {
        // asegurar que aparezca en la lista aunque no haya mensajes
        if (!DB.getConversacionesDe(sesion.correo).some((c) => c.correo === t)) {
          const otro = DB.getUsuarioPorCorreo(t);
          const item = document.createElement("div");
          item.className = "chat-item";
          item.dataset.correo = t;
          item.innerHTML = `<div class="chat-item-name">${esc(otro ? otro.nombre + " " + (otro.apellido || "") : t)}</div><div class="chat-item-last">Nueva conversación</div>`;
          item.addEventListener("click", () => abrirChat(t));
          if (chatList.querySelector(".empty-state")) chatList.innerHTML = "";
          chatList.prepend(item);
        }
        abrirChat(t);
      }
    } else {
      // abrir la primera conversación por defecto (en móvil se ve primero la lista)
      const esMovil = window.matchMedia("(max-width: 640px)").matches;
      const convs = DB.getConversacionesDe(sesion.correo);
      if (convs.length && !esMovil) abrirChat(convs[0].correo);
    }

    // Sondeo: refresca la lista y el chat abierto para ver mensajes nuevos en vivo
    setInterval(async function () {
      if (document.hidden) return;
      try {
        await DB.cargarConversaciones(sesion.correo);
        pintarLista();
        reactivarSeleccion();
        if (chatActual) {
          await DB.cargarMensajes(sesion.correo, chatActual);
          if (firmaDe(DB.getMensajes(sesion.correo, chatActual)) !== ultimaFirma) {
            pintarMensajes();
          }
          marcarLeido(chatActual); // el chat abierto se considera leído
        }
        actualizarBadgeChats();
      } catch (e) { /* servidor no disponible momentáneamente */ }
    }, 3000);
  }
});
