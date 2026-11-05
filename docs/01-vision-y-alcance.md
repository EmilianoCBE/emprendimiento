# 01 · Visión y alcance

> Fuente principal: `Evidencia 1 Equipo 1.docx` (EM1012, grupo 613). "Aterriza" es un **nombre provisional**: la Evidencia no define marca y se heredó del prototipo anterior. Para cambiarlo, ver `apps/web/src/config/brand.ts`.

## 1. Problema

Los estudiantes foráneos y de intercambio del Tec de Monterrey desconocen el lugar al que se mudan, y eso les impide resolver con seguridad y a tiempo su vivienda, su presupuesto y su vida diaria durante la planeación y las primeras semanas de su estancia.

El hallazgo central de las entrevistas: **el problema no es la falta de información, sino la falta de información confiable, organizada y disponible cuando se necesita.**

## 2. Propuesta

Web app que combina **verificación y comunidad**, con el catálogo en segundo plano (conclusión de la Evidencia):

| Pilar | Qué resuelve | Evidencia |
| --- | --- | --- |
| Vivienda verificada | Miedo a transferir dinero sin comprobar nada | "Lo más estresante es la desconfianza de transferir dinero a distancia…" |
| Red entre pares (mentores) | Consejos que no aplican a su universidad o zona | "…había gente que había estado en Monterrey pero en la UDEM…" |
| Hub y calculadora | Gastos no previstos (luz, transporte, comisiones) | "El recibo de la luz es el mayor gasto inesperado…" |

## 3. Usuarios

| Rol | Descripción | Prioridad |
| --- | --- | --- |
| Estudiante entrante | Internacional o foráneo, 18–26 años, organiza su mudanza desde el celular. **Internacional: segmento prioritario de la fase 1.** | Primario |
| Mentor | Estudiante local o ex-intercambista que orienta a quien llega. | Secundario |
| Arrendador | Propietario cerca del campus que busca inquilinos por semestre. | Proveedor |
| Administrador | Equipo Aterriza: verifica, modera y audita. | Interno |

## 4. Alcance del MVP (según la matriz de priorización)

| Prioridad en la Evidencia | Módulo | En esta versión |
| --- | --- | --- |
| P0 | Marketplace de vivienda verificada | Completo |
| P0 | Autenticación universitaria | Correo institucional + matrícula, con revisión manual de respaldo. **Sin conexión real con sistemas del Tec** (requiere convenio). |
| P0 | Red de mentores y chat | Completo, en tiempo real |
| P1 | Calculadora de costos ocultos | Completa, con supuestos a la vista |
| P2 | Hub de servicios | Guías y checklist. Sin convenios comerciales (eSIM, seguros). |
| P3 | Tours / videollamada | Solo agendar una videollamada; la llamada ocurre fuera de la plataforma. Sin tours 3D. |

## 5. Fuera de alcance (y por qué)

| Elemento | Motivo |
| --- | --- |
| Pagos, pago en custodia, "depósito protegido" | Retener dinero de terceros tiene implicaciones regulatorias y necesita proveedor y asesoría legal. **La plataforma no mueve dinero**; lo dice de forma explícita y alerta sobre pagos por fuera. |
| Sello institucional del Tec | Requiere un convenio que hoy no existe. La interfaz no usa logo del Tec ni sugiere respaldo oficial. |
| Sustitución de fiador, seguros | Requieren socios. |
| Perfilador de roommates, carpooling, eventos | Fases futuras; no están en P0/P1. |
| App nativa | La web responsiva cubre el MVP. |
| Inglés | **Primer pendiente de lanzamiento**: el segmento prioritario es internacional. Ver `10-plan-y-estado.md`. |

## 6. Vacíos detectados en la Evidencia

Afectan al producto y conviene resolverlos con el equipo:

1. **Business Model Canvas y Ten Types están vacíos** en el `.docx` revisado (el Canvas es una imagen de 1×1 px). Por lo tanto **no está definido quién paga**. El MVP no implementa ningún cobro.
2. **Estudiantes internacionales antes de llegar:** puede que aún no tengan correo `@tec.mx`, justo cuando más necesitan la plataforma. Por eso existe la revisión manual (RF-03); hay que validar cuándo reciben correo y matrícula.
3. **"100% verificado" y "seguridad total":** la Evidencia usa estas frases; el producto no. Una verificación reduce el riesgo pero no lo elimina, y prometer lo contrario crea riesgo legal y de reputación. La interfaz dice exactamente qué se revisó.
4. **Quién y cómo verifica físicamente:** define el costo operativo real. El MVP registra los cuatro criterios y a quien los revisó, pero el proceso en campo sigue sin diseñarse.
5. **Competidor directo ausente:** la matriz comparativa no incluye plataformas especializadas como AmberStudent (ver `11-benchmark-amberstudent.md`).
6. **Cifras sin confirmar:** "más de 8,000 propiedades" y "2,500 estudiantes" (presentación) no tienen fuente citada; no se usan en el producto.

## 7. Métricas de éxito para la validación

Son objetivos propuestos para la siguiente etapa, no resultados.

| Hipótesis de la Evidencia | Métrica | Objetivo inicial |
| --- | --- | --- |
| Usarían la plataforma antes de viajar si hay verificación | % de registrados que solicitan una vivienda | ≥ 30% |
| El factor humano genera confianza | % de solicitantes que antes hablaron con un mentor | ≥ 40% |
| Subestiman su presupuesto | % que dice haber descubierto un gasto que no consideraba | ≥ 50% |
| La navegación es sencilla | Prueba con 8–10 estudiantes: completar búsqueda → solicitud sin ayuda | ≥ 80% |
