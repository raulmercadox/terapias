"use client";

import { useActionState, useEffect, useState } from "react";
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

  const [asisState, asisAction, asisPending] = useActionState(
    registrarAsistencia,
    initial,
  );
  const [reprState, reprAction, reprPending] = useActionState(
    reprogramarSesion,
    initial,
  );

  useEffect(() => {
    if (asisState.ok || reprState.ok) setModo("none");
  }, [asisState.ok, reprState.ok]);

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
              onClick={() =>
                setModo((m) => (m === "asistencia" ? "none" : "asistencia"))
              }
            >
              Asistencia
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1"
              onClick={() =>
                setModo((m) => (m === "reprogramar" ? "none" : "reprogramar"))
              }
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
            <form action={asisAction} className="space-y-3">
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
              {asisState.error && (
                <p className="text-sm text-red-700">{asisState.error}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModo("none")}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={asisPending}>
                  {asisPending ? "Guardando…" : "Guardar asistencia"}
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
            <form action={reprAction} className="space-y-3">
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
              {reprState.error && (
                <p className="text-sm text-red-700">{reprState.error}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModo("none")}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={reprPending}>
                  {reprPending ? "Guardando…" : "Reprogramar"}
                </Button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
