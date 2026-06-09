"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import {
  actualizarPaquete,
  cambiarEstadoPaquete,
  renovarPaquete,
  anularPaquete,
  type ActionState,
} from "../actions";

const initial: ActionState = { ok: false };

type EstadoPaquete = "ACTIVO" | "COMPLETADO" | "VENCIDO" | "ANULADO";

export default function PaqueteAcciones({
  paqueteId,
  estado,
  precio,
  observacion,
  todasRegistradas,
}: {
  paqueteId: string;
  estado: EstadoPaquete;
  precio: number;
  observacion: string;
  todasRegistradas: boolean;
}) {
  const [editar, setEditar] = useState(false);

  const [editState, editAction, editPending] = useActionState(
    actualizarPaquete,
    initial,
  );
  const [estadoState, estadoAction, estadoPending] = useActionState(
    cambiarEstadoPaquete,
    initial,
  );
  const [renovState, renovAction, renovPending] = useActionState(
    renovarPaquete,
    initial,
  );
  const [anulState, anulAction, anulPending] = useActionState(
    anularPaquete,
    initial,
  );

  const activo = estado === "ACTIVO";

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-900">Acciones</p>

      {/* Editar precio / observación */}
      {!editar ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => setEditar(true)}
        >
          Editar datos
        </Button>
      ) : (
        <form action={editAction} className="space-y-3">
          <input type="hidden" name="paqueteId" value={paqueteId} />
          <Field label="Precio (S/)" required>
            <Input
              type="number"
              name="precio"
              min={0}
              step="0.01"
              defaultValue={precio}
              required
            />
          </Field>
          <Field label="Observación">
            <Textarea name="observacion" defaultValue={observacion} />
          </Field>
          {editState.error && (
            <p className="text-sm text-red-700">{editState.error}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditar(false)}
            >
              Cerrar
            </Button>
            <Button type="submit" disabled={editPending}>
              {editPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      )}

      {/* Marcar completado */}
      {activo && (
        <form action={estadoAction}>
          <input type="hidden" name="paqueteId" value={paqueteId} />
          <input type="hidden" name="estado" value="COMPLETADO" />
          <Button
            type="submit"
            className="w-full"
            disabled={estadoPending || !todasRegistradas}
            title={
              todasRegistradas
                ? undefined
                : "Registre la asistencia de todas las sesiones primero."
            }
          >
            {estadoPending ? "Procesando…" : "Marcar completado"}
          </Button>
          {!todasRegistradas && (
            <p className="mt-1 text-xs text-slate-400">
              Disponible cuando todas las sesiones tengan asistencia.
            </p>
          )}
          {estadoState.error && (
            <p className="mt-1 text-sm text-red-700">{estadoState.error}</p>
          )}
        </form>
      )}

      {/* Renovar */}
      <form action={renovAction}>
        <input type="hidden" name="paqueteId" value={paqueteId} />
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={renovPending || !todasRegistradas}
          title={
            todasRegistradas
              ? undefined
              : "Disponible cuando todas las sesiones tengan asistencia registrada."
          }
        >
          {renovPending ? "Renovando…" : "Renovar"}
        </Button>
        <p className="mt-1 text-xs text-slate-400">
          {todasRegistradas
            ? "Crea un paquete nuevo idéntico para el mismo paciente."
            : "Solo disponible cuando se completen todas las sesiones del paquete actual."}
        </p>
        {renovState.error && (
          <p className="mt-1 text-sm text-red-700">{renovState.error}</p>
        )}
      </form>

      {/* Anular */}
      {estado !== "ANULADO" && (
        <form action={anulAction}>
          <input type="hidden" name="paqueteId" value={paqueteId} />
          <Button
            type="submit"
            variant="danger"
            className="w-full"
            disabled={anulPending}
          >
            {anulPending ? "Anulando…" : "Anular paquete"}
          </Button>
          {anulState.error && (
            <p className="mt-1 text-sm text-red-700">{anulState.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
