"use client";

import { useRef, useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { Button, ButtonLink, Card, Input, Select } from "@/components/ui";
import {
  guardarPlantilla,
  restaurarPlantillaBase,
  subirImagenFicha,
  type FormState,
} from "../../actions";
import { NOMBRES, PREFIJO_NUEVO, type TipoNuevo } from "@/lib/fichas/editor";
import { BASES, type BaseId } from "@/lib/fichas/base";
import { tituloSeccion } from "@/lib/fichas/numeracion";
import type { Campo, Grupo, Plantilla, TipoFicha } from "@/lib/fichas/tipos";
import {
  IMAGEN_POR_DEFECTO,
  IMAGEN_TIPOS,
  IMAGENES_BASE,
  esImagenBase,
  urlImagen,
  type Leyenda,
} from "@/lib/fichas/mapa";
import { LeyendaMapa } from "@/components/ficha/mapa-vista";

const TIPO_CAMPO_LABEL: Record<Campo["tipo"], string> = {
  texto: "Texto corto",
  parrafo: "Texto largo",
  casilla: "Casilla",
  opciones: "Opciones",
  tabla: "Tabla",
  checklist: "Lista evaluable",
  mapa: "Marcas sobre imagen",
};

/* ── Modelo del formulario ────────────────────────────── */

/** `k`: clave estable de la fila en React (un ítem nuevo aún no tiene id). */
type Item = { id: string; label: string; k: string };

// El estado de estructura vive aquí, FUERA del <form>: tras un error,
// useFormReintento remonta el form y repone los textos por posición, así que
// las filas tienen que seguir siendo las mismas.
type CampoUI = {
  clave: string;
  tipo: Campo["tipo"];
  label: string;
  nuevo: boolean;
  multiple: boolean;
  items: Item[];
  /** Solo mapas: imagen de fondo y qué significa cada color. */
  imagen: string;
  leyenda: Leyenda;
};

type GrupoUI = {
  clave: string;
  titulo: string | null;
  visibleSi?: Grupo["visibleSi"];
  campos: CampoUI[];
};

type SeccionUI = {
  clave: string;
  titulo: string;
  nueva: boolean;
  escalaId: string | null;
  grupos: GrupoUI[];
};

function modeloDe(plantilla: Plantilla): SeccionUI[] {
  return plantilla.secciones.map((s) => ({
    clave: s.id,
    titulo: s.titulo,
    nueva: false,
    escalaId: s.escalaId ?? null,
    grupos: s.grupos.map((g) => ({
      clave: g.id,
      titulo: g.titulo ?? null,
      visibleSi: g.visibleSi,
      campos: g.campos.map((c) => ({
        clave: c.id,
        tipo: c.tipo,
        label: c.label ?? "",
        nuevo: false,
        multiple: false,
        items: c.tipo === "checklist" ? c.items.map((i) => ({ ...i, k: i.id })) : [],
        imagen: c.tipo === "mapa" ? c.imagenId : "",
        leyenda: c.tipo === "mapa" ? c.leyenda : [],
      })),
    })),
  }));
}

/** Mueve el elemento `i` una posición (dir = -1 sube, +1 baja). */
function mover<T>(lista: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

/* ── Piezas ───────────────────────────────────────────── */

const botonChico =
  "shrink-0 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent";

function Flechas({
  i,
  total,
  onMover,
  que,
}: {
  i: number;
  total: number;
  onMover: (dir: -1 | 1) => void;
  que: string;
}) {
  return (
    <>
      <button
        type="button"
        className={botonChico}
        disabled={i === 0}
        onClick={() => onMover(-1)}
        aria-label={`Subir ${que}`}
        title="Subir"
      >
        ↑
      </button>
      <button
        type="button"
        className={botonChico}
        disabled={i === total - 1}
        onClick={() => onMover(1)}
        aria-label={`Bajar ${que}`}
        title="Bajar"
      >
        ↓
      </button>
    </>
  );
}

/** Ítems de un checklist: se pueden renombrar, agregar y quitar. */
function ItemsDelCampo({
  campoClave,
  filas,
  setFilas,
  nuevaClave,
}: {
  campoClave: string;
  filas: Item[];
  setFilas: (filas: Item[]) => void;
  nuevaClave: () => string;
}) {
  return (
    <div className="mt-2 space-y-2">
      {filas.map((item, i) => (
        <div key={item.k} className="flex items-center gap-2">
          <input type="hidden" name={NOMBRES.itemCampo} value={campoClave} />
          <input type="hidden" name={NOMBRES.itemId} value={item.id} />
          <Input
            name={NOMBRES.itemLabel}
            defaultValue={item.label}
            aria-label={`Ítem ${i + 1}`}
            className="py-1.5"
          />
          <button
            type="button"
            onClick={() => setFilas(filas.filter((_, j) => j !== i))}
            className="shrink-0 rounded px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
            aria-label={`Quitar ítem ${i + 1}`}
          >
            Quitar
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => setFilas([...filas, { id: "", label: "", k: nuevaClave() }])}
      >
        Agregar ítem
      </Button>
    </div>
  );
}

/**
 * Una fila de campo. Emite SIEMPRE las mismas entradas paralelas (id, texto,
 * grupo, tipo, opciones, múltiple, escala), vacías si no aplican: el servidor
 * las alinea por índice.
 */
function FilaCampo({
  campo,
  grupoClave,
  escalas,
  pideEscala,
  i,
  total,
  onMover,
  onQuitar,
  onCambiar,
  nuevaClave,
  imagenes,
  onSubida,
}: {
  campo: CampoUI;
  grupoClave: string;
  escalas: Plantilla["escalas"];
  pideEscala: boolean;
  i: number;
  total: number;
  onMover: (dir: -1 | 1) => void;
  onQuitar: () => void;
  onCambiar: (cambio: Partial<CampoUI>) => void;
  nuevaClave: () => string;
  /** Imágenes subidas por el centro que se pueden elegir. */
  imagenes: string[];
  onSubida: (id: string) => void;
}) {
  const { multiple } = campo;
  const esLista = campo.tipo === "checklist";
  const esMapa = campo.tipo === "mapa";
  // La leyenda de un mapa nuevo viaja en la misma entrada que las opciones.
  const opcionesNuevas = campo.nuevo && (campo.tipo === "opciones" || esMapa);
  const escalaNueva = campo.nuevo && esLista && pideEscala;

  return (
    <div
      className={
        campo.nuevo ? "rounded-lg border border-dashed border-sky-300 bg-sky-50/40 p-2" : ""
      }
    >
      <input type="hidden" name={NOMBRES.campoId} value={campo.clave} />
      <input type="hidden" name={NOMBRES.campoGrupo} value={grupoClave} />
      <input type="hidden" name={NOMBRES.campoTipo} value={campo.nuevo ? campo.tipo : ""} />
      <input type="hidden" name={NOMBRES.campoMultiple} value={multiple ? "1" : ""} />
      {!opcionesNuevas && <input type="hidden" name={NOMBRES.campoOpciones} value="" />}
      {!escalaNueva && <input type="hidden" name={NOMBRES.campoEscala} value="" />}
      <input type="hidden" name={NOMBRES.campoImagen} value={esMapa ? campo.imagen : ""} />

      <div className="flex items-center gap-2">
        <Input
          name={NOMBRES.campoLabel}
          defaultValue={campo.label}
          placeholder={
            esLista
              ? "(lista sin título)"
              : campo.nuevo
                ? "Escribe la pregunta o el dato"
                : ""
          }
          aria-label={`Texto del campo ${i + 1}`}
          className="py-1.5"
        />
        <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">
          {TIPO_CAMPO_LABEL[campo.tipo]}
          {campo.nuevo && " · nuevo"}
        </span>
        <Flechas i={i} total={total} onMover={onMover} que="campo" />
        <button
          type="button"
          onClick={onQuitar}
          className="shrink-0 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          aria-label={`Quitar campo ${i + 1}`}
        >
          Quitar
        </button>
      </div>

      {esMapa && (
        <ImagenDelMapa
          imagen={campo.imagen}
          imagenes={imagenes}
          onElegir={(imagen) => onCambiar({ imagen })}
          onSubida={(id) => {
            onSubida(id);
            onCambiar({ imagen: id });
          }}
        />
      )}

      {esMapa && !campo.nuevo && (
        <div className="mt-2">
          <LeyendaMapa leyenda={campo.leyenda} />
        </div>
      )}

      {esMapa && campo.nuevo && (
        <label className="mt-2 block text-sm text-slate-600">
          Qué se marca, uno por línea (cada uno tendrá un color)
          <textarea
            name={NOMBRES.campoOpciones}
            rows={2}
            placeholder={"Dolor\nHormigueo o adormecimiento"}
            aria-label="Leyenda de colores, una por línea"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>
      )}

      {opcionesNuevas && !esMapa && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <textarea
            name={NOMBRES.campoOpciones}
            rows={3}
            placeholder={"Una opción por línea\nSí\nNo"}
            aria-label="Opciones, una por línea"
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={multiple}
              onChange={(e) => onCambiar({ multiple: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Permite marcar varias
          </label>
        </div>
      )}

      {escalaNueva && (
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          Escala
          <Select
            name={NOMBRES.campoEscala}
            defaultValue={escalas[0]?.id ?? ""}
            className="max-w-xs py-1.5"
          >
            {escalas.map((e) => (
              <option key={e.id} value={e.id}>
                {/* "EVA: 0 a 10" se lee mejor que once valores seguidos. */}
                {e.valores.length > 4
                  ? `${e.id}: ${e.valores[0]} a ${e.valores[e.valores.length - 1]}`
                  : `${e.id}: ${e.valores.map((v) => e.labels[v] ?? v).join(" / ")}`}
              </option>
            ))}
          </Select>
        </label>
      )}

      {esLista && (
        <ItemsDelCampo
          campoClave={campo.clave}
          filas={campo.items}
          setFilas={(items) => onCambiar({ items })}
          nuevaClave={nuevaClave}
        />
      )}
    </div>
  );
}

/** Imagen de fondo de un mapa: una de fábrica, una ya subida o subir otra. */
function ImagenDelMapa({
  imagen,
  imagenes,
  onElegir,
  onSubida,
}: {
  imagen: string;
  imagenes: string[];
  onElegir: (id: string) => void;
  onSubida: (id: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    const fd = new FormData();
    fd.append("imagen", archivo);
    const r = await subirImagenFicha(fd);
    setSubiendo(false);
    if ("error" in r) setError(r.error);
    else onSubida(r.id);
  }

  return (
    <div className="mt-2 flex flex-wrap items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- vista previa de imagen privada */}
      <img
        src={urlImagen(imagen)}
        alt="Imagen de fondo"
        className="h-24 w-auto rounded border border-slate-200 bg-white"
      />
      <div className="space-y-2 text-sm text-slate-600">
        <label className="flex items-center gap-2">
          Imagen
          <div className="w-60">
            <Select value={imagen} onChange={(e) => onElegir(e.target.value)} className="py-1.5">
              {Object.entries(IMAGENES_BASE).map(([id, b]) => (
                <option key={id} value={id}>
                  {b.label}
                </option>
              ))}
              {imagenes.map((id, k) => (
                <option key={id} value={id}>
                  Imagen subida {k + 1}
                </option>
              ))}
            </Select>
          </div>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">
            {subiendo ? "Subiendo…" : "o sube otra (PNG, JPG o WebP, hasta 1 MB):"}
          </span>
          {/* Sin `name`: el archivo se sube aparte y en el formulario solo viaja su id. */}
          <input
            type="file"
            accept={IMAGEN_TIPOS.join(",")}
            disabled={subiendo}
            onChange={(e) => subir(e.target.files?.[0])}
            className="mt-1 block text-xs"
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-xs text-slate-400">
          Cambiar la imagen no mueve lo ya marcado: cada ficha conserva la imagen sobre la
          que se dibujó.
        </p>
      </div>
    </div>
  );
}

/** Selector de tipo + botón para agregar un campo al final de un grupo. */
function AgregarCampo({
  tipos,
  onAgregar,
}: {
  tipos: TipoNuevo[];
  onAgregar: (tipo: TipoNuevo) => void;
}) {
  const [tipo, setTipo] = useState<TipoNuevo>(tipos[0]);
  return (
    <div className="mt-3 flex items-center gap-2">
      {tipos.length > 1 && (
        <div className="w-44 shrink-0">
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoNuevo)}
            aria-label="Tipo del campo nuevo"
            className="py-1.5"
          >
            {tipos.map((t) => (
              <option key={t} value={t}>
                {TIPO_CAMPO_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Button type="button" variant="secondary" onClick={() => onAgregar(tipo)}>
        {tipos.length > 1 ? "Agregar campo" : `Agregar ${TIPO_CAMPO_LABEL[tipo].toLowerCase()}`}
      </Button>
    </div>
  );
}

/* ── Formulario ───────────────────────────────────────── */

export function PlantillaForm({
  tipo,
  plantilla,
}: {
  tipo: TipoFicha;
  plantilla: Plantilla;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(guardarPlantilla, undefined);

  const [secciones, setSecciones] = useState(() => modeloDe(plantilla));
  // Imágenes subidas que se pueden elegir: las que ya usa la plantilla y las
  // que se suban en esta edición.
  const [subidas, setSubidas] = useState<string[]>(() => [
    ...new Set(
      plantilla.secciones.flatMap((s) =>
        s.grupos.flatMap((g) =>
          g.campos.flatMap((c) => (c.tipo === "mapa" && !esImagenBase(c.imagenId) ? [c.imagenId] : [])),
        ),
      ),
    ),
  ]);
  const contador = useRef(0);
  const clave = (letra: string) => `${PREFIJO_NUEVO}${letra}${++contador.current}`;

  // En el informe solo cuentan las listas evaluables (es lo que se califica y
  // grafica); sin escalas en la plantilla no se puede crear una lista.
  const hayEscalas = plantilla.escalas.length > 0;
  const tiposNuevos: TipoNuevo[] =
    tipo === "INFORME"
      ? ["checklist"]
      : [
          "texto",
          "parrafo",
          "casilla",
          "opciones",
          ...(hayEscalas ? (["checklist"] as const) : []),
          "mapa",
        ];
  // Las secciones nuevas de un informe toman la escala de la plantilla.
  const seccionesAbiertas = plantilla.secciones.some((s) => s.itemsAbiertos);

  const etiquetaDe = new Map(
    plantilla.secciones.flatMap((s) =>
      s.grupos.flatMap((g) => g.campos.map((c) => [c.id, c.label ?? c.id] as const)),
    ),
  );

  const editarSeccion = (si: number, cambio: (s: SeccionUI) => SeccionUI) =>
    setSecciones((prev) => prev.map((s, k) => (k === si ? cambio(s) : s)));
  const editarGrupo = (si: number, gi: number, cambio: (g: GrupoUI) => GrupoUI) =>
    editarSeccion(si, (s) => ({ ...s, grupos: s.grupos.map((g, k) => (k === gi ? cambio(g) : g)) }));

  return (
    <div className="space-y-6">
      <form key={formKey} {...formProps} className="space-y-6">
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name={NOMBRES.estructuraCompleta} value="1" />

        {state?.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        {secciones.map((seccion, si) => {
          const pideEscala = !seccion.escalaId && !(seccion.nueva && seccionesAbiertas);
          return (
            <Card key={seccion.clave} className={seccion.nueva ? "border-sky-300" : undefined}>
              <input type="hidden" name={NOMBRES.seccionId} value={seccion.clave} />
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Sección{" "}
                  {plantilla.numerarSecciones ? tituloSeccion("", si, true).trim() : si + 1}
                  {seccion.nueva && " · nueva"}
                </span>
                <div className="flex items-center gap-1">
                  <Flechas
                    i={si}
                    total={secciones.length}
                    onMover={(dir) => setSecciones((prev) => mover(prev, si, dir))}
                    que="sección"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        seccion.nueva ||
                        window.confirm(
                          `¿Quitar la sección «${seccion.titulo}»? Lo ya registrado en las fichas no se borra.`,
                        )
                      ) {
                        setSecciones((prev) => prev.filter((_, k) => k !== si));
                      }
                    }}
                    className="shrink-0 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                  >
                    Quitar sección
                  </button>
                </div>
              </div>
              <Input
                name={NOMBRES.seccionTitulo}
                defaultValue={seccion.titulo}
                placeholder={seccion.nueva ? "Título de la sección" : ""}
                aria-label={`Título de la sección ${si + 1}`}
                className="font-medium"
              />

              <div className="mt-4 space-y-4">
                {seccion.grupos.map((grupo, gi) => (
                  <div key={grupo.clave} className="rounded-lg border border-slate-200 p-3">
                    <input type="hidden" name={NOMBRES.grupoId} value={grupo.clave} />
                    <input type="hidden" name={NOMBRES.grupoSeccion} value={seccion.clave} />
                    {grupo.titulo && (
                      <p className="mb-2 text-sm font-medium text-slate-600">{grupo.titulo}</p>
                    )}
                    {grupo.visibleSi && (
                      <p className="mb-2 text-xs text-slate-400">
                        Se muestra solo si «
                        {etiquetaDe.get(grupo.visibleSi.campoId) ?? grupo.visibleSi.campoId}» es{" "}
                        {grupo.visibleSi.valores.join(" o ")}.
                      </p>
                    )}

                    <div className="space-y-3">
                      {grupo.campos.map((campo, ci) => (
                        <FilaCampo
                          key={campo.clave}
                          campo={campo}
                          grupoClave={grupo.clave}
                          escalas={plantilla.escalas}
                          pideEscala={pideEscala}
                          i={ci}
                          total={grupo.campos.length}
                          onMover={(dir) =>
                            editarGrupo(si, gi, (g) => ({ ...g, campos: mover(g.campos, ci, dir) }))
                          }
                          onQuitar={() =>
                            editarGrupo(si, gi, (g) => ({
                              ...g,
                              campos: g.campos.filter((_, k) => k !== ci),
                            }))
                          }
                          onCambiar={(cambio) =>
                            editarGrupo(si, gi, (g) => ({
                              ...g,
                              campos: g.campos.map((c, k) => (k === ci ? { ...c, ...cambio } : c)),
                            }))
                          }
                          nuevaClave={() => clave("i")}
                          imagenes={subidas}
                          onSubida={(id) => setSubidas((prev) => [...prev, id])}
                        />
                      ))}
                      {grupo.campos.length === 0 && (
                        <p className="text-sm text-slate-400">
                          Sin campos. Agrega al menos uno o la sección no se guardará.
                        </p>
                      )}
                    </div>

                    <AgregarCampo
                      tipos={tiposNuevos}
                      onAgregar={(t) =>
                        editarGrupo(si, gi, (g) => ({
                          ...g,
                          campos: [
                            ...g.campos,
                            {
                              clave: clave("c"),
                              tipo: t,
                              label: "",
                              nuevo: true,
                              multiple: false,
                              // Una lista nueva arranca con una fila para su primer ítem.
                              items: t === "checklist" ? [{ id: "", label: "", k: clave("i") }] : [],
                              imagen: t === "mapa" ? IMAGEN_POR_DEFECTO : "",
                              leyenda: [],
                            },
                          ],
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}

        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setSecciones((prev) => [
              ...prev,
              {
                clave: clave("s"),
                titulo: "",
                nueva: true,
                escalaId: null,
                grupos: [{ clave: clave("g"), titulo: null, campos: [] }],
              },
            ])
          }
        >
          Agregar sección
        </Button>

        <div className="flex items-center justify-end gap-3">
          <ButtonLink href="/configuracion/fichas" variant="secondary">
            Cancelar
          </ButtonLink>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar plantilla"}
          </Button>
        </div>
      </form>

      <Card className="border-amber-200 bg-amber-50">
        <h2 className="text-sm font-semibold text-amber-900">Restaurar plantilla base</h2>
        <p className="mt-1 text-xs text-amber-800">
          Reemplaza esta plantilla por la prearmada del rubro elegido. Se descarta lo
          que hayas editado; las fichas ya registradas no cambian.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(BASES) as BaseId[]).map((id) => (
            <RestaurarForm key={id} tipo={tipo} base={id} label={BASES[id].label} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function RestaurarForm({
  tipo,
  base,
  label,
}: {
  tipo: TipoFicha;
  base: BaseId;
  label: string;
}) {
  const { pendiente, formProps, formKey } = useFormReintento<FormState>(
    restaurarPlantillaBase,
    undefined,
  );

  return (
    <form key={formKey} {...formProps}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="base" value={base} />
      <Button type="submit" variant="secondary" disabled={pendiente}>
        {pendiente ? "Restaurando…" : label}
      </Button>
    </form>
  );
}
