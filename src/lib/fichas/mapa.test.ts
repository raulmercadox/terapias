import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEYENDA_POR_DEFECTO,
  MAX_PUNTOS_TRAZO,
  MAX_TRAZOS,
  PALETA,
  esImagenValida,
  leyendaDeTexto,
  normalizarLeyenda,
  normalizarTrazos,
  puntosSvg,
  urlImagen,
} from "./mapa";
import { camposDe, normalizarPlantilla } from "./plantilla";
import { normalizarValores } from "./valores";
import { NOMBRES, aplicarEdicion, imagenesSubidas, parseEdicion, validarEdicion } from "./editor";

const ROJO = PALETA[0];
const AZUL = PALETA[1];

/* ── Trazos y leyenda ─────────────────────────────────── */

test("normalizarTrazos recorta a la imagen y redondea", () => {
  const t = normalizarTrazos([{ c: ROJO, p: [[-0.2, 0.5], [0.12345, 1.7]] }]);
  assert.deepEqual(t, [{ c: ROJO, p: [[0, 0.5], [0.123, 1]] }]);
});

test("normalizarTrazos descarta colores ajenos, puntos rotos y trazos vacíos", () => {
  const t = normalizarTrazos([
    { c: "#ff00ff", p: [[0.1, 0.1]] },
    { c: AZUL, p: [[0.2, "x"], [NaN, 0.1], [0.3]] },
    { c: AZUL, p: [[0.2, 0.2], [0.3, 0.3]] },
    "basura",
  ]);
  assert.deepEqual(t, [{ c: AZUL, p: [[0.2, 0.2], [0.3, 0.3]] }]);
});

test("normalizarTrazos respeta los límites de tamaño", () => {
  const largo = { c: ROJO, p: Array.from({ length: MAX_PUNTOS_TRAZO + 50 }, () => [0.5, 0.5]) };
  assert.equal(normalizarTrazos([largo])[0].p.length, MAX_PUNTOS_TRAZO);
  const muchos = Array.from({ length: MAX_TRAZOS + 10 }, () => ({ c: ROJO, p: [[0.1, 0.1]] }));
  assert.equal(normalizarTrazos(muchos).length, MAX_TRAZOS);
});

test("un toque sin arrastre se dibuja como un punto visible", () => {
  assert.equal(puntosSvg([[0.5, 0.25]]), "0.5,0.25 0.5,0.25");
});

test("leyendaDeTexto asigna colores en orden y tiene un valor por defecto", () => {
  assert.deepEqual(leyendaDeTexto("Dolor\n\n Rigidez "), [
    { color: ROJO, label: "Dolor" },
    { color: AZUL, label: "Rigidez" },
  ]);
  assert.deepEqual(leyendaDeTexto("  "), LEYENDA_POR_DEFECTO);
});

test("normalizarLeyenda no acepta colores fuera de la paleta ni repetidos", () => {
  assert.deepEqual(
    normalizarLeyenda([
      { color: ROJO, label: "Dolor" },
      { color: ROJO, label: "Otra vez rojo" },
      { color: "#123456", label: "Raro" },
    ]),
    [{ color: ROJO, label: "Dolor" }],
  );
});

test("imágenes: las de fábrica tienen URL pública, las subidas pasan por la ruta", () => {
  assert.equal(esImagenValida("base:cuerpo"), true);
  assert.equal(esImagenValida("cmu3ixz3o0001mipeiz5qj3pm"), true);
  assert.equal(esImagenValida("../../etc/passwd"), false);
  assert.equal(urlImagen("base:cuerpo"), "/fichas/cuerpo.svg");
  assert.equal(urlImagen("cmu3ixz3o0001mipeiz5qj3pm"), "/api/fichas/imagen/cmu3ixz3o0001mipeiz5qj3pm");
});

/* ── Plantilla y valores ──────────────────────────────── */

const plantilla = normalizarPlantilla({
  escalas: [],
  secciones: [
    {
      id: "dolor",
      titulo: "Dolor",
      grupos: [
        {
          id: "g",
          campos: [
            {
              tipo: "mapa",
              id: "zona",
              label: "Zona del dolor",
              imagenId: "base:cuerpo",
              leyenda: [{ color: ROJO, label: "Dolor" }],
            },
            { tipo: "mapa", id: "sinImagen", label: "Roto", imagenId: "../x" },
          ],
        },
      ],
    },
  ],
});

test("la plantilla acepta el mapa y descarta uno con imagen inválida", () => {
  assert.deepEqual(camposDe(plantilla).map((c) => c.id), ["zona"]);
});

