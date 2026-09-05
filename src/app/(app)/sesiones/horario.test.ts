import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generarIntervalos,
  esIntervaloValido,
  opcionesPaso,
  chocaConRefrigerio,
  refrigerioDe,
  motivoFueraDeHorario,
  motivoFueraDeHorarioEnDia,
  PASO_GRILLA_MIN,
} from "./horario";

// Escenario del cliente: terapias grupales de 90 min y una individual de
// 9:00–9:45. Antes, la grilla avanzaba de duración en duración (90 min:
// 9:00, 10:30, …), así que era imposible iniciar la grupal a las 9:45.
// Ahora el paso de la grilla es independiente de la duración de la sesión.

test("grilla de 15 min ofrece 9:45 como inicio para una sesión de 90 min", () => {
  const filas = generarIntervalos("09:00", "13:00", 90, 15);
  const inicios = filas.map((i) => i.inicio);
  assert.ok(inicios.includes("09:45"));
  // La fila 9:45 representa la sesión completa 9:45–11:15 (para pintar
  // ocupación se compara contra todo el rango, no solo la celda).
  const f = filas.find((i) => i.inicio === "09:45")!;
  assert.equal(f.fin, "11:15");
  // Ningún inicio deja a la sesión terminando después del cierre.
  assert.ok(filas.every((i) => i.fin <= "13:00"));
  assert.equal(inicios.at(-1), "11:30"); // último inicio que cabe: 11:30–13:00
});

test("sin paso explícito conserva el comportamiento anterior (paso = duración)", () => {
  const inicios = generarIntervalos("09:00", "13:00", 90).map((i) => i.inicio);
  assert.deepEqual(inicios, ["09:00", "10:30"]);
});

test("esIntervaloValido acepta inicios alineados al paso y que quepan", () => {
  // El servidor valida contra el paso más fino configurable (5 min).
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "09:45", PASO_GRILLA_MIN), true);
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "11:30", PASO_GRILLA_MIN), true);
  // 9:50 ahora es válido: está alineado a 5 min desde las 9:00.
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "09:50", PASO_GRILLA_MIN), true);
  // Desalineado del paso (9:52 no es múltiplo de 5 desde las 9:00).
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "09:52", PASO_GRILLA_MIN), false);
  // No cabe: 11:45 + 90 min = 13:15 > cierre.
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "11:45", PASO_GRILLA_MIN), false);
  // Antes de la apertura.
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "08:45", PASO_GRILLA_MIN), false);
});

// Escenario del cliente: agregó 40 min a la lista de intervalos de la sede y
// esperaba verlo en el dropdown "Intervalo" de /sesiones/nuevo.
test("opcionesPaso incluye los intervalos configurados por la sede (ej. 40)", () => {
  assert.deepEqual(opcionesPaso([15, 30, 40, 45, 60], 45), [15, 30, 40, 45, 60]);
});

test("opcionesPaso usa los pasos predefinidos si la sede no configuró lista", () => {
  assert.deepEqual(opcionesPaso([], 30), [15, 30, 45, 60]);
});

test("opcionesPaso agrega el intervalo inicial si falta en la lista, ordenado", () => {
  assert.deepEqual(opcionesPaso([60, 15], 45), [15, 45, 60]);
});

// Refrigerio de la sede: es opcional, y cuando está configurado ninguna sesión
// puede invadirlo (ni empezando dentro, ni entrando desde antes).

test("refrigerioDe exige ambos campos y un rango con sentido", () => {
  assert.deepEqual(refrigerioDe("13:00", "14:00"), {
    inicio: "13:00",
    fin: "14:00",
  });
  // Opcional: sin configurar es null, no un rango que bloquee horas.
  assert.equal(refrigerioDe(null, null), null);
  assert.equal(refrigerioDe("13:00", null), null);
  assert.equal(refrigerioDe("", ""), null);
  // Datos inutilizables: se ignoran en vez de bloquear el día entero.
  assert.equal(refrigerioDe("14:00", "13:00"), null);
  assert.equal(refrigerioDe("13:00", "13:00"), null);
  assert.equal(refrigerioDe("25:00", "14:00"), null);
});

test("chocaConRefrigerio detecta la sesión que entra desde antes", () => {
  const r = refrigerioDe("13:00", "14:00");
  // Empieza dentro.
  assert.equal(chocaConRefrigerio("13:15", "14:00", r), true);
  // Empieza antes pero lo invade: este es el caso que se escapa si solo se
  // mira la hora de inicio.
  assert.equal(chocaConRefrigerio("12:30", "13:15", r), true);
  // Lo cubre por completo.
  assert.equal(chocaConRefrigerio("12:00", "15:00", r), true);
  // Pegadas al borde, sin invadir.
  assert.equal(chocaConRefrigerio("12:15", "13:00", r), false);
  assert.equal(chocaConRefrigerio("14:00", "14:45", r), false);
  // Sin refrigerio configurado nunca choca.
  assert.equal(chocaConRefrigerio("13:15", "14:00", null), false);
});

