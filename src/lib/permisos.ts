import type { PermisoTerapeuta, Rol } from "@prisma/client";

/**
 * Permisos opcionales del rol TERAPEUTA. Lo base (ver su agenda, registrar
 * asistencia, ver la ficha clínica de sus pacientes, hacer evaluaciones e
 * informes y registrar su firma) lo tiene todo terapeuta; esto es lo que el
 * administrador concede solo a los de confianza.
 *
 * Sin `server-only`: lo usan el formulario de usuarios y las pruebas.
 */
export const PERMISOS_TERAPEUTA: {
  valor: PermisoTerapeuta;
  etiqueta: string;
  descripcion: string;
}[] = [
  {
    valor: "CITA_AL_VUELO",
    etiqueta: "Registrar citas al vuelo",
    descripcion:
      "Registro rápido de una cita para sí mismo, hoy y a la hora actual (pacientes que llegan sin cita).",
  },
  {
    valor: "PACIENTE_AL_VUELO",
    etiqueta: "Registrar pacientes nuevos al vuelo",
    descripcion:
      "En el registro rápido, dar de alta a un paciente nuevo con datos mínimos.",
  },
  {
    valor: "MOVER_CITAS",
    etiqueta: "Mover sus citas",
    descripcion: "Cambiar la fecha y la hora de sus citas y sesiones.",
  },
  {
    valor: "CANCELAR_CITAS",
    etiqueta: "Cancelar sus citas",
    descripcion: "Marcar sus citas como canceladas (quedan en el historial).",
  },
  {
    valor: "ELIMINAR_CITAS",
    etiqueta: "Eliminar sus citas",
    descripcion:
      "Borrar sus citas sueltas (no las sesiones de un paquete). No se puede deshacer.",
  },
  {
    valor: "REGISTRAR_COBRO",
    etiqueta: "Registrar cobros",
    descripcion:
      "Registrar el pago de una cita que atendió, sin ver listados ni totales de pagos.",
  },
  {
    valor: "EDITAR_HISTORIA_CLINICA",
    etiqueta: "Editar historia clínica",
    descripcion: "Crear y editar la historia clínica de sus pacientes.",
  },
  {
    valor: "EDITAR_DATOS_PACIENTE",
    etiqueta: "Editar datos del paciente",
    descripcion:
      "Corregir los datos personales y de contacto de sus pacientes.",
  },
  {
    valor: "VER_PACIENTES_SEDE",
    etiqueta: "Ver todos los pacientes de la sede",
    descripcion:
      "Acceder a la ficha clínica de cualquier paciente de su sede, no solo de los que atiende.",
  },
  {
    valor: "VER_AGENDA_SEDE",
    etiqueta: "Ver la agenda de toda la sede",
    descripcion:
      "Consultar (sin modificar) las citas de los demás terapeutas de su sede.",
  },
];

const VALORES = new Set<string>(PERMISOS_TERAPEUTA.map((p) => p.valor));

/** Filtra y deduplica los permisos recibidos de un formulario. */
export function normalizarPermisos(valores: string[]): PermisoTerapeuta[] {
  return [...new Set(valores)].filter((v): v is PermisoTerapeuta =>
    VALORES.has(v),
  );
}

/**
 * ¿Puede hacer esto? Los permisos solo restringen al rol TERAPEUTA: para los
 * demás roles devuelve true y manda la regla que ya tuviera cada módulo.
 */
export function tienePermiso(
  rol: Rol,
  permisos: readonly PermisoTerapeuta[],
  permiso: PermisoTerapeuta,
): boolean {
  return rol !== "TERAPEUTA" || permisos.includes(permiso);
}
