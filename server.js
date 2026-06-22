/* ============================================================
   ServiHogar — Servidor (Node) con base de datos
   ------------------------------------------------------------
   Funciona en DOS modos automáticamente:
   - Si existe la variable DATABASE_URL  -> usa PostgreSQL (Supabase).
   - Si NO existe                         -> usa SQLite local (archivo).
   Sirve el frontend y una API REST en /api.
   Ejecutar:   node server.js     (abrir http://localhost:3000)
   ============================================================ */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "servihogar.db");
const USE_PG = !!process.env.DATABASE_URL;

/* ============================================================
   Capa de base de datos (misma interfaz para SQLite y Postgres)
   - DB.query(sql, params) -> filas (array)
   - DB.get(sql, params)   -> primera fila
   - DB.run(sql, params)   -> ejecutar (insert/update/delete)
   - DB.exec(sql)          -> ejecutar esquema
   Se escribe el SQL con "?" y se adapta a Postgres ($1, $2...).
   ============================================================ */
let DB;
const BIG = USE_PG ? "BIGINT" : "INTEGER";

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

/* ---------- Esquema ---------- */
async function crearEsquema() {
  await DB.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nombre TEXT, apellido TEXT, telefono TEXT,
      correo TEXT UNIQUE, distrito TEXT, tipo TEXT,
      contrasena TEXT,
      dni TEXT, categoria TEXT, experiencia TEXT, descripcion TEXT,
      verificado INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS publicaciones (
      id TEXT PRIMARY KEY,
      trabajador_correo TEXT, trabajador_nombre TEXT, trabajador_verificado INTEGER,
      categoria TEXT, titulo TEXT, descripcion TEXT, distrito TEXT, precio TEXT,
      ts ${BIG}
    );
    CREATE TABLE IF NOT EXISTS mensajes (
      id TEXT PRIMARY KEY,
      clave TEXT, de_correo TEXT, para_correo TEXT,
      texto TEXT, imagen TEXT, ts ${BIG}
    );
    CREATE TABLE IF NOT EXISTS chats_ocultos (
      clave TEXT, correo TEXT, corte ${BIG},
      PRIMARY KEY (clave, correo)
    );
  `);
}

/* ---------- Utilidades ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function norm(c) { return (c || "").trim().toLowerCase(); }
function claveChat(a, b) { return [norm(a), norm(b)].sort().join("|"); }
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, salt, 64).toString("hex");
  return salt + ":" + h;
}
function verifyPassword(pw, stored) {
  if (!stored || stored.indexOf(":") === -1) return false;
  const [salt, h] = stored.split(":");
  const hh = crypto.scryptSync(pw, salt, 64).toString("hex");
  const a = Buffer.from(h, "hex");
  const b = Buffer.from(hh, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function publicoUsuario(u) {
  if (!u) return null;
  return {
    id: u.id, nombre: u.nombre, apellido: u.apellido, telefono: u.telefono,
    correo: u.correo, distrito: u.distrito, tipo: u.tipo,
    dni: u.dni, categoria: u.categoria, experiencia: u.experiencia,
    descripcion: u.descripcion, verificado: !!u.verificado,
  };
}
function publicaPub(p) {
  return {
    id: p.id, trabajadorCorreo: p.trabajador_correo, trabajadorNombre: p.trabajador_nombre,
    trabajadorVerificado: !!p.trabajador_verificado, categoria: p.categoria,
    titulo: p.titulo, descripcion: p.descripcion, distrito: p.distrito,
    precio: p.precio, ts: p.ts,
  };
}
async function corteDe(clave, correo) {
  const row = await DB.get("SELECT corte FROM chats_ocultos WHERE clave=? AND correo=?", [clave, norm(correo)]);
  return row ? row.corte : 0;
}

/* ---------- Datos de ejemplo (solo si está vacío) ---------- */
async function sembrar() {
  const row = await DB.get("SELECT COUNT(*) AS n FROM usuarios");
  if (Number(row.n) > 0) return;

  const insU = `INSERT INTO usuarios
    (id,nombre,apellido,telefono,correo,distrito,tipo,contrasena,dni,categoria,experiencia,descripcion,verificado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  await DB.run(insU, ["demo-trabajador", "Carlos", "Quispe", "987654321", "trabajador@servihogar.com",
    "Miraflores", "trabajador", hashPassword("123456"), "45678912", "gasfitería", "8",
    "Gasfitero certificado con 8 años de experiencia en instalaciones y reparaciones de agua y desagüe.", 1]);
  await DB.run(insU, ["demo-trabajadora2", "Rosa", "Flores", "956781234", "rosa@servihogar.com",
    "Surco", "trabajador", hashPassword("123456"), "41258963", "limpieza", "5",
    "Servicio de limpieza profunda del hogar, puntual y de confianza.", 1]);
  await DB.run(insU, ["demo-cliente", "Ana", "Rodríguez", "912345678", "cliente@servihogar.com",
    "San Isidro", "cliente", hashPassword("123456"), null, null, null, null, 0]);

  const insP = `INSERT INTO publicaciones
    (id,trabajador_correo,trabajador_nombre,trabajador_verificado,categoria,titulo,descripcion,distrito,precio,ts)
    VALUES (?,?,?,?,?,?,?,?,?,?)`;
  await DB.run(insP, ["pub-1", "trabajador@servihogar.com", "Carlos Quispe", 1, "gasfitería",
    "Instalación y reparación de tuberías de agua",
    "Detección de fugas, desatoros, cambio de tuberías y grifería. Trabajo garantizado por 6 meses.",
    "Miraflores", "S/ 80", Date.now() - 7200000]);
  await DB.run(insP, ["pub-2", "rosa@servihogar.com", "Rosa Flores", 1, "limpieza",
    "Limpieza profunda de departamentos",
    "Limpieza de pisos, ventanas, cocina a fondo, baños y organización general. Por horas o jornada completa.",
    "Surco", "S/ 120", Date.now() - 18000000]);

  const insM = `INSERT INTO mensajes (id,clave,de_correo,para_correo,texto,imagen,ts)
    VALUES (?,?,?,?,?,?,?)`;
  const cl = claveChat("cliente@servihogar.com", "trabajador@servihogar.com");
  let t = Date.now() - 3600000;
  await DB.run(insM, [uid(), cl, "cliente@servihogar.com", "trabajador@servihogar.com", "Hola Carlos, necesito reparar una fuga en el baño.", null, t++]);
  await DB.run(insM, [uid(), cl, "trabajador@servihogar.com", "cliente@servihogar.com", "Hola Ana, claro. ¿Para qué día lo necesitas?", null, t++]);
  await DB.run(insM, [uid(), cl, "cliente@servihogar.com", "trabajador@servihogar.com", "Si puedes este sábado por la mañana sería ideal.", null, t++]);

  console.log("Base de datos sembrada con cuentas de ejemplo.");
}

/* ---------- API ---------- */
function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 8 * 1024 * 1024) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); } });
  });
}