test("esIntervaloValido rechaza los inicios que se cruzan con el refrigerio", () => {
  const r = refrigerioDe("13:00", "14:00");
  // Atención 09:00–18:00, sesiones de 45 min.
  const valido = (hora: string) =>
    esIntervaloValido("09:00", "18:00", 45, hora, PASO_GRILLA_MIN, r);

  assert.equal(valido("12:00"), true); // 12:00–12:45, antes del refrigerio
  assert.equal(valido("12:15"), true); // 12:15–13:00, termina justo al empezar
  assert.equal(valido("12:30"), false); // 12:30–13:15, lo invade
  assert.equal(valido("13:00"), false); // arranca dentro
  assert.equal(valido("13:45"), false); // 13:45–14:30, todavía lo pisa
  assert.equal(valido("14:00"), true); // 14:00–14:45, ya salió

  // Sin refrigerio, las mismas horas son válidas.
  assert.equal(
    esIntervaloValido("09:00", "18:00", 45, "13:00", PASO_GRILLA_MIN),
    true,
  );
});

test("generarIntervalos no cambia: el refrigerio se pinta, no se oculta", () => {
  // La grilla sigue ofreciendo la fila para que el calendario pueda marcarla
  // como "Refrig." en vez de que la hora desaparezca sin explicación.
  const inicios = generarIntervalos("12:00", "15:00", 60, 60).map((i) => i.inicio);
  assert.deepEqual(inicios, ["12:00", "13:00", "14:00"]);
});

// Reglas del horario de la sede, compartidas por agendar una cita suelta y
// reprogramar la sesión de un paquete (antes solo las aplicaba la primera).

const SEDE = {
  horaApertura: "09:00",
  horaCierre: "18:00",
  diasLaborales: [1, 2, 3, 4, 5, 6], // sin domingos
  refrigerioInicio: "13:00",
  refrigerioFin: "14:00",
};
const LUNES = new Date(2026, 8, 7); // 07/09/2026
const DOMINGO = new Date(2026, 8, 6);

test("motivoFueraDeHorario acepta una franja normal", () => {
  assert.equal(motivoFueraDeHorario(SEDE, LUNES, "09:00", "09:45"), null);
  // Pegada al cierre y pegada al refrigerio: siguen siendo válidas.
  assert.equal(motivoFueraDeHorario(SEDE, LUNES, "17:15", "18:00"), null);
  assert.equal(motivoFueraDeHorario(SEDE, LUNES, "12:15", "13:00"), null);
});

test("motivoFueraDeHorario rechaza el día no laborable", () => {
  assert.equal(
    motivoFueraDeHorario(SEDE, DOMINGO, "09:00", "09:45"),
    "La sede no atiende los Domingo.",
  );
});

test("motivoFueraDeHorario rechaza fuera del rango de atención", () => {
  // El caso que se colaba al reprogramar: mover una sesión a las 22:00.
  assert.equal(
    motivoFueraDeHorario(SEDE, LUNES, "22:00", "22:45"),
    "El horario de atención es de 09:00 a 18:00.",
  );
  // Antes de abrir, y terminando después de cerrar.
  assert.equal(
    motivoFueraDeHorario(SEDE, LUNES, "08:00", "08:45"),
    "El horario de atención es de 09:00 a 18:00.",
  );
  assert.equal(
    motivoFueraDeHorario(SEDE, LUNES, "17:30", "18:15"),
    "El horario de atención es de 09:00 a 18:00.",
  );
});

test("motivoFueraDeHorario rechaza el cruce con el refrigerio", () => {
  assert.equal(
    motivoFueraDeHorario(SEDE, LUNES, "12:30", "13:15"),
    "Esa hora se cruza con el refrigerio de 13:00 a 14:00.",
  );
});

test("motivoFueraDeHorario ignora el refrigerio si la sede no lo configuró", () => {
  const sinRefrigerio = { ...SEDE, refrigerioInicio: null, refrigerioFin: null };
  assert.equal(motivoFueraDeHorario(sinRefrigerio, LUNES, "13:00", "13:45"), null);
});

// Al renovar un paquete se valida la plantilla semanal heredada (día + hora),
// no fechas concretas: la franja se repite todas las semanas.

test("motivoFueraDeHorarioEnDia aplica las mismas reglas sobre el día suelto", () => {
  assert.equal(motivoFueraDeHorarioEnDia(SEDE, 1, "09:00", "09:45"), null);
  assert.equal(
    motivoFueraDeHorarioEnDia(SEDE, 0, "09:00", "09:45"),
    "La sede no atiende los Domingo.",
  );
  assert.equal(
    motivoFueraDeHorarioEnDia(SEDE, 1, "22:00", "22:45"),
    "El horario de atención es de 09:00 a 18:00.",
  );
  assert.equal(
    motivoFueraDeHorarioEnDia(SEDE, 1, "13:00", "13:45"),
    "Esa hora se cruza con el refrigerio de 13:00 a 14:00.",
  );
});

test("motivoFueraDeHorario delega en la variante por día", () => {
  // El envoltorio por fecha no debe cambiar el veredicto.
  for (const [inicio, fin] of [["09:00", "09:45"], ["22:00", "22:45"], ["12:30", "13:15"]]) {
    assert.equal(
      motivoFueraDeHorario(SEDE, LUNES, inicio, fin),
      motivoFueraDeHorarioEnDia(SEDE, LUNES.getDay(), inicio, fin),
    );
  }
});
