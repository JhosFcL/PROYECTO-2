document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const correo = form.querySelector('input[type="email"]').value.trim().toLowerCase();
    const contrasena = form.querySelector('input[type="password"]').value;

    if (!correo || !contrasena) {
      alert("Por favor, completa ambos campos.");
      return;
    }

    try {
      const usuario = await DB.login(correo, contrasena);
      if (usuario) {
        DB.setSesion(usuario);
        alert("¡Bienvenido de nuevo, " + usuario.nombre + "!");
        // El inicio muestra un apartado distinto según el rol (cliente/trabajador)
        setTimeout(() => { window.location.href = "app-inicio.html"; }, 400);
      } else {
        alert("Correo o contraseña incorrectos. ¿Ya tienes una cuenta? Si no, regístrate primero.");
      }
    } catch (e) {
      alert("No se pudo conectar con el servidor. Asegúrate de que esté encendido (node server.js).");
    }
  });
});
