# 09 · UX e identidad visual

## Dirección: Señalética

Aterrizar en una ciudad que no conoces. Elegida entre dos propuestas el 2026-11-05. Tres ideas guían todo:

1. **El sello de pasaporte.** Es el elemento memorable: un sello circular con cuatro segmentos, uno por criterio de verificación. No decora: **es el dato**. Una vivienda con 2 de 4 muestra dos segmentos entintados.
2. **El Cerro de la Silla.** La silueta de Monterrey es el horizonte de la portada; ubica al producto en este lugar y en ningún otro.
3. **Señalización de transporte.** Letra alta y condensada para lo grande, contraste alto, indicaciones directas.

## Tokens

Definidos en `apps/web/src/design/tokens.css`. Ningún componente escribe colores ni medidas sueltas.

| Nombre | Valor | Uso |
| --- | --- | --- |
| `--color-bg` | `#F3F5F1` | Fondo |
| `--color-surface` | `#FFFFFF` | Paneles y controles |
| `--color-sunken` | `#E4E9E2` | Etiquetas, esqueletos |
| `--color-line` | `#D5DCD3` | Separadores |
| `--color-line-strong` | `#6F827E` | Borde de controles |
| `--color-ink` | `#0F2F2E` | Texto, sello, barra superior |
| `--color-ink-muted` | `#4A5F5C` | Texto secundario (6.2:1 sobre fondo) |
| `--color-accent` | `#FFB400` | **Único acento:** acción principal y estado activo, siempre con texto oscuro (8:1) |
| `--color-ok`, `--color-warn`, `--color-danger` | `#125233`, `#6B4B00`, `#B3261E` | Solo estados, con ícono o texto |
| `--color-chart-a`, `--color-chart-b` | `#00917C`, `#E89B00` | Solo la barra de la calculadora; validados con el script de `dataviz` |

**Espaciado:** múltiplos de 4 (`--space-1` a `--space-24`). **Radios:** 4 px en etiquetas y casillas, 6 px en controles, paneles y fotos. **Sombra:** una sola, para lo que flota.

## Tipografía

| Rol | Fuente | Regla |
| --- | --- | --- |
| Títulos grandes y cifras | **Big Shoulders Display** | Solo de 28 px hacia arriba; es condensada y en tamaños chicos cuesta leerla |
| Todo lo demás | **Source Sans 3** | Escala 13, 15, 17 y 20 px. Nombres, títulos de tarjeta y estados vacíos van aquí |

Se sirven desde el propio dominio (`@fontsource`), sin llamadas a terceros.

## Maquetación

- **Búsqueda:** resultados y mapa fijo; en móvil primero las viviendas, con filtros y mapa a pedido.
- **Ficha:** a la izquierda el contenido, en este orden: ¿es real?, ¿cuánto cuesta?, ¿quién me cuenta? A la derecha, precio, sello y acción; en móvil van arriba.
- **Tarjetas de vivienda:** foto y texto sobre el fondo, sin caja. **Mentores:** lista, no tarjetas.
- **Administración:** primero lo que hay que atender.
- **Móvil:** cinco pestañas inferiores; lo demás, desde Cuenta.

Alineación a la izquierda en todo el producto.

## Movimiento

Un único momento no solicitado: el sello cae sobre la portada al cargar la página. El resto solo responde a acciones. Todo respeta `prefers-reduced-motion`.

## Reglas para no caer en lo genérico

- Sin mayúsculas sostenidas en etiquetas ni subtítulos decorativos sobre cada título.
- Sin degradados, sin sombras en las tarjetas, sin una cuadrícula de cajas idénticas para todo.
- Sin flechas en el texto de los botones; sin fuente monoespaciada; sin emojis como íconos (Phosphor).
- Sin números decorativos: solo se numera lo que es una secuencia.
- Una acción que no se puede completar no se muestra como acción principal.

## Voz

Directa, cálida y en tú. Dice lo que pasa y qué hacer. Nunca promete seguridad total.

| En vez de | Decimos |
| --- | --- |
| "100% seguro" | "Revisamos estos 4 puntos" |
| "Error al procesar" | "Esta vivienda aún no se puede solicitar: le faltan 2 revisiones." |
| "Enviar" | "Solicitar vivienda" |
| "Sin resultados" | "Ninguna vivienda cumple con estos filtros. Prueba a subir tu renta máxima." |

## Principios de UX, según la Evidencia

| Hallazgo | Decisión |
| --- | --- |
| Miedo a transferir sin comprobar | El sello va sobre cada foto; aviso antes de solicitar |
| "Navegación sencilla y visual" | Una acción principal por pantalla; se ve sin iniciar sesión |
| Consejos que no aplican | Cada mentor muestra universidad y zona |
| El gasto de la luz sorprende | La ficha muestra el "costo real" además de la renta |
| Todo desde el celular | Móvil primero |

## Visualización de datos

La calculadora usa dos cifras grandes, una tabla y una barra de dos segmentos con etiqueta directa. Colores de esa barra: `#00917C` y `#E89B00`, validados con el script de `dataviz`. El ámbar queda por debajo de 3:1 contra el fondo; por eso cada segmento lleva etiqueta y hay tabla.

## Accesibilidad

Contraste AA, foco visible con contorno de 3 px, navegación por teclado, etiquetas en todos los campos, mensajes en `aria-live`, enlace para saltar al contenido, controles de 44 px y casillas de 24 px. El sello siempre incluye texto equivalente. Los pines del mapa no dependen solo del color: tienen leyenda, signo y título. Pendiente: lector de pantalla y zoom al 200%.
