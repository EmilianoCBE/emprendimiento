# 03 · Historias de usuario

Formato: *Como… quiero… para…* con criterios de aceptación. Estimación en puntos (1, 2, 3, 5, 8). **Todas las de esta lista entran en el MVP**, salvo las marcadas como backlog.

## Épica A · Cuenta y validación

**HU-01 · Registrarme (RF-01, RF-02) · 3 pts**
Como estudiante que viene de otro país, quiero crear mi cuenta desde antes de viajar para empezar a organizar mi llegada.
- [ ] Elijo rol: estudiante, mentor o arrendador.
- [ ] La contraseña exige mínimo 10 caracteres y rechaza contraseñas comunes.
- [ ] Recibo un código de 6 dígitos que caduca a los 15 minutos.
- [ ] Un correo ya registrado no revela que existe.

**HU-02 · Validarme como estudiante (RF-03) · 3 pts**
Como estudiante, quiero demostrar que pertenezco a la universidad para que la comunidad sea confiable.
- [ ] Con correo institucional y matrícula válida quedo validado sin intervención.
- [ ] Sin correo institucional, envío mi matrícula y queda en revisión manual.
- [ ] Veo claramente mi estado y qué me habilita.

**HU-03 · Sesión segura (RF-04) · 3 pts**
Como persona usuaria, quiero iniciar sesión, cerrarla en todos mis dispositivos y recuperar mi contraseña para mantener mi cuenta bajo control.
- [ ] Tras varios intentos fallidos la cuenta se bloquea temporalmente.
- [ ] Al cambiar la contraseña se cierran las demás sesiones.

**HU-04 · Control de mis datos (RF-05) · 2 pts**
Como persona usuaria, quiero descargar mis datos o eliminar mi cuenta para ejercer mis derechos.
- [ ] Al eliminarla se anonimizan mis datos personales y se cierran mis sesiones.

## Épica B · Encontrar vivienda confiable

**HU-05 · Buscar (RF-06, RF-11) · 5 pts**
Como estudiante, quiero filtrar por presupuesto, zona y traslado sin coche para encontrar opciones que me sirvan sin conocer la ciudad.
- [ ] Puedo filtrar sin iniciar sesión.
- [ ] Veo por defecto primero las verificadas.
- [ ] Los filtros se reflejan en la URL para poder compartir la búsqueda.
- [ ] Hay un mapa con ubicaciones aproximadas.
- [ ] Si no hay resultados, me dice qué filtro relajar.

**HU-06 · Entender qué se verificó (RF-07, RF-08) · 3 pts**
Como estudiante con miedo a una estafa, quiero ver exactamente qué se comprobó para decidir con evidencia.
- [ ] Veo los 4 criterios, cuáles se cumplen y la fecha de revisión.
- [ ] Veo lo que incluye y no incluye la renta.

**HU-07 · Recibir alerta de precio (RF-09) · 2 pts**
Como estudiante, quiero saber si una renta es sospechosamente baja para no caer en anuncios falsos.
- [ ] La alerta muestra el porcentaje y contra qué mediana se compara.

**HU-08 · Comparar zonas (RF-10) · 2 pts**
Como estudiante, quiero comparar colonias para elegir sin haberlas visitado.

**HU-09 · Solicitar una vivienda (RF-13, RF-14, RF-15) · 5 pts**
Como estudiante validado, quiero solicitar una vivienda y agendar una videollamada para verla antes de comprometerme.
- [ ] Solo en viviendas 4/4, con mensaje claro si no se puede.
- [ ] Debo confirmar el aviso de "no pagues por fuera sin contrato".
- [ ] La dirección exacta aparece hasta que el arrendador acepte.
- [ ] Veo la línea de tiempo de mi solicitud.

**HU-10 · Reseñar mi estancia (RF-16) · 3 pts**
Como ex-inquilino, quiero dejar una reseña real para ayudar a quien viene después.
- [ ] Solo se habilita con una estancia comprobada.
- [ ] La reseña muestra "Estancia comprobada" y el periodo.

**HU-11 · Reportar (RF-17) · 2 pts**
Como estudiante, quiero reportar un anuncio dudoso para proteger a los demás.
- [ ] Con 3 personas distintas sale de la búsqueda y llega a moderación.

## Épica C · Comunidad

**HU-12 · Encontrar a alguien que me entienda (RF-19, RF-22) · 3 pts**
Como estudiante, quiero encontrar a un mentor de mi universidad que haya vivido en esa zona para recibir consejos aplicables a mi caso.
- [ ] Filtro por tipo, idioma, tema y zona.
- [ ] La ficha de una vivienda me sugiere mentores de la zona.

