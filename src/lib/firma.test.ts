import { test } from "node:test";
import assert from "node:assert/strict";
import { validarFirmaPng } from "./firma";

/** PNG mínimo: firma + IHDR con el ancho y el alto dados (sin datos reales). */
function pngFalso(ancho: number, alto: number): string {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(ancho, 16);
  b.writeUInt32BE(alto, 20);
  return "data:image/png;base64," + b.toString("base64");
}

test("acepta un PNG con dimensiones razonables", () => {
  const r = validarFirmaPng(pngFalso(600, 200));
  assert.equal(r.ok, true);
});

test("rechaza vacío, otro tipo de imagen y base64 que no es PNG", () => {
  assert.equal(validarFirmaPng("").ok, false);
  assert.equal(validarFirmaPng("data:image/jpeg;base64,/9j/4AAQ").ok, false);
  const noPng =
    "data:image/png;base64," + Buffer.from("<svg>hola</svg> ".repeat(4)).toString("base64");
  assert.equal(validarFirmaPng(noPng).ok, false);
  assert.equal(validarFirmaPng("data:image/png;base64,¡no es base64!").ok, false);
});

test("rechaza imágenes demasiado grandes", () => {
  assert.equal(validarFirmaPng(pngFalso(5000, 200)).ok, false);
  assert.equal(validarFirmaPng(pngFalso(0, 200)).ok, false);
  const enorme = "data:image/png;base64," + "A".repeat(400_000);
  assert.equal(validarFirmaPng(enorme).ok, false);
});
