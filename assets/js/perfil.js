document.addEventListener("DOMContentLoaded", function () {
    const sesion = DB.getSesion();
    if (!sesion) { window.location.href = "login.html"; return; }

    const esTrabajador = sesion.tipo === "trabajador";
    const tipoTexto = esTrabajador ? "Trabajador" : "Cliente";

    document.getElementById("perfil-avatar").textContent = DB.iniciales(sesion);
    document.getElementById("perfil-nombre").textContent = sesion.nombre + " " + (sesion.apellido || "");
    document.getElementById("perfil-tipo").textContent = tipoTexto;
    document.getElementById("perfil-tipo2").textContent = tipoTexto;
    document.getElementById("perfil-correo").textContent = sesion.correo || "—";
    document.getElementById("perfil-telefono").textContent = sesion.telefono || "—";
    document.getElementById("perfil-distrito").textContent = sesion.distrito || "—";

    // Datos exclusivos del trabajador
    if (esTrabajador) {
        document.querySelectorAll(".perfil-fila-trab").forEach((el) => { el.hidden = false; });
        document.getElementById("perfil-categoria").textContent = DB.capitalizar(sesion.categoria) || "—";
        document.getElementById("perfil-experiencia").textContent = (sesion.experiencia || 0) + " años";
        document.getElementById("perfil-verificado").textContent = sesion.verificado ? "Cuenta verificada" : "Pendiente";
        document.getElementById("perfil-descripcion").textContent = sesion.descripcion || "—";
    }

    document.getElementById("btn-cerrar-sesion").addEventListener("click", function () {
        if (confirm("¿Cerrar sesión?")) {
            DB.cerrarSesion();
            window.location.href = "index.html";
        }
    });
});