async function manejarApi(req, res, url) {
  const ruta = url.pathname;
  const q = url.searchParams;
  const metodo = req.method;

  if (ruta === "/api/registro" && metodo === "POST") {
    const b = await readBody(req);
    const correo = norm(b.correo);
    if (!b.nombre || !b.apellido || !correo || !b.contrasena || !b.tipo) {
      return sendJson(res, 400, { error: "Faltan datos obligatorios." });
    }
    if (await DB.get("SELECT 1 AS x FROM usuarios WHERE correo=?", [correo])) {
      return sendJson(res, 409, { error: "Ya existe una cuenta con ese correo." });
    }
    if (b.tipo === "trabajador" && b.dni &&
        await DB.get("SELECT 1 AS x FROM usuarios WHERE dni=?", [b.dni])) {
      return sendJson(res, 409, { error: "Ya existe un trabajador con ese DNI." });
    }
    const u = {
      id: uid(), nombre: b.nombre, apellido: b.apellido, telefono: b.telefono || "",
      correo, distrito: b.distrito || "", tipo: b.tipo, contrasena: hashPassword(b.contrasena),
      dni: b.dni || null, categoria: b.categoria || null, experiencia: b.experiencia || null,
      descripcion: b.descripcion || null, verificado: b.tipo === "trabajador" ? 1 : 0,
    };
    await DB.run(`INSERT INTO usuarios
      (id,nombre,apellido,telefono,correo,distrito,tipo,contrasena,dni,categoria,experiencia,descripcion,verificado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [u.id, u.nombre, u.apellido, u.telefono, u.correo, u.distrito, u.tipo,
       u.contrasena, u.dni, u.categoria, u.experiencia, u.descripcion, u.verificado]);
    return sendJson(res, 201, { usuario: publicoUsuario(u) });
  }

  if (ruta === "/api/login" && metodo === "POST") {
    const b = await readBody(req);
    const u = await DB.get("SELECT * FROM usuarios WHERE correo=?", [norm(b.correo)]);
    if (!u || !verifyPassword(b.contrasena || "", u.contrasena)) {
      return sendJson(res, 401, { error: "Correo o contraseña incorrectos." });
    }
    return sendJson(res, 200, { usuario: publicoUsuario(u) });
  }

  if (ruta === "/api/usuarios" && metodo === "GET") {
    const rows = await DB.query("SELECT * FROM usuarios");
    return sendJson(res, 200, rows.map(publicoUsuario));
  }

  if (ruta === "/api/publicaciones" && metodo === "GET") {
    const rows = await DB.query("SELECT * FROM publicaciones ORDER BY ts DESC");
    return sendJson(res, 200, rows.map(publicaPub));
  }
  if (ruta === "/api/publicaciones" && metodo === "POST") {
    const b = await readBody(req);
    if (!b.trabajadorCorreo || !b.titulo || !b.categoria || !b.descripcion) {
      return sendJson(res, 400, { error: "Faltan datos de la publicación." });
    }
    const id = uid();
    await DB.run(`INSERT INTO publicaciones
      (id,trabajador_correo,trabajador_nombre,trabajador_verificado,categoria,titulo,descripcion,distrito,precio,ts)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, norm(b.trabajadorCorreo), b.trabajadorNombre || "", b.trabajadorVerificado ? 1 : 0,
       b.categoria, b.titulo, b.descripcion, b.distrito || "", b.precio || "A convenir", Date.now()]);
    return sendJson(res, 201, { ok: true, id });
  }
  if (ruta.startsWith("/api/publicaciones/") && metodo === "DELETE") {
    const id = decodeURIComponent(ruta.split("/").pop());
    await DB.run("DELETE FROM publicaciones WHERE id=?", [id]);
    return sendJson(res, 200, { ok: true });
  }

  if (ruta === "/api/conversaciones" && metodo === "GET") {
    const c = norm(q.get("correo"));
    if (!c) return sendJson(res, 400, { error: "Falta correo." });
    const rows = await DB.query("SELECT * FROM mensajes WHERE de_correo=? OR para_correo=? ORDER BY ts ASC", [c, c]);
    const porPartner = {};
    rows.forEach((m) => {
      const otro = m.de_correo === c ? m.para_correo : m.de_correo;
      (porPartner[otro] = porPartner[otro] || []).push(m);
    });
    const convs = [];
    for (const otro of Object.keys(porPartner)) {
      const clave = claveChat(c, otro);
      const corte = await corteDe(clave, c);
      const visibles = porPartner[otro].filter((m) => m.ts > corte);
      const u = await DB.get("SELECT * FROM usuarios WHERE correo=?", [otro]);
      const ult = visibles.length ? visibles[visibles.length - 1] : null;
      convs.push({
        correo: otro,
        nombre: u ? u.nombre + " " + (u.apellido || "") : otro,
        tipo: u ? u.tipo : "cliente",
        ultimo: ult ? { de: ult.de_correo, texto: ult.texto, imagen: ult.imagen, ts: ult.ts } : null,
      });
    }
    convs.sort((a, b) => (b.ultimo ? b.ultimo.ts : 0) - (a.ultimo ? a.ultimo.ts : 0));
    return sendJson(res, 200, convs);
  }

  if (ruta === "/api/mensajes" && metodo === "GET") {
    const viewer = norm(q.get("viewer"));
    const otro = norm(q.get("otro"));
    if (!viewer || !otro) return sendJson(res, 400, { error: "Faltan parámetros." });
    const clave = claveChat(viewer, otro);
    const corte = await corteDe(clave, viewer);
    const rows = await DB.query("SELECT * FROM mensajes WHERE clave=? AND ts > ? ORDER BY ts ASC", [clave, corte]);
    return sendJson(res, 200, rows.map((m) => ({
      de: m.de_correo, para: m.para_correo, texto: m.texto, imagen: m.imagen, ts: m.ts,
    })));
  }
  if (ruta === "/api/mensajes" && metodo === "POST") {
    const b = await readBody(req);
    const de = norm(b.de), para = norm(b.para);
    if (!de || !para) return sendJson(res, 400, { error: "Faltan emisor/receptor." });
    if (!b.texto && !b.imagen) return sendJson(res, 400, { error: "Mensaje vacío." });
    const ts = Date.now();
    await DB.run(`INSERT INTO mensajes (id,clave,de_correo,para_correo,texto,imagen,ts)
      VALUES (?,?,?,?,?,?,?)`, [uid(), claveChat(de, para), de, para, b.texto || "", b.imagen || null, ts]);
    return sendJson(res, 201, { ok: true, ts });
  }

  if (ruta === "/api/chats/vaciar" && metodo === "POST") {
    const b = await readBody(req);
    const usuario = norm(b.usuario), otro = norm(b.otro);
    if (!usuario || !otro) return sendJson(res, 400, { error: "Faltan datos." });
    const clave = claveChat(usuario, otro);
    const ult = await DB.get("SELECT MAX(ts) AS m FROM mensajes WHERE clave=?", [clave]);
    const corte = (ult && ult.m) ? ult.m : Date.now();
    await DB.run(`INSERT INTO chats_ocultos (clave,correo,corte) VALUES (?,?,?)
      ON CONFLICT (clave,correo) DO UPDATE SET corte=excluded.corte`, [clave, usuario, corte]);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Ruta no encontrada." });
}

/* ---------- Archivos estáticos ---------- */
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
function servirEstatico(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const fp = path.join(ROOT, path.normalize(rel));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end("Prohibido"); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); return res.end("404 - No encontrado"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}

/* ---------- Arranque ---------- */
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
    console.log("Cuentas de ejemplo: cliente@servihogar.com / trabajador@servihogar.com  (contraseña 123456)");
  });
})().catch((e) => { console.error("No se pudo iniciar:", e); process.exit(1); });
