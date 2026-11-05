# Evaluación heurística (Nielsen)

Revisión del frontend con las 10 heurísticas de usabilidad de Jakob Nielsen. Cada hallazgo indica la pantalla, la gravedad (0 a 4, escala de Nielsen) y el cambio aplicado.

Gravedad: **4** catástrofe, **3** problema mayor, **2** menor, **1** cosmético.

## Resumen

| # | Heurística | Hallazgos | Ya cumplía |
| --- | --- | --- | --- |
| 1 | Visibilidad del estado del sistema | 5 | Esqueletos de carga, botones con indicador de envío, sello con segmentos |
| 2 | Coincidencia con el mundo real | 2 | Lenguaje llano, montos en pesos, fechas en español |
| 3 | Control y libertad | 6 | Cancelar en formularios de reporte y de mentor, casillas reversibles |
| 4 | Consistencia y estándares | 3 | Mismo sistema de botones y avisos en toda la app |
| 5 | Prevención de errores | 6 | Bloqueo de solicitudes sin 4 revisiones, aviso de pago antes de solicitar |
| 6 | Reconocer antes que recordar | 4 | Filtros guardados en la URL, navegación visible por rol |
| 7 | Flexibilidad y eficiencia | 3 | Cuentas de demostración de un clic, enlaces directos desde notificaciones |
| 8 | Diseño estético y minimalista | 1 | Rediseño "Señalética" con jerarquía clara |
| 9 | Reconocer, diagnosticar y recuperarse de errores | 4 | Mensajes del servidor en español y sin detalles internos |
| 10 | Ayuda y documentación | 3 | Página de Ayuda y guías |

## Hallazgos y cambios

### 1. Visibilidad del estado del sistema

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 3 | Aprobar, rechazar o archivar en Administración, y cambiar el estado de una solicitud, no confirmaban nada: el elemento simplemente desaparecía. | Aviso flotante (`Toast`) que dice qué pasó: "Vivienda aprobada", "Solicitud rechazada". |
| 2 | Guardar el perfil de mentor o publicar una reseña no daba ninguna señal. | Aviso flotante al terminar. |
| 2 | La búsqueda mostraba "0 viviendas" mientras cargaba. | Muestra "Buscando…" hasta tener resultados. |
| 2 | La pestaña del navegador decía siempre lo mismo. | Cada pantalla pone su título: "Mis solicitudes · Aterriza". |
| 2 | Al editar una vivienda no se sabía si había cambios sin guardar. | Indicador "Cambios sin guardar" y aviso del navegador si sales. |

### 2. Coincidencia entre el sistema y el mundo real

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 2 | La bitácora de Administración mostraba códigos internos (`listing.decided`, `booking`). | Se traducen a frases: "Decidió sobre una vivienda", "Solicitud". |
| 1 | Administración hablaba de "criterios" y la ficha de "revisiones" para lo mismo. | Se usa "revisiones" en todas partes. |

### 3. Control y libertad del usuario

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 3 | Rechazar o cancelar una solicitud se ejecutaba con un solo clic. | Confirmación en dos pasos en el mismo botón (`ConfirmButton`). |
| 3 | Archivar una vivienda o quitar una foto, igual. | Confirmación en dos pasos. |
| 3 | En Administración, archivar, rechazar y confirmar reportes, igual. | Confirmación en dos pasos. |
| 2 | El formulario para solicitar vivienda no tenía forma de cerrarse. | Botón "Cancelar". |
| 2 | Las notificaciones no se cerraban con Escape ni al hacer clic fuera. | Se cierran con ambos y el foco regresa a la campana. |
| 2 | La ficha de una vivienda no tenía regreso a la búsqueda con los filtros que traías. | Enlace "Volver a resultados" que conserva los filtros. Mismo patrón en solicitudes, guías y edición de vivienda. |

### 4. Consistencia y estándares

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 2 | En una solicitud, "Cancelar" cerraba el formulario de videollamada y "Cancelar solicitud" cancelaba la solicitud, uno junto al otro. | El primero dice "No agendar todavía". |
| 1 | Cerrar sesión en todos los dispositivos no pedía confirmación pero eliminar cuenta sí. | Ambas acciones de alcance amplio piden confirmación. |
| 1 | Algunos errores de carga se podían reintentar y otros no. | Todas las cargas fallidas ofrecen "Reintentar". |

