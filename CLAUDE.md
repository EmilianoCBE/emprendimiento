# Aterriza: contexto para Claude

Web app para que estudiantes foráneos e internacionales del Tec de Monterrey consigan vivienda verificada y apoyo entre pares antes de llegar. Proyecto de EM1012 (Emprendimiento), Evidencia 1, Equipo 1. Se trabaja en español, trato de tú. "Aterriza" es nombre provisional.

## Para retomar después de un /clear

1. Lee `docs/10-plan-y-estado.md`: qué está hecho y qué sigue.
2. Lee el documento de `docs/` que corresponda a la tarea.
3. La fuente del negocio es `../Evidencia 1 Equipo 1.docx`, resumida en `docs/01-vision-y-alcance.md`.
4. **No modificar** `../aterriza/`: es un prototipo anterior, solo sirve de referencia.

## Mapa de documentos

| Archivo | Contenido |
| --- | --- |
| `docs/01-vision-y-alcance.md` | Problema, alcance, vacíos de la Evidencia |
| `docs/02-requerimientos.md` | RF, RNF, supuestos |
| `docs/03-historias-de-usuario.md` | Historias y criterios de aceptación |
| `docs/04-arquitectura.md` | Arquitectura, diagramas, ADR |
| `docs/05-patrones-de-diseno.md` | SOLID y patrones |
| `docs/06-base-de-datos.md` | Modelo ER y tablas |
| `docs/07-api.md` | Endpoints |
| `docs/08-seguridad.md` | Amenazas, controles, bloqueantes de lanzamiento |
| `docs/09-ux-e-identidad.md` | Identidad visual y voz |
| `docs/10-plan-y-estado.md` | **Estado vivo** |
| `docs/11-benchmark-amberstudent.md` | Referencia de producto que pidió el usuario |

## Comandos

```bash
npm install
npm run demo       # Modo presentación: build + todo en http://localhost:4000
npm run dev        # API en :4000, web en :5173. Requiere .env. Datos en apps/api/.data
npm test           # Todas las pruebas
npm run typecheck
npm run lint
npm run db:reset   # Reinicia datos locales (con el servidor detenido)
npm run test:e2e   # Recorrido en Chrome; requiere npm run demo con datos limpios
npm run build
```

## Reglas del proyecto

**Arquitectura**
- Monolito modular hexagonal: `routes → service → domain`, y `repository` detrás de un puerto. `domain.ts` no importa nada externo.
- Dependencias conectadas solo en `apps/api/src/composition.ts`.
- Validación con zod de `packages/contracts`, compartida entre API y web.
- Un cambio de esquema es una migración nueva; no se editan las ya aplicadas.

**Seguridad (no negociable)**
- SQL siempre parametrizado. Sin `dangerouslySetInnerHTML`.
- Autorización y propiedad se comprueban en el servidor; 404 si no hay acceso.
- `exact_address` nunca sale salvo a quien corresponde.
- Secretos solo en `.env`; nunca se suben al repositorio. Ninguna llave de Supabase va al navegador.
- La app no arranca con `DEMO_MODE` en producción.
- La plataforma no procesa pagos.

**Producto**
- Nunca prometer "100% seguro" ni sugerir respaldo oficial del Tec; no usar su logo.
- Datos de demostración siempre identificados como tales; estimaciones marcadas como tales.

**Diseño**
- Seguir `docs/09-ux-e-identidad.md`. Usar la skill `frontend-design` al crear pantallas.
- Sin mayúsculas sostenidas, degradados ni flechas en botones. Cempasúchil es el único acento.
- Todo valor visual sale de `apps/web/src/design/tokens.css`; cada pantalla tiene su `.css`. Estilos en línea solo para valores calculados.
- Una acción que no se puede completar no se muestra como acción principal.

**Git**
- Hacer commit o push solo cuando el usuario lo pida. El repositorio aún no está conectado a GitHub.

## Cuentas de demostración

Contraseña de todas: `Aterriza-Demo-2026`. Solo existen con `DEMO_MODE=true`.

| Rol | Correo |
| --- | --- |
| Estudiante internacional | `lucia@demo.aterriza.mx` |
| Exinquilino | `tomas@demo.aterriza.mx` |
| Mentor | `diego@demo.aterriza.mx` |
| Arrendadora | `marcela@demo.aterriza.mx` |
| Admin | `admin@demo.aterriza.mx` |
