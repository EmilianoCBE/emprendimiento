# 08 · Seguridad y privacidad

No existe la seguridad "máxima"; lo que sí hay es un conjunto de controles explícitos y una lista honesta de lo que falta. Esta aplicación maneja datos personales de estudiantes, muchos de ellos extranjeros y en una situación vulnerable, así que **antes de abrirla al público hay que completar la sección "Bloqueantes"**.

## Modelo de amenazas

| Amenaza | Actor | Impacto | Control |
| --- | --- | --- | --- |
| Anuncio falso | Estafador | Pérdida de dinero, el daño central | Publicación solo tras revisión; sello por criterios; alerta de precio; reportes; aviso de no pagar por fuera |
| Pedir pago por chat | Arrendador malicioso | Fraude | Detector de señales; solicitud solo en viviendas 4/4; plataforma sin pagos |
| Toma de cuenta | Externo | Suplantación | Argon2id, bloqueo, límite de frecuencia, revocación, respuestas sin enumeración |
| Ver datos de otros (IDOR) | Usuario autenticado | Fuga | Comprobación de propiedad en el servicio + 404 uniforme + pruebas |
| Escalar a administrador | Usuario | Control total | Rol no aceptado en registro; zod descarta campos no declarados; pruebas |
| XSS | Externo | Robo de sesión | React escapa; CSP estricta; cookie `HttpOnly`; guías en texto, sin HTML crudo |
| CSRF | Sitio externo | Acciones sin querer | `SameSite`, `Origin` y encabezado personalizado |
| Inyección SQL | Externo | Fuga total | Solo consultas parametrizadas |
| Archivo malicioso | Arrendador | XSS / malware | Tipo por firma binaria, nombre aleatorio, `nosniff`, 5 MB, sin SVG |
| Acoso entre usuarios | Usuario | Daño personal | Solo conversa quien tiene relación aprobada; **falta bloquear y reportar personas** |
| Robo de base de datos | Externo | Fuga | Contraseñas, tokens y códigos solo como hash |
| Filtrar datos en logs | Interno | Fuga | Redacción de cabeceras y campos sensibles |
| Exposición por PostgREST de Supabase | Externo | Fuga total | RLS sin políticas en todas las tablas |
| Credenciales de demo en producción | Equipo | Toma de cuenta | La app **se niega a arrancar** con `DEMO_MODE` en producción |

## Controles por categoría (OWASP Top 10)

| Categoría | Implementación |
| --- | --- |
| A01 Control de acceso | `requireAuth`, `requireRole`, `requireVerifiedStudent`; propiedad en servicios; 404 si no hay acceso |
| A02 Criptografía | Argon2id (19 MiB, 2 iter.); tokens de 256 bits con `crypto.randomBytes`, guardados con SHA-256; códigos con HMAC; HTTPS con HSTS en producción |
| A03 Inyección | SQL parametrizado; zod en toda entrada; salida escapada por React |
| A04 Diseño inseguro | Modelo de amenazas; máquina de estados; publicación con revisión humana; límites de negocio |
| A05 Configuración | `helmet`, CSP sin `unsafe-inline` en scripts, CORS cerrado, config validada al arrancar, errores sin stack |
| A06 Componentes | `npm audit` en CI, Dependabot, lockfile, CodeQL |
| A07 Autenticación | Mínimo 10 caracteres + lista de comunes; bloqueo; rotación en login; expiración 7 días y 24 h de inactividad; revocación |
| A08 Integridad | `npm ci` en CI y Docker; contenedor sin root |
| A09 Registro | Logs JSON con ID de solicitud; bitácora de acciones sensibles |
| A10 SSRF | El servidor no descarga URLs de usuarios |

## Cabeceras

`Content-Security-Policy`, `Strict-Transport-Security` (producción), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy`.

## Privacidad (LFPDPPP)

| Medida | Estado |
| --- | --- |
| Datos mínimos; sin documentos sensibles en el MVP | ✅ |
| Dirección exacta oculta hasta aceptar | ✅ |
| Teléfono y correo no se comparten en la plataforma | ✅ |
| Exportar y eliminar cuenta | ✅ |
| Aviso de privacidad | ⚠️ Borrador; **requiere revisión legal** |
| Términos de uso | ⚠️ Borrador; **requiere revisión legal** |
| Responsable y contacto ARCO | ❌ Falta una persona o entidad responsable |

Los documentos de propiedad e identidad **no se suben** en el MVP. El administrador los revisa fuera de la plataforma y solo registra el resultado. Guardarlos implicaría datos sensibles y más obligaciones.

## Bloqueantes antes de un lanzamiento público

1. **MFA para administradores.**
2. **Proveedor de correo real**, con SPF/DKIM.
3. **Revisión legal** de aviso de privacidad, términos y responsabilidad como intermediario.
4. **Proceso operativo real de verificación**: el sello solo vale tanto como la revisión.
5. **Bloquear y reportar usuarios** en el chat, y política de moderación.
6. **Almacén de fotos gestionado** y eliminar metadatos EXIF, que pueden contener ubicación.
7. **Bus de eventos y rate limit compartidos** si se usa más de una instancia.
8. **Prueba de penetración** y revisión externa.
9. **Copias de seguridad probadas** y plan de respuesta a incidentes.
10. **Comprobar contra Postgres real**: las pruebas automatizadas corren en PGlite; el adaptador `PgDb` aún no se ha probado contra Supabase.
11. **Proveedor de mapas**: el servidor público de OpenStreetMap solo sirve para uso ligero.
12. **Imagen de Docker**: el `Dockerfile` aún no se ha construido ni ejecutado.

## Demo pública

La demo en Vercel tiene cuentas con contraseña conocida, incluida la de administración. Por eso la protege una contraseña compartida en toda la API, y usa una base de Neon exclusiva de la demo, solo con datos ficticios. La app no arranca con esa base si no se declara `DEMO_DATABASE=dedicated` y no hay un `APP_SECRET` común. Las fotos subidas están desactivadas ahí. **Nadie debe escribir datos personales reales ahí.** La portada y las fotos de demostración son estáticas y se ven sin contraseña; no contienen datos.

## Riesgos aceptados por ahora

| Riesgo | Por qué se acepta | Revisar cuando |
| --- | --- | --- |
| El mensaje de "cuenta bloqueada" revela que el correo existe | Es útil para la persona, y los intentos están limitados | Antes de lanzar |
| Alguien puede bloquear 15 minutos la cuenta de otra persona fallando a propósito | Bloqueo corto; un bloqueo permanente sería peor | Si se detecta abuso |
| Un mensaje pasa aunque tenga señales de estafa | Los detectores son heurísticos y hay falsos positivos; avisar sirve sin censurar | Con datos reales |
| Cambiar la contraseña desconecta el tiempo real, pero una sesión caducada sigue conectada hasta el siguiente latido fallido | Solo recibe eventos de la propia persona | Antes de lanzar |

## Herramientas

| Herramienta | Uso |
| --- | --- |
| Plugin `security-guidance` (Claude Code) | Avisos al editar código con patrones riesgosos |
| Skill `/security-review` | Revisión de los cambios antes de integrarlos |
| `npm audit` | Dependencias vulnerables |
| GitHub Actions: CodeQL + Gitleaks + Dependabot | Se activan al conectar el repositorio |