**HU-13 · Conectar y chatear (RF-20, RF-21) · 5 pts**
Como estudiante, quiero hablar con un mentor antes de viajar para resolver dudas reales.
- [ ] El mentor acepta o declina.
- [ ] Los mensajes llegan sin recargar.
- [ ] Solo participantes pueden leer la conversación.

**HU-14 · Advertir señales de estafa (RF-18) · 2 pts**
Como estudiante, quiero que el chat me avise si alguien pide transferir dinero o moverme a otra app para reconocer el riesgo a tiempo.

**HU-15 · Ser mentor (RF-01, RF-29) · 2 pts**
Como ex-intercambista, quiero publicar mi perfil y atender solicitudes para ayudar a otros y ampliar mi red.
- [ ] Mi perfil aparece después de que lo aprueba un administrador.

## Épica D · Planear

**HU-16 · Saber cuánto voy a gastar (RF-23, RF-24) · 3 pts**
Como estudiante internacional, quiero calcular mi primer mes con los gastos ocultos para no quedarme sin dinero.
- [ ] Puedo ajustar mes de llegada, uso de aire y traslados.
- [ ] Distingue datos del anuncio y estimaciones.
- [ ] Advierte del recibo de luz en temporada de calor.
- [ ] Puedo abrirla desde una vivienda con los datos ya cargados.

**HU-17 · Guías y checklist (RF-25, RF-26) · 3 pts**
Como estudiante, quiero una sola guía paso a paso para no depender de grupos dispersos.
- [ ] Mi avance se guarda.
- [ ] Cada guía muestra cuándo se revisó y recomienda confirmar trámites con la oficina correspondiente.

## Épica E · Arrendadores

**HU-18 · Publicar vivienda (RF-12) · 5 pts**
Como arrendador, quiero publicar mi vivienda para llegar a estudiantes validados.
- [ ] Puedo guardar borrador, subir fotos y enviar a revisión.
- [ ] Veo el resultado de cada criterio.

**HU-19 · Gestionar solicitudes (RF-14) · 3 pts**
Como arrendador, quiero recibir, agendar y aceptar o rechazar solicitudes para llenar mi vivienda por semestre.

## Épica F · Operación

**HU-20 · Verificar viviendas (RF-28) · 3 pts**
Como administrador, quiero una cola de viviendas con sus criterios para decidir cuáles se publican.

**HU-21 · Moderar (RF-29) · 3 pts**
Como administrador, quiero atender reportes, validar estudiantes y aprobar mentores para mantener la confianza.

**HU-22 · Auditar (RF-30) · 2 pts**
Como administrador, quiero una bitácora y métricas para rendir cuentas y entender el uso.

**HU-23 · Estar al tanto (RF-27) · 2 pts**
Como persona usuaria, quiero notificaciones de lo que me toca hacer para no perderme nada.

**HU-24 · Saber qué me falta para mudarme (RF-31) · 2 pts**
Como estudiante con una solicitud, quiero una lista de lo que debo tener listo para no llegar con sorpresas.
- [ ] Marco mi avance; la plataforma nunca me pide subir documentos.
- [ ] Solo yo veo y modifico mi lista.

**HU-25 · Resolver dudas sin esperar (RF-32) · 1 pt**
Como persona usuaria, quiero respuestas a las dudas comunes para decidir sin escribirle a nadie.

## Backlog (post-MVP)

| Historia | Motivo de posponerla |
| --- | --- |
| Interfaz en inglés | **Primera prioridad tras la demo** |
| Pago con custodia | Legal + proveedor |
| Contrato semestral modelo descargable | Requiere revisión de un abogado |
| Correos reales | Requiere proveedor y dominio |
| MFA para administradores | Requerido antes del lanzamiento |
| Inicio de sesión con la cuenta del Tec | Requiere convenio |
| Perfilador de roommates, carpooling, eventos | Fases futuras de la Evidencia |
| Convenios de eSIM y seguros | Requiere socios |

## Trazabilidad con la Evidencia

| Necesidad no atendida (Secc. 9) | Historias |
| --- | --- |
| Validación de la vivienda a distancia | HU-05, 06, 07, 09, 10, 11, 14, 20 |
| Contexto local y específico por campus | HU-08, 12, 16, 17 |
| Acompañamiento entre pares | HU-12, 13, 15 |
