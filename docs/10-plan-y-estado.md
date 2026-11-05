# 10 · Plan iterativo y estado

> **Este archivo es el estado vivo del proyecto.** Se actualiza al terminar cada iteración.

## Iteraciones

| # | Entrega | Estado |
| --- | --- | --- |
| I0 | Documentación: visión, requerimientos, historias, arquitectura, patrones, datos, API, seguridad, UX | ✅ |
| I1 | Base: monorepo, contratos, config, base de datos, migraciones, servidor seguro | ✅ |
| I2 | Dominio y API, datos demo, pruebas | ✅ |
| I3 | Frontend: sistema de diseño, portada, búsqueda, ficha, flujos de cada rol | ✅ |
| I4 | Endurecimiento: revisión de seguridad, CI, Docker, recorrido en navegador | ✅ Lo verificable en local; ver abajo |
| I5 | Referencia AmberStudent: lista para mudarte, ayuda, zonas, cómo funciona | ✅ |
| I6 | Rediseño de interfaz, dirección Señalética: tokens, controles propios, todas las pantallas, fotos modestas | ✅ |
| I7 | Evaluación con las 10 heurísticas de Nielsen y correcciones (`12-heuristicas-nielsen.md`) | ✅ Falta revisar a 390 px |

## Qué está comprobado

- Pruebas de dominio e integración sobre Postgres embebido (`npm test`).
- Recorrido completo en Chrome con el build de producción y CSP activa (`npm run test:e2e`): cuatro roles, chat en vivo, alerta de estafa, subir foto, aprobar, sin errores de consola y sin desbordes en móvil.
- `npm audit` sin vulnerabilidades.

## Qué NO está comprobado

- Conexión real a Supabase. El adaptador `PgDb` ya funciona contra Postgres de red (Neon, en la demo), pero Supabase pide su propia CA.
- `Dockerfile` y GitHub Actions: escritos, nunca ejecutados.
- Lector de pantalla y dispositivos móviles físicos.
- Validación con estudiantes reales.

## Siguientes pasos, en orden

1. Inglés en toda la interfaz (segmento prioritario; AmberStudent también lo confirma).
2. Validar con 8–10 estudiantes (métricas en `01-vision-y-alcance.md`).
3. Sacar el SQL de los servicios a repositorios (deuda técnica, `04-arquitectura.md`).
4. Conectar GitHub, Supabase y un proveedor de correo.
5. Bloqueantes de `08-seguridad.md`.
6. Definir modelo de negocio: quién paga. El Canvas de la Evidencia está vacío.

## Decisiones que esperan al equipo

- Nombre definitivo ("Aterriza" es provisional).
- Quién verifica físicamente las viviendas y a qué costo.
- Cuándo reciben correo y matrícula los estudiantes internacionales.

## Bitácora

| Fecha | Qué pasó |
| --- | --- |
| 2026-11-05 | Demo en Vercel con base compartida de Neon (Marketplace, plan gratuito). Candado de arranque probado con tres instancias simultáneas, sesiones válidas entre instancias, TLS verificado. Chat y avisos con consulta periódica de respaldo; fotos subidas desactivadas en la demo. |
| 2026-11-05 | Contraste revisado con WebAIM: todos los pares funcionales pasan AA (texto) o 3:1 (gráficos). Corregidos la barra de la calculadora y las marcas de "sin leer". Tipografía nueva: Overpass (títulos y cifras) y Atkinson Hyperlegible Next (texto), con escala e interlineado documentados en `09-ux-e-identidad.md`. |
| 2026-11-05 | I7. Avisos flotantes, confirmación en dos pasos para lo que no se deshace, filtros activos visibles, regreso con filtros, errores con salida (reintentar, volver a entrar), ayuda enlazable por pregunta. Recorrido en Chrome y 145 pruebas pasan. |
| 2026-11-05 | La demo en Vercel falla con varias peticiones a la vez: cada instancia tiene su propia base en memoria (sesiones perdidas, IDs distintos). No compartir el enlace hasta usar una base compartida. |
| 2026-11-05 | Repositorio en GitHub. Demo pública para Vercel: base en memoria y contraseña compartida. El primer despliegue real aún no se ha verificado. |
| 2026-11-05 | I6. Corregidos también: acceso a Mensajes y Solicitudes en móvil, botón de solicitar en viviendas no solicitables, pines del mapa que dependían del color y encabezados. |
| 2026-11-04 | I0 a I5. Plugin `security-guidance` instalado a nivel de proyecto. Corregidos, tras verlos en navegador: pantalla en blanco por `scrollTo`, alerta de precio que comparaba cuartos con departamentos, mapa de CARTO que pedía llave y límite de frecuencia que bloqueaba la carga de la página. |
