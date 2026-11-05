# 02 · Requerimientos

Prioridad: **M** (imprescindible para la demo), **S** (importante), **C** (deseable). "Origen" apunta a la sección de la Evidencia 1.

## Requerimientos funcionales

### Identidad y acceso

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-01 | Registro como estudiante, mentor o arrendador con correo y contraseña. El rol de administrador no se puede elegir al registrarse. | M | Matriz P0 |
| RF-02 | Confirmar el correo con un código de 6 dígitos que expira en 15 minutos y admite máximo 5 intentos. | M | Lotus 8 |
| RF-03 | Validar al estudiante: automático si confirma un correo de dominio institucional y da una matrícula con formato válido; revisión manual por un administrador en otro caso. | M | Matriz P0, Golden Circle |
| RF-04 | Iniciar y cerrar sesión, cerrar todas las sesiones, recuperar contraseña. | M | Seguridad |
| RF-05 | Editar perfil, descargar mis datos y eliminar mi cuenta (derechos ARCO). | S | RNF legal |

### Vivienda

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-06 | Buscar con filtros: renta máxima, zona, tipo, minutos al campus caminando o en transporte, amueblado, servicios incluidos, contrato semestral, solo verificadas. Ordenar por confianza, precio o distancia. Paginado. | M | Secc. 11, VPC |
| RF-07 | Ficha con fotos, contrato (plazo mínimo, depósito, disponibilidad) y **desglose de lo que incluye y no incluye la renta**. | M | Secc. 9, VPC |
| RF-08 | Sello con cuatro criterios revisados por una persona: documentos de propiedad, identidad del arrendador, contrato modelo con recibos, fotos con fecha. Niveles: verificada (4), parcial (2–3), sin verificar (0–1). La ficha muestra qué se revisó y qué falta. | M | ERRC "Crear" |
| RF-09 | Alerta de precio: ≥ 20% bajo la mediana = aviso; ≥ 35% = peligro. Se compara con viviendas parecidas (compartidas o privadas). Si la zona tiene menos de 3, se usa la mediana de la ciudad. | M | Secc. 2 (fraude) |
| RF-10 | Comparar zonas: renta mediana, número de viviendas y notas de transporte. | S | Lotus 7 |
| RF-11 | Mapa con **ubicación aproximada**. La dirección exacta solo se revela después de que el arrendador acepta la solicitud. | S | Seguridad |
| RF-12 | El arrendador crea, edita y envía a revisión sus viviendas y sube fotos. Solo son públicas las de nivel parcial o superior aprobadas por un administrador. Cualquier cambio a una publicada, salvo la fecha de disponibilidad, la devuelve a revisión. | M | Secc. 11 |

### Solicitud de vivienda

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-13 | Un estudiante validado solicita una vivienda **verificada** (4/4) indicando periodo y mensaje, y confirma que entendió que no debe pagar por fuera sin contrato. Una solicitud activa por vivienda. | M | Secc. 7 |
| RF-14 | Ciclo de vida: `solicitada → videollamada agendada → aceptada → confirmada → concluida`, con salidas `rechazada` y `cancelada`. Cada rol solo puede hacer ciertas transiciones; todas quedan en bitácora. | M | Secc. 7 |
| RF-15 | La plataforma **no procesa pagos** y lo informa en el flujo. | M | Riesgo legal |
| RF-31 | "Lista para mudarte" en cada solicitud: identificación, carta de aceptación, aval o depósito, contrato y recibo. Solo marca avance; no se suben documentos. | S | Referencia: AmberStudent |

### Confianza

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-16 | Reseñar solo con una estancia concluida, o confirmada y ya iniciada, en esa vivienda, una por estancia; calificación 1–5, comentario 20–600 caracteres. El puntaje usa un promedio ponderado para que una sola reseña no lo infle. | M | Secc. 7 "reseñas reales" |
| RF-17 | Reportar una vivienda con motivo; una vez por persona. Con 3 personas distintas, pasa a revisión y sale de la búsqueda. | M | ERRC |
| RF-18 | Señales de estafa en el chat: si un mensaje pide transferencia, CLABE, anticipo o llevar la conversación a otra app, se muestra un aviso al destinatario. El mensaje no se bloquea. | S | Secc. 7, diferenciador |

### Mentores

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-19 | Directorio de mentores aprobados, filtrable por tipo, idioma, tema y zona. Muestra universidad y zona donde vivió, porque la Evidencia indica que el consejo debe aplicar a su caso. | M | Secc. 7, matriz P0 |
| RF-20 | Un estudiante validado solicita conexión; el mentor acepta o declina. | M | Matriz P0 |
| RF-21 | Chat en tiempo real entre las partes de una conversación activa, también para arrendador y estudiante cuando exista una solicitud. | M | Lotus 3 |
| RF-22 | La ficha de vivienda sugiere mentores que conocen esa zona. | S | Secc. 7 |

