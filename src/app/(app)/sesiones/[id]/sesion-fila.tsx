"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { Td, Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { fecha, fechaInput } from "@/lib/utils";
import {
  registrarAsistencia,
  reprogramarSesion,
  type ActionState,
} from "../actions";

const initial: ActionState = { ok: false };

type Opcion = { id: string; nombre: string };

type CitaVM = {
  id: string;
  numeroSesion: number | null;
  fecha: string; // ISO
  horaInicio: string;
  horaFin: string;
  asistencia: "PENDIENTE" | "ASISTIO" | "FALTO" | "TARDANZA";
  terapiaRealizada: string | null;
  observacion: string | null;
  terapeutaId: string | null;
  terapeutaNombre: string | null;
};

export default function SesionFila({
  cita,
  terapeutas,
  asistenciaColor,
  asistenciaLabel,
}: {
  cita: CitaVM;
  terapeutas: Opcion[];
  asistenciaColor: "green" | "red" | "amber" | "sky" | "slate";
  asistenciaLabel: string;
}) {
  const [modo, setModo] = useState<"none" | "asistencia" | "reprogramar">(
    "none",
  );
  const cerrar = () => setModo("none");

  // El panel se cierra desde `alExito`, no desde un efecto: `ok` se queda en
  // true tras el primer guardado, así que un efecto que dependa de él no vuelve
  // a dispararse y el panel quedaría abierto en las correcciones siguientes.
  const asis = useFormReintento<ActionState>(registrarAsistencia, initial, {
    fallo: (s) => !s.ok,
    alExito: cerrar,
  });
  const repr = useFormReintento<ActionState>(reprogramarSesion, initial, {
    fallo: (s) => !s.ok,
    alExito: cerrar,
  });

  const abrir = (m: "asistencia" | "reprogramar") => {
    // Al reabrir se parte de lo guardado, no del intento fallido anterior.
    asis.limpiar();
    repr.limpiar();
    setModo((prev) => (prev === m ? "none" : m));
  };

  return (
    <>
      <tr className="hover:bg-slate-50">
        <Td className="font-medium text-slate-900">{cita.numeroSesion}</Td>
        <Td>{fecha(cita.fecha)}</Td>
        <Td>
          {cita.horaInicio}–{cita.horaFin}
        </Td>
        <Td>{cita.terapeutaNombre ?? "—"}</Td>
        <Td>
          <Badge color={asistenciaColor}>{asistenciaLabel}</Badge>
        </Td>
        <Td className="max-w-xs truncate text-slate-500">
          {cita.observacion ?? "—"}
        </Td>
        <Td>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1"
              onClick={() => abrir("asistencia")}
            >
              Asistencia
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1"
              onClick={() => abrir("reprogramar")}
            >
              Reprogramar
            </Button>
          </div>
        </Td>
      </tr>

      {modo === "asistencia" && (
        <tr className="bg-slate-50">
          <Td className="!p-0" />
          <td colSpan={6} className="px-4 py-4">
            <form key={asis.formKey} {...asis.formProps} className="space-y-3">
              <input type="hidden" name="citaId" value={cita.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Asistencia" required>
                  <Select
                    name="asistencia"
                    required
                    defaultValue={
                      cita.asistencia === "PENDIENTE" ? "" : cita.asistencia
                    }
                  >
                    <option value="" disabled>
                      Seleccione…
                    </option>
                    <option value="ASISTIO">Asistió</option>
                    <option value="TARDANZA">Tardanza</option>
                    <option value="FALTO">Faltó</option>
                  </Select>
                </Field>
                <Field label="Terapia realizada">
                  <Input
                    name="terapiaRealizada"
                    defaultValue={cita.terapiaRealizada ?? ""}
                    placeholder="Ej. Lenguaje, motricidad…"
                  />
                </Field>
              </div>
              <Field label="Observación">
                <Textarea
                  name="observacion"
                  defaultValue={cita.observacion ?? ""}
                  placeholder="Notas de la sesión…"
                />
              </Field>
              {asis.hayIntento && asis.estado.error && (
                <p className="text-sm text-red-700">{asis.estado.error}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModo("none")}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={asis.pendiente}>
                  {asis.pendiente ? "Guardando…" : "Guardar asistencia"}
                </Button>
              </div>
            </form>
          </td>
        </tr>
      )}

      {modo === "reprogramar" && (
        <tr className="bg-slate-50">
          <Td className="!p-0" />
          <td colSpan={6} className="px-4 py-4">
            <form key={repr.formKey} {...repr.formProps} className="space-y-3">
              <input type="hidden" name="citaId" value={cita.id} />
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Fecha" required>
                  <Input
                    type="date"
                    name="fecha"
                    required
                    defaultValue={fechaInput(cita.fecha)}
                  />
                </Field>
                <Field label="Hora inicio" required>
                  <Input
                    type="time"
                    name="horaInicio"
                    required
                    defaultValue={cita.horaInicio}
                  />
                </Field>
                <Field label="Hora fin" required>
                  <Input
                    type="time"
                    name="horaFin"
                    required
                    defaultValue={cita.horaFin}
                  />
                </Field>
                <Field label="Terapeuta">
                  <Select
                    name="terapeutaId"
                    defaultValue={cita.terapeutaId ?? ""}
                  >
                    <option value="">Sin asignar</option>
                    {terapeutas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {repr.hayIntento && repr.estado.error && (
                <p className="text-sm text-red-700">{repr.estado.error}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModo("none")}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={repr.pendiente}>
                  {repr.pendiente ? "Guardando…" : "Reprogramar"}
                </Button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
