# Aterriza

Vivienda revisada y apoyo entre estudiantes para quienes se mudan a Monterrey a estudiar. Proyecto de EM1012 Emprendimiento, Liderazgo e Innovación, Tec de Monterrey, Equipo 1. "Aterriza" es un nombre provisional.

> **Demostración.** Las viviendas, personas y precios son ficticios. Proyecto independiente, sin afiliación con el Tecnológico de Monterrey.

## Arrancar la demo

Requiere Node 22 o superior. No hace falta instalar una base de datos.

```bash
npm install
npm run demo
```

Abre **http://localhost:4000**. En la pantalla de inicio de sesión hay botones para entrar con cada rol.

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Estudiante internacional | `lucia@demo.aterriza.mx` | `Aterriza-Demo-2026` |
| Exinquilino | `tomas@demo.aterriza.mx` | igual |
| Mentor | `diego@demo.aterriza.mx` | igual |
| Arrendadora | `marcela@demo.aterriza.mx` | igual |
| Administración | `admin@demo.aterriza.mx` | igual |

Para volver a los datos iniciales, detén el servidor y corre `npm run db:reset`.

### Guion sugerido para presentar (5 minutos)

1. **Portada.** El problema, el sello y la calculadora.
2. **Búsqueda.** Filtra por presupuesto y mira el mapa. En Tecnológico aparece un depa de $6,200 con alerta roja.
3. **Ficha de ese depa.** Alerta de precio, sello 2/4 y por qué no se puede solicitar.
4. **Ficha de "Cuarto con baño propio".** Sello 4/4, lo que incluye la renta, costo real, reseñas comprobadas y mentores de la zona.
5. **Como Lucía**, solicita la vivienda. En otra ventana privada, **como Marcela**, responde en el chat: *"hazme una transferencia para apartar"*. A Lucía le aparece el aviso de estafa en vivo.
6. **Como Marcela**, acepta. Lucía ya ve la dirección exacta.
7. **Como administración**, aprueba "Cuarto nuevo esperando revisión" marcando sus criterios.

## Demo en Vercel

Usa una base de Neon exclusiva de la demo, instalada desde el Marketplace de Vercel. Variables: `PUBLIC_DEMO=true`, `DEMO_DATABASE=dedicated` y `APP_SECRET` (32 o más). La demo es abierta: cualquiera con el enlace entra con las cuentas de demostración. Para volver a pedir una contraseña compartida (usuario `equipo`), agrega `DEMO_GATE=on` y `DEMO_ACCESS_PASSWORD` (12 caracteres o más). Para volver a los datos iniciales: `npx vercel env run -e production -- npm run db:reset-demo -w @aterriza/api -- --confirmar`. Detalles en [Arquitectura](docs/04-arquitectura.md).

## Desarrollo

```bash
cp .env.example .env
npm run dev          # API en :4000, web en :5173
npm test             # Pruebas de dominio e integración
npm run typecheck
npm run lint
npm run test:e2e     # Recorrido en el navegador. Requiere Chrome y `npm run demo` con datos limpios
```

## Documentación

| | |
| --- | --- |
| [Visión y alcance](docs/01-vision-y-alcance.md) | [Requerimientos](docs/02-requerimientos.md) |
| [Historias de usuario](docs/03-historias-de-usuario.md) | [Arquitectura](docs/04-arquitectura.md) |
| [Patrones de diseño](docs/05-patrones-de-diseno.md) | [Base de datos](docs/06-base-de-datos.md) |
| [API](docs/07-api.md) | [Seguridad](docs/08-seguridad.md) |
| [UX e identidad](docs/09-ux-e-identidad.md) | [Plan y estado](docs/10-plan-y-estado.md) |
| [Referencia: AmberStudent](docs/11-benchmark-amberstudent.md) | [Evaluación heurística (Nielsen)](docs/12-heuristicas-nielsen.md) |

## Stack

React 19, Vite, TanStack Query y Leaflet en la web. Fastify 5, TypeScript y zod en la API. PostgreSQL: PGlite en local, Supabase para producción.

## Créditos

Fotos de demostración: Wikimedia Commons; autor y licencia de cada una en la página de Ayuda de la app. Mapa: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright).
