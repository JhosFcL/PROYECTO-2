document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("form-registro");
  const tipo = document.getElementById("tipo");
  const bloqueTrabajador = document.getElementById("bloque-trabajador");

  // Mostrar / ocultar la verificación de trabajador según el tipo de cuenta
  function actualizarBloque() {
    const esTrabajador = tipo.value === "trabajador";
    bloqueTrabajador.hidden = !esTrabajador;
  }
  tipo.addEventListener("change", actualizarBloque);
  actualizarBloque();

  // Solo permitir dígitos en teléfono y DNI
  ["telefono", "dni"].forEach(function (campo) {
    const el = form.elements[campo];
    if (el) {
      el.addEventListener("input", function () {
        this.value = this.value.replace(/\D/g, "");
      });
    }
  });

  const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const nombre = form.nombre.value.trim();
    const apellido = form.apellido.value.trim();
    const telefono = form.telefono.value.trim();
    const correo = form.correo.value.trim().toLowerCase();
    const distrito = form.distrito.value.trim();
    const tipoCuenta = form.tipo.value;
    const contrasena = form.contrasena.value;
    const confirmar = form.confirmar.value;

    // ── Validaciones generales ──
    if (!nombre || !apellido || !telefono || !correo || !distrito || !tipoCuenta || !contrasena || !confirmar) {
      alert("Por favor, completa todos los campos.");
      return;
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$/.test(nombre) || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$/.test(apellido)) {
      alert("El nombre y el apellido solo deben contener letras (mínimo 2 caracteres).");
      return;
    }
    if (!/^9\d{8}$/.test(telefono)) {
      alert("El teléfono debe tener 9 dígitos y empezar con 9 (ej: 987654321).");
      return;
    }
    if (!correoValido(correo)) {
      alert("Ingresa un correo electrónico válido.");
      return;
    }
    if (contrasena.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (contrasena !== confirmar) {
      alert("Las contraseñas no coinciden. Intenta de nuevo.");
      return;
    }

    const nuevoUsuario = {
      nombre, apellido, telefono, correo, distrito,
      tipo: tipoCuenta, contrasena,
    };

    // ── Verificación de seguridad para trabajadores ──
    if (tipoCuenta === "trabajador") {
      const dni = form.dni.value.trim();
      const categoria = form.categoria.value;
      const experiencia = form.experiencia.value.trim();
      const descripcion = form.descripcion.value.trim();
      const acepta = form.acepta.checked;

      if (!dni || !categoria || !experiencia || !descripcion) {
        alert("Como trabajador debes completar todos los datos de verificación.");
        return;
      }
      if (!/^\d{8}$/.test(dni)) {
        alert("El DNI debe tener exactamente 8 dígitos.");
        return;
      }
      const exp = parseInt(experiencia, 10);
      if (isNaN(exp) || exp < 0 || exp > 60) {
        alert("Ingresa unos años de experiencia válidos (0 a 60).");
        return;
      }
      if (descripcion.length < 15) {
        alert("La descripción debe tener al menos 15 caracteres.");
        return;
      }
      if (!acepta) {
        alert("Debes aceptar la declaración de veracidad para verificar tu cuenta.");
        return;
      }

      nuevoUsuario.dni = dni;
      nuevoUsuario.categoria = categoria;
      nuevoUsuario.experiencia = experiencia;
      nuevoUsuario.descripcion = descripcion;
      nuevoUsuario.verificado = true; // verificación simulada superada
    }

    try {
      const usuario = await DB.registrar(nuevoUsuario);
      DB.setSesion(usuario);
      if (tipoCuenta === "trabajador") {
        alert("¡Registro exitoso y cuenta verificada! Bienvenido/a, " + nombre + ".\nAhora publica tus servicios para que los clientes te encuentren.");
        setTimeout(() => { window.location.href = "app-publicar.html"; }, 400);
      } else {
        alert("¡Registro exitoso! Bienvenido/a, " + nombre + ".");
        setTimeout(() => { window.location.href = "app-inicio.html"; }, 400);
      }
    } catch (e) {
      alert(e.message || "No se pudo completar el registro. ¿El servidor está encendido?");
    }
  });
});
