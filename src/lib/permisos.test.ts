import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarPermisos, tienePermiso } from "./permisos";

test("tienePermiso: los permisos solo restringen al rol TERAPEUTA", () => {
  for (const rol of ["ADMINISTRADOR", "COORDINADOR", "USUARIO"] as const) {
    assert.equal(tienePermiso(rol, [], "ELIMINAR_CITAS"), true);
  }
});

test("tienePermiso: el terapeuta necesita el permiso concedido", () => {
  assert.equal(tienePermiso("TERAPEUTA", [], "CITA_AL_VUELO"), false);
  assert.equal(
    tienePermiso("TERAPEUTA", ["CITA_AL_VUELO"], "CITA_AL_VUELO"),
    true,
  );
  assert.equal(
    tienePermiso("TERAPEUTA", ["CITA_AL_VUELO"], "ELIMINAR_CITAS"),
    false,
  );
});

test("normalizarPermisos descarta valores desconocidos y duplicados", () => {
  assert.deepEqual(
    normalizarPermisos(["MOVER_CITAS", "HACKEAR", "MOVER_CITAS", ""]),
    ["MOVER_CITAS"],
  );
});