test("el valor llega del formulario como Json y se guarda con su imagen", () => {
  const v = normalizarValores(
    { zona: JSON.stringify({ imagen: "base:cuerpo", trazos: [{ c: ROJO, p: [[0.1, 0.2]] }] }) },
    plantilla,
  );
  assert.deepEqual(v.zona, { t: "mapa", imagen: "base:cuerpo", trazos: [{ c: ROJO, p: [[0.1, 0.2]] }] });
});

test("se conserva la imagen sobre la que se dibujó aunque no sea la del campo", () => {
  const anterior = "cmu3ixz3o0001mipeiz5qj3pm";
  const v = normalizarValores(
    { zona: { t: "mapa", imagen: anterior, trazos: [{ c: ROJO, p: [[0.5, 0.5]] }] } },
    plantilla,
  );
  assert.equal(v.zona?.t === "mapa" ? v.zona.imagen : null, anterior);
});

test("sin trazos, Json roto o imagen inválida: no se guarda nada o se usa la del campo", () => {
  assert.deepEqual(normalizarValores({ zona: JSON.stringify({ imagen: "base:cuerpo", trazos: [] }) }, plantilla), {});
  assert.deepEqual(normalizarValores({ zona: "{no es json" }, plantilla), {});
  const v = normalizarValores({ zona: { imagen: "../x", trazos: [{ c: ROJO, p: [[0, 0]] }] } }, plantilla);
  assert.equal(v.zona?.t === "mapa" ? v.zona.imagen : null, "base:cuerpo");
});

test("un dibujo de un campo quitado se conserva como dato antiguo", () => {
  const v = normalizarValores(
    { viejo: { t: "mapa", imagen: "base:cuerpo", trazos: [{ c: AZUL, p: [[0.3, 0.3]] }] } },
    plantilla,
  );
  assert.equal(v.viejo?.t, "mapa");
});

/* ── Editor ───────────────────────────────────────────── */

function form(entradas: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entradas) fd.append(k, v);
  return fd;
}

function estructuraConMapa(campo: { clave: string; label: string; tipo: string; imagen: string; leyenda?: string }) {
  return form([
    [NOMBRES.estructuraCompleta, "1"],
    [NOMBRES.seccionId, "dolor"], [NOMBRES.seccionTitulo, "Dolor"],
    [NOMBRES.grupoId, "g"], [NOMBRES.grupoSeccion, "dolor"],
    ...[campo].flatMap((c): [string, string][] => [
      [NOMBRES.campoId, c.clave],
      [NOMBRES.campoLabel, c.label],
      [NOMBRES.campoGrupo, "g"],
      [NOMBRES.campoTipo, c.tipo],
      [NOMBRES.campoOpciones, c.leyenda ?? ""],
      [NOMBRES.campoMultiple, ""],
      [NOMBRES.campoEscala, ""],
      [NOMBRES.campoImagen, c.imagen],
    ]),
  ]);
}

let n = 0;
const ids = () => `x${++n}`;

test("el editor crea un mapa nuevo con su imagen y su leyenda", () => {
  const e = parseEdicion(
    estructuraConMapa({ clave: "+c1", label: "Mapa de emociones", tipo: "mapa", imagen: "base:cuerpo", leyenda: "Ansiedad\nEnojo" }),
  );
  assert.equal(validarEdicion(plantilla, e), null);
  const p = aplicarEdicion(plantilla, e, ids);
  const mapa = camposDe(p).find((c) => c.label === "Mapa de emociones");
  assert.ok(mapa?.tipo === "mapa");
  assert.equal(mapa.imagenId, "base:cuerpo");
  assert.deepEqual(mapa.leyenda.map((l) => l.label), ["Ansiedad", "Enojo"]);
  // Al quitar "zona" del formulario, deja de estar en la plantilla.
  assert.equal(camposDe(p).some((c) => c.id === "zona"), false);
});

test("un mapa nuevo sin imagen válida no se acepta", () => {
  const e = parseEdicion(estructuraConMapa({ clave: "+c1", label: "Mapa", tipo: "mapa", imagen: "" }));
  assert.match(validarEdicion(plantilla, e) ?? "", /imagen/);
});

test("a un mapa existente se le puede cambiar la imagen; la leyenda se conserva", () => {
  const nueva = "cmu3ixz3o0001mipeiz5qj3pm";
  const e = parseEdicion(estructuraConMapa({ clave: "zona", label: "Zona", tipo: "", imagen: nueva }));
  const p = aplicarEdicion(plantilla, e, ids);
  const zona = camposDe(p).find((c) => c.id === "zona");
  assert.ok(zona?.tipo === "mapa");
  assert.equal(zona.imagenId, nueva);
  assert.deepEqual(zona.leyenda, [{ color: ROJO, label: "Dolor" }]);
  assert.deepEqual(imagenesSubidas(p), [nueva]);
});