### 5. Prevención de errores

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 3 | Se podía pedir una vivienda con fecha de salida anterior a la de entrada. | Fechas con mínimo y validación antes de enviar. |
| 3 | En Administración se podía pulsar "Aprobar" con menos de 2 revisiones marcadas, y el servidor lo rechazaba. | El botón se desactiva y dice cuántas faltan. |
| 2 | La matrícula solo se validaba en el servidor. | Formato `A01234567` validado al escribir, con ejemplo. |
| 2 | Las contraseñas no se podían ver antes de enviar. | Botón "Mostrar" en todos los campos de contraseña. |
| 2 | Idiomas y temas del mentor se escribían separados por comas, con errores de tecleo. | Opciones para marcar. |
| 1 | Los destructivos ya usaban color rojo, pero sin segundo paso. | Ver heurística 3. |

### 6. Reconocer antes que recordar

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 2 | Con el panel de filtros cerrado no se veía qué filtros estaban activos. | Etiquetas de filtros activos, cada una con su botón para quitarla, y "Quitar todos". |
| 2 | Temas e idiomas del mentor había que recordarlos. | Opciones visibles (ver heurística 5). |
| 1 | El enlace para volver a la guía estaba solo al final. | Arriba, junto al título. |
| 1 | La página 404 solo ofrecía viviendas. | Ofrece inicio, viviendas y ayuda. |

### 7. Flexibilidad y eficiencia de uso

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 2 | Ayuda solo estaba en el pie de página. | Acceso directo en la barra superior. |
| 1 | Las preguntas de Ayuda no se podían enlazar. | Cada pregunta tiene dirección propia (`/ayuda#sello`) y se abre sola. |
| 1 | Quitar un filtro obligaba a abrir el panel. | Etiquetas de filtros activos (ver heurística 6). |

### 8. Diseño estético y minimalista

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 1 | Sin hallazgos mayores tras el rediseño. Los avisos nuevos son flotantes y desaparecen solos para no cargar la pantalla. | — |

### 9. Ayudar a reconocer, diagnosticar y recuperarse de errores

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 3 | Si la sesión expiraba, las acciones fallaban con un mensaje sin salida. | El aviso dice que la sesión terminó y lleva a "Entrar" de regreso a la misma pantalla. |
| 2 | Sin conexión o con el servidor caído, no había forma de reintentar sin recargar. | Botón "Reintentar" en el aviso. |
| 2 | Si una pantalla fallaba, la única salida era ir al inicio. | "Volver a cargar" además de "Ir al inicio". |
| 1 | Las fechas inválidas solo las rechazaba el servidor. | Mensaje junto al campo. |

### 10. Ayuda y documentación

| Gravedad | Hallazgo | Cambio |
| --- | --- | --- |
| 2 | El sello no tenía explicación donde aparece. | Enlace "¿Qué significa?" junto al sello de la ficha, hacia la pregunta exacta de Ayuda. |
| 2 | Los estados de una solicitud no se explicaban. | Pregunta nueva en Ayuda y enlace desde la solicitud. |
| 1 | El costo real no decía de dónde salen las estimaciones. | Pregunta nueva en Ayuda, enlazada desde la ficha. |

## Componentes nuevos

- `Toast` (`lib/toast.tsx`): aviso flotante con `aria-live`, se va solo a los 5 segundos.
- `ConfirmButton` (`design/ui.tsx`): el primer clic pide confirmación en el mismo lugar; Escape o "No" lo regresan.
- `BackLink` (`design/ui.tsx`): regreso con la ubicación previa cuando existe.
- `PasswordInput` (`design/ui.tsx`): contraseña con "Mostrar" y "Ocultar".
- `usePageTitle` (`design/ui.tsx`): título de la pestaña por pantalla. `Page` lo aplica solo.
- `ErrorNote` con `onRetry` y salida a "Entrar" cuando la sesión expiró.

## Cómo se verificó

- Recorrido completo en Chrome (`npm run test:e2e`): pasa completo con los cambios.
- 145 pruebas de la API, `typecheck` y `lint`: sin errores.
- Revisión manual en escritorio: filtros activos, "Volver a resultados" con filtros, título de pestaña, "Mostrar" contraseña, Aprobar desactivado con conteo, confirmación de Archivar con Escape, aviso flotante, bitácora en frases y Ayuda con `#pregunta`.
- **Pendiente:** revisión manual a 390 px de ancho.
