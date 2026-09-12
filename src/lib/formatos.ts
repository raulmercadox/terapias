// Formatos de los identificadores con los que se inicia sesión.
// Sin "server-only": los usan tanto las acciones como los formularios.

/** Nombre de usuario: único dentro del centro. */
export const USUARIO_RE = /^[a-z0-9._-]{3,30}$/;
export const USUARIO_MSG =
  "El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.";

/** Código de empresa (campo "Empresa" del login). */
export const CODIGO_EMPRESA_RE = /^[a-z0-9-]{3,30}$/;
export const CODIGO_EMPRESA_MSG =
  "El código debe tener de 3 a 30 caracteres: letras minúsculas, números o guiones.";