### Presupuesto y hub

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-23 | Calculadora del primer mes y de un mes típico: renta, depósito, luz según temporada y aire acondicionado, internet, transporte, comida, comisiones bancarias. Sirve con una vivienda o con una renta manual. Separa datos del anuncio y estimaciones. | M | Matriz P1, ERRC |
| RF-24 | Alertas de costos ocultos con su explicación, por ejemplo luz en temporada de calor. | S | Lotus 7 |
| RF-25 | Guías por categoría: vivienda y contratos, dinero, movilidad, trámites, salud, vida diaria. Con fecha de revisión. | S | Matriz P2 |
| RF-26 | Checklist antes de viajar y primera semana, con avance guardado. | S | Pilar 3 |

### Sistema

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-27 | Notificaciones en la app para cambios de solicitud, mensajes, conexiones y decisiones de verificación. | S | UX |
| RF-28 | Admin: cola de viviendas, marcar criterios y aprobar o rechazar. | M | Secc. 11 |
| RF-29 | Admin: atender reportes, validar estudiantes y aprobar mentores. | M | Secc. 11 |
| RF-30 | Admin: bitácora de auditoría y métricas básicas. | S | Seguridad |
| RF-32 | Página de ayuda con preguntas frecuentes. | S | VPC, referencia: AmberStudent |

## Requerimientos no funcionales

| ID | Atributo | Requerimiento | Cómo se comprueba |
| --- | --- | --- | --- |
| RNF-01 | Seguridad | Controles alineados con OWASP ASVS nivel 2 y Top 10 (detalle en `08-seguridad.md`). | Pruebas de autorización, `npm audit`, revisión |
| RNF-02 | Seguridad | Contraseñas con Argon2id; sesiones opacas guardadas como hash en cookie `HttpOnly`, `Secure`, `SameSite`. | Pruebas de integración |
| RNF-03 | Seguridad | Autorización en el servidor en cada ruta, incluida propiedad del recurso (anti-IDOR). | Pruebas de integración por rol |
| RNF-04 | Privacidad | Mínimo de datos; dirección y contacto ocultos hasta aceptar; aviso de privacidad; exportar y eliminar cuenta (LFPDPPP). | Revisión + pruebas |
| RNF-05 | Mantenibilidad | Dominio sin dependencias de framework ni de base de datos. Límites entre módulos. | Revisión de imports |
| RNF-06 | Portabilidad | Cambiar de PGlite a Postgres/Supabase solo cambia `DATABASE_URL`. | Mismas migraciones en ambos |
| RNF-07 | Pruebas | Todas las reglas de negocio con prueba unitaria; rutas críticas con prueba de integración. | `npm test` |
| RNF-08 | Rendimiento | Con datos de demo: API p95 < 300 ms, primera carga < 2.5 s (LCP en local). Código dividido por ruta. | Medición manual |
| RNF-09 | Accesibilidad | WCAG 2.2 AA: contraste, foco visible, teclado, etiquetas, `prefers-reduced-motion`. | Revisión manual; pendiente lector de pantalla |
| RNF-10 | Responsivo | Diseño móvil primero; funcional desde 360 px. | Revisión en navegador |
| RNF-11 | Observabilidad | Logs JSON con ID de solicitud y sin datos sensibles; `/health`. | Revisión |
| RNF-12 | Configuración | Secretos solo por entorno; la app no arranca en producción con configuración insegura o de demo. | Prueba de configuración |
| RNF-13 | Honestidad de datos | Datos de demo identificados en la interfaz; estimaciones marcadas como tales. | Revisión |
| RNF-14 | Disponibilidad | Un único artefacto desplegable (API + web); en Supabase, respaldos gestionados. | Dockerfile |
| RNF-15 | Internacionalización | Montos en MXN enteros; textos concentrados por pantalla para poder traducir. Inglés en la siguiente iteración. | Pendiente |

## Supuestos por validar

Son decisiones de partida, **no datos comprobados**. Viven en una tabla o constante para cambiarlos sin tocar la lógica.

| ID | Supuesto | Dónde |
| --- | --- | --- |
| SUP-01 | Umbrales de alerta: 20% y 35% bajo la mediana | `PriceAlertPolicy` |
| SUP-02 | 3 reportes distintos pasan a revisión | `DistinctReportersPolicy` |
| SUP-03 | Costos de luz, internet, transporte, comida y comisiones | Tabla `cost_assumptions` |
| SUP-04 | Temporada de calor de mayo a septiembre | `isHotSeason` |
| SUP-05 | Solo se pueden solicitar viviendas 4/4 ("la seguridad supera a la cantidad") | `BOOKING_RULES` |
| SUP-06 | Los dominios institucionales son `tec.mx` e `itesm.mx`; matrícula con formato `A` + 8 dígitos | Configuración |
| SUP-07 | Puntaje: previo 3.5 con peso de 3 reseñas | `trustScore` |
