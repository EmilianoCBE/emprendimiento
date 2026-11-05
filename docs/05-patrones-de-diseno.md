# 05 · Principios y patrones de diseño

Cada patrón está aquí porque resuelve un problema concreto del producto. También se indican los que se descartaron.

## Principios SOLID

| Principio | Aplicación |
| --- | --- |
| **S**: responsabilidad única | Rutas solo traducen HTTP; servicios orquestan; repositorios hablan SQL; dominio decide. |
| **O**: abierto/cerrado | Agregar un rubro de costo, una regla de solicitud o un detector de estafa es añadir un elemento a una lista, sin tocar quien la recorre. |
| **L**: sustitución de Liskov | `PgliteDb` y `PgDb` son intercambiables; también `ConsoleMailer` y cualquier `Mailer` real. |
| **I**: segregación de interfaces | Puertos pequeños por rol (`Mailer`, `FileStore`, `Clock`, `EventPublisher`). |
| **D**: inversión de dependencias | Los servicios reciben puertos por constructor; solo `composition.ts` conoce las implementaciones. |

Otros: **DRY** en los contratos compartidos, **KISS** al no usar ORM ni microservicios, **YAGNI** al no construir pagos.

## Patrones creacionales

| Patrón | Dónde | Problema que resuelve |
| --- | --- | --- |
| **Factory Method** | `createDb(config)` devuelve el adaptador PGlite o Postgres | Quien usa la base de datos no debe saber cuál es |
| **Builder** | `SqlWhereBuilder` arma el `WHERE` y sus parámetros | 10 filtros opcionales sin concatenar cadenas a mano; siempre parametrizado |
| **Composition Root** | `composition.ts` | Una sola fábrica de dependencias |
| *Singleton (descartado)* | — | Un estado global dificulta las pruebas. Hay una sola instancia porque la raíz de composición crea una sola |

## Patrones estructurales

| Patrón | Dónde | Problema que resuelve |
| --- | --- | --- |
| **Adapter** | `PgliteDb`, `PgDb`, `ConsoleMailer`, `LocalFileStore` | Librerías externas detrás de un puerto propio |
| **Repository** | `ListingRepository`; pendiente en el resto (ver `04-arquitectura.md`) | Aísla SQL del caso de uso |
| **Facade** | `ListingService.detail()` | Una ficha reúne vivienda, sello, alerta, reseñas y mentores en una sola llamada |
| **Composite** | `CostEstimator` compone `CostComponent` | Sumar rubros independientes y tratarlos como uno solo |
| **Decorator** | `requireRole(...)` y `requireVerifiedStudent` envuelven handlers de ruta | Agregar autorización sin tocar el caso de uso |

## Patrones de comportamiento

| Patrón | Dónde | Problema que resuelve |
| --- | --- | --- |
| **State** (por tabla) | `BOOKING_MACHINE` en `bookings/domain.ts` | Qué acción es válida, para qué rol, en qué estado. Evita `if` dispersos; lo que no está en la tabla no se puede hacer |
| **Strategy** | `PriceAlertPolicy`, `FlagPolicy`, `SORT_SQL` | Umbrales aún sin validar (SUP-01, SUP-02): deben poder cambiarse |
| **Observer** | `EventBus`: `BookingRequested` → notificaciones + SSE | Bookings no debe conocer a notificaciones |
| **Lista de reglas** (variante de Chain of Responsibility) | `BOOKING_RULES`: se evalúan todas y se devuelven todas las razones | La persona sabe de una vez qué le falta |
| **Specification** | `SCAM_DETECTORS` en `trust/domain.ts` | Agregar un criterio sin tocar el evaluador |
| *Command (descartado)* | — | No hay deshacer ni colas; sería ceremonia |
| *Mediator (descartado)* | — | El bus de eventos basta |

## Patrones en el frontend

| Patrón | Dónde |
| --- | --- |
| **Container / Presentational** | Página con datos → componentes de presentación |
| **Custom hooks** | `useSession`, `useLiveEvents` |
| **Provider** | Sesión, Query Client |
| **Render props** | `Field` del sistema de diseño |
| **Route-level code splitting** | Cada página se carga con `lazy` |
| **Protected Route** | `RequireRole` para UX. **La seguridad real está en el servidor** |

## Buenas prácticas

- TypeScript en modo `strict`, sin `any`.
- Errores de negocio con `DomainError` (código + detalle); el manejador HTTP los traduce a una respuesta uniforme.
- Sin secretos en el código ni en el repositorio.
- Un cambio de esquema es una migración nueva: nunca se edita una ya aplicada.
- Las pruebas describen el comportamiento y usan la base de datos real (PGlite), no mocks de SQL.
