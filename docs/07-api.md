# 07 · API y endpoints

Base: `/api/v1`. JSON salvo fotos (`multipart/form-data`) y eventos (SSE).

## Convenciones

**Autenticación:** cookie de sesión `HttpOnly`. Toda mutación requiere además el encabezado `X-Requested-With: aterriza` y un `Origin` permitido (defensa anti-CSRF).

**Errores** con formato uniforme:

```json
{ "error": { "code": "booking_not_allowed", "message": "No se puede solicitar", "details": ["La vivienda no está verificada"], "requestId": "req-1a" } }
```

| Estado | Significado |
| --- | --- |
| 400 | Datos inválidos |
| 401 | Sin sesión |
| 403 | Sin permiso |
| 404 | No existe **o no tienes acceso** (no se revela cuál) |
| 409 | Conflicto de estado o duplicado |
| 422 | Regla de negocio incumplida |
| 429 | Demasiadas solicitudes |

**Paginación:** `?page=1&pageSize=12` → `{ items, total, page, pageSize }`.

**Acceso:** 🌐 público · 🔑 con sesión · 🎓 estudiante validado · 🧭 mentor · 🏠 arrendador · 🛡️ admin.

## Identidad

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/auth/register` | 🌐 | Crea cuenta y envía código. Misma respuesta si el correo ya existe |
| POST | `/auth/verify-email` | 🌐 | `{email, code}`; inicia sesión |
| POST | `/auth/resend-code` | 🌐 | Reenvía código |
| POST | `/auth/login` | 🌐 | `{email, password}` |
| POST | `/auth/logout` | 🔑 | Cierra esta sesión |
| POST | `/auth/logout-all` | 🔑 | Cierra todas |
| POST | `/auth/forgot-password` | 🌐 | Respuesta idéntica exista o no |
| POST | `/auth/reset-password` | 🌐 | `{email, code, password}`; revoca sesiones |
| GET | `/me` | 🔑 | Perfil |
| PATCH | `/me` | 🔑 | Nombre, país, teléfono |
| GET | `/me/export` | 🔑 | Mis datos en JSON |
| DELETE | `/me` | 🔑 | Anonimiza; requiere contraseña |
| POST | `/me/student-verification` | 🔑 | `{matricula}`: automático o a revisión manual |

## Viviendas

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/zones` | 🌐 | Zonas con mediana y conteo |
| GET | `/listings` | 🌐 | Filtros: `q, zone, kind, maxRent, maxMinutes, furnished, utilities, semester, verifiedOnly, sort, page, pageSize` |
| GET | `/listings/:id` | 🌐 | Ficha + sello + alerta + costos + reseñas + mentores. Dirección solo con solicitud aceptada o si eres dueño |
| GET | `/me/listings` | 🏠 | Mis viviendas en cualquier estado |
| POST | `/listings` | 🏠 | Crear borrador |
| PATCH | `/listings/:id` | 🏠 dueño | Editar; si estaba publicada vuelve a revisión al cambiar datos clave |
| POST | `/listings/:id/submit` | 🏠 dueño | Enviar a revisión |
| POST | `/listings/:id/archive` | 🏠 dueño | Archivar |
| POST | `/listings/:id/photos` | 🏠 dueño | JPEG/PNG/WebP hasta 5 MB; revisa el tipo real del archivo |
| DELETE | `/listings/:id/photos/:photoId` | 🏠 dueño | Borrar foto |

## Solicitudes

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/bookings` | 🎓 | `{listingId, startDate, endDate, message, fraudNoticeAck}` |
| GET | `/bookings` | 🔑 | Mías (estudiante) o recibidas (arrendador) |
| GET | `/bookings/:id` | 🔑 parte | Detalle + línea de tiempo |
| POST | `/bookings/:id/transitions` | 🔑 parte | `{action, tourAt?, note?}`; `action`: `schedule_tour, accept, reject, cancel, confirm, complete` |
| PUT | `/bookings/:id/steps/:step` | 🔑 estudiante de la solicitud | `{done}`; lista para mudarte |

## Confianza

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/listings/:id/reviews` | 🎓 con estancia | Crea reseña |
| POST | `/listings/:id/reports` | 🔑 | Reporta; una vez por persona |

## Comunidad

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/mentors` | 🌐 | Filtros: `kind, language, topic, zone` |
| GET | `/mentors/:id` | 🌐 | Perfil público |
| PUT | `/me/mentor-profile` | 🧭 | Crear o editar; requiere aprobación |
| POST | `/mentors/:id/connect` | 🎓 | `{intro}`; abre conversación pendiente |
| GET | `/conversations` | 🔑 | Mis conversaciones |
| GET | `/conversations/:id/messages` | 🔑 parte | Historial con `?before=` |
| POST | `/conversations/:id/messages` | 🔑 parte | Envía; detecta señales de estafa |
| POST | `/conversations/:id/respond` | 🧭 parte | `{accept: boolean}` |
| GET | `/events` | 🔑 | SSE: `message`, `notification`, `conversation` |

## Planeación

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| POST | `/budget/estimate` | 🌐 | `{listingId?, monthlyRent?, depositMonths?, arrivalMonth, usesAc, utilitiesIncluded?, minutesTransit?, international}` |
| GET | `/guides` | 🌐 | Guías por categoría |
| GET | `/guides/:slug` | 🌐 | Guía |
| GET | `/checklist` | 🔑 | Tareas + avance |
| PUT | `/checklist/:taskId` | 🔑 | `{done}` |

## Notificaciones

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/notifications` | 🔑 | Últimas + cantidad sin leer |
| POST | `/notifications/read-all` | 🔑 | Marcar leídas |

## Administración

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/admin/metrics` | 🛡️ | Contadores |
| GET | `/admin/listings/queue` | 🛡️ | Pendientes y en revisión |
| PUT | `/admin/listings/:id/criteria` | 🛡️ | `{criteria: {...}}` |
| POST | `/admin/listings/:id/decision` | 🛡️ | `{decision: approve\|return\|archive, note}` |
| GET | `/admin/reports` | 🛡️ | Reportes abiertos |
| POST | `/admin/reports/:id/resolve` | 🛡️ | `{decision: dismiss\|uphold}` |
| GET | `/admin/students/pending` | 🛡️ | Validaciones manuales |
| POST | `/admin/students/:id/decision` | 🛡️ | `{approve, note}` |
| GET | `/admin/mentors/pending` | 🛡️ | Perfiles por aprobar |
| POST | `/admin/mentors/:id/decision` | 🛡️ | `{approve}` |
| GET | `/admin/audit` | 🛡️ | Bitácora paginada |

## Sistema

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/health` | 🌐 | Estado y conexión a la base |
| GET | `/config` | 🌐 | `{ demoMode, institutionalDomains, demoPassword? }`; la contraseña solo en modo demo |

## Límites de frecuencia

| Grupo | Límite |
| --- | --- |
| API completa, por IP (no aplica a archivos estáticos) | 1000/min |
| `/auth/login`, `/auth/register`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-code` | 30/min por IP |
| Mensajes, reportes, solicitudes | 120/min por IP |
| Fotos | 20/min por IP |
| Además | Bloqueo de cuenta 15 min tras 5 fallos de inicio de sesión |

Los límites por IP son holgados porque un salón o un campus pueden compartir una sola IP. La protección contra adivinar contraseñas es el bloqueo por cuenta.
