# Icon selector widget – plan (100% front, Iconify direct)

## Objetivo

- Un único control: **input/select con autocompletado** que permita buscar, filtrar por librería y (opcional) por categoría.
- El valor enviado es siempre **`prefijo:icono`** (ej. `heroicons-outline:home`, `bi:house`) en un **input oculto**.
- **100% en el front**: todas las peticiones a Iconify desde el navegador (lista, categorías, SVGs).
- Al seleccionar: se muestra **caja + SVG + nombre** y se guarda `prefijo:icono` en el input oculto.

## Backend (mínimo)

- **Un solo endpoint de “config”**: devuelve qué prefijos y “sets” (librerías) usar, sin listar iconos ni devolver SVGs.
- Respuesta ejemplo:
  ```json
  {
    "iconify_base": "https://api.iconify.design",
    "sets": [
      { "key": "heroicons", "label": "Heroicons", "prefixes": ["heroicons-outline", "heroicons-solid"] },
      { "key": "bootstrap-icons", "label": "Bootstrap Icons", "prefixes": ["bi"] }
    ]
  }
  ```
- El bundle ya tiene `icon_sets` en config y el mapeo set → prefijos (ej. en `IconifyCollectionLoader`). Exponer eso como “config” para el widget.
- Se puede **simplificar o eliminar** (para este flujo): endpoint que devuelve lista de iconos, endpoint batch de SVGs, y uso de Iconify en PHP para el selector.

## Frontend (nuevo widget)

1. **Carga inicial**
   - GET al endpoint de config del bundle → obtiene `iconify_base` y `sets` (cada set: key, label, prefixes).
   - Por cada prefijo en `sets`, GET `{iconify_base}/collection?prefix=X` → lista de nombres + `categories` (si existe).
   - Unificar en una lista de ítems: `{ id: "prefix:name", prefix, name, setKey, category? }`.

2. **UI del control**
   - **Disparador**: input de búsqueda (o botón) que abre un panel. Si hay valor seleccionado, mostrar **SVG + nombre** en el disparador.
   - **Panel**:
     - **Buscador**: input para filtrar por nombre (client-side sobre la lista ya cargada).
     - **Filtro por librería**: tabs o dropdown “Todas | Heroicons | Bootstrap Icons” usando `sets[].label`.
     - **Categorías**: si la API de Iconify devolvió `categories`, los iconos se agrupan por categoría en el panel (sección con título por categoría).
     - **Lista/Grid de iconos**: cada ítem = celda con **SVG + nombre**. SVGs desde Iconify: `GET {iconify_base}/{prefix}.json?icons=name1,name2,...` (en lotes por prefijo para no exceder longitud de URL). Carga bajo demanda o por páginas si hace falta.

3. **Selección**
   - Al hacer clic en un icono: cerrar panel, rellenar el **input oculto** con `prefix:name`, actualizar el disparador para mostrar ese icono (SVG + nombre).
   - El formulario envía el valor `prefix:name` como hasta ahora.

4. **Peticiones 100% a Iconify**
   - Lista + categorías: `GET api.iconify.design/collection?prefix=X` (una por prefijo).
   - Datos de iconos (SVG): `GET api.iconify.design/{prefix}.json?icons=...` (una o varias por prefijo, en batch).

## Resumen de cambios

| Área | Acción |
|------|--------|
| Backend | Nuevo endpoint GET “config” (sets + prefijos + iconify_base). Opcional: dejar de usar Iconify en PHP para el selector; simplificar o quitar endpoint de lista y batch SVG para este modo. |
| Form / Twig | Un solo bloque de widget: input oculto + disparador (buscador/selector) + contenedor del panel. Pasar URL de config (y placeholders si aplica). |
| Front (TS) | Nuevo flujo: cargar config → cargar collections desde Iconify → búsqueda + filtro por librería + (opcional) categorías → grid con SVGs desde Iconify → al elegir, escribir `prefijo:icono` en el input oculto y mostrar SVG + nombre. |
| Compatibilidad | Se puede mantener el modo antiguo (lista + SVG desde nuestro backend) detrás de una opción, o migrar todo al nuevo flujo según preferencia. |

## Valor final

- Siempre **un único string** en un **input oculto**: `prefijo:icono` (ej. `bi:house`, `heroicons-outline:home`).
- Opción de mostrar en UI: **selector con icono + nombre** (disparador que muestra el icono elegido y su nombre).
