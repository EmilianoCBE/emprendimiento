# 09 · UX e identidad visual

## Dirección: Pista

Elegida el 2026-11-10, después de revisar AmberStudent, HousingAnywhere, Spotahome, Student.com, Uniplaces y Airbnb. Sustituye a "Señalética". Tres ideas guían todo:

1. **Buscar es lo primero.** La portada es una foto a todo lo ancho con un solo buscador en forma de píldora. Lo demás (zonas, viviendas, mentores, pasos, costos, ayuda) viene después, cada cosa en su banda.
2. **Titular de cartel, texto tranquilo.** Títulos condensados y pesados; todo lo demás en una sans neutra de la misma familia.
3. **Un color para actuar.** Fondo blanco, tinta casi negra y un solo azul para la acción principal. El verde significa una cosa: vivienda con sus cuatro revisiones.

El logo conserva la idea original (la curva es la trayectoria de llegada; la línea, la pista), ahora dentro de un símbolo azul que también sirve de ícono.

## Tokens

Definidos en `apps/web/src/design/tokens.css`. Ningún componente escribe colores ni medidas sueltas.

| Nombre | Valor | Uso |
| --- | --- | --- |
| `--color-bg`, `--color-surface` | `#FFFFFF` | Fondo y controles |
| `--color-soft` | `#F5F6F8` | Paneles y bandas |
| `--color-sunken` | `#E9EBF0` | Etiquetas, esqueletos |
| `--color-line` | `#E3E5EA` | Separadores |
| `--color-line-strong` | `#8A8FA0` | Borde de controles |
| `--color-ink` | `#14161F` | Texto, pie, botones oscuros |
| `--color-ink-muted` | `#565B6B` | Texto secundario |
| `--color-accent` | `#2A45E6` | **Azul pista:** acción principal y estado activo, siempre con texto blanco |
| `--color-accent-soft` | `#EEF1FF` | Etiquetas y estado activo suave |
| `--color-mark` | `#FFB400` | Cempasúchil: solo el trazo del logo y detalles sobre fondo oscuro. Nunca como texto sobre blanco |
| `--color-ok`, `--color-warn`, `--color-danger` | `#0E7A4D`, `#6B4B00`, `#B3261E` | Solo estados, con ícono o texto. El verde es "vivienda verificada" |
| `--color-chart-a`, `--color-chart-b` | `#00917C`, `#B87400` | Solo la barra de la calculadora |

**Espaciado:** múltiplos de 4. **Radios:** píldora en botones y chips; 12 px en campos y paneles; 16 px en fotos y tarjetas; 24 px en bandas. **Sombra:** una sola, para lo que flota.

## Tipografía

| Rol | Fuente | Regla |
| --- | --- | --- |
| Títulos y cifras | **Sofia Sans Condensed** (800) | Condensada y pesada, con aire de cartel. De 28 px hacia arriba |
| Todo lo demás | **Sofia Sans** | La misma familia en ancho normal. Escala 13, 15, 17 y 20 px |

Por qué: los sitios del sector que se ven con marca propia usan un titular con forma reconocible (condensado en HousingAnywhere, ancho en Spotahome) y un texto neutro. Una sola sans neutra para todo es lo que se ve genérico.

Descartadas por ser el default de páginas generadas o por verse genéricas en pruebas: Inter, DM Sans, Space Grotesk, Fraunces, Instrument Serif, Playfair, Bricolage Grotesque y Radio Canada Big.

El titular de la portada va en mayúsculas; es el único lugar. Se sirven desde el propio dominio (`@fontsource-variable`), sin llamadas a terceros.

## Contraste

Calculado al elegir la paleta; **pendiente de comprobar par por par** con el verificador de WebAIM.

| Par | Contraste aproximado |
| --- | --- |
| Tinta sobre blanco | 18:1 |
| Tinta secundaria sobre blanco | 6.9:1 |
| Blanco sobre azul pista | 6.5:1 |
| Blanco sobre verde | 5.3:1 |
| Borde de campos sobre blanco | 3.2:1 |

## Maquetación

- **Búsqueda:** resultados y mapa fijo; en móvil primero las viviendas, con filtros y mapa a pedido.
- **Ficha:** a la izquierda el contenido, en este orden: ¿es real?, ¿cuánto cuesta?, ¿quién me cuenta? A la derecha, precio, sello y acción; en móvil van arriba.
- **Tarjetas de vivienda:** foto y texto sobre el fondo, sin caja, con la insignia de revisiones recortada en la esquina de la foto. En la portada van en carrusel con chips de zona.
- **Administración:** primero lo que hay que atender.
- **Móvil:** cinco pestañas inferiores; lo demás, desde Cuenta.

Alineación a la izquierda en todo el producto.

## Movimiento

Corto y discreto, con tres duraciones en `tokens.css` (140, 240 y 520 ms) y una sola curva de salida.

- **Entrada:** cada pantalla aparece con un fundido corto. En la portada entran el titular, el buscador y los datos de confianza, uno tras otro.
- **Al desplazarse:** las bandas de la portada aparecen una sola vez al entrar en pantalla (`lib/reveal.ts`); zonas, mentores y pasos lo hacen escalonados.
- **Respuesta:** los botones se hunden al presionarlos, la foto de una tarjeta se acerca un poco al pasar el cursor, las zonas se elevan y los chips cambian de color sin saltos.
- **Carga:** zonas, viviendas, mentores y recibo muestran marcadores con la forma de lo que va a llegar.

Nada se mueve en bucle salvo los marcadores de carga. Todo respeta `prefers-reduced-motion`.

## Reglas para no caer en lo genérico

- Sin mayúsculas sostenidas, salvo el titular de la portada. Sin subtítulos decorativos sobre cada título.
- Sin degradados, sin sombras en las tarjetas, sin una cuadrícula de cajas idénticas para todo.
- Sin flechas en el texto de los botones; sin fuente monoespaciada; sin emojis como íconos (Phosphor).
- Sin números decorativos: solo se numera lo que es una secuencia.
- Sin borde de color a la izquierda en avisos ni tarjetas: un aviso es un panel con fondo de su tono y nada más.
- Sin etiquetas en píldora encima de cada tarjeta, sin mosaicos de colores distintos porque sí, y sin efectos al pasar el cursor en lo que no se puede pulsar.
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
| Miedo a transferir sin comprobar | La insignia de revisiones va sobre cada foto; aviso antes de solicitar |
| "Navegación sencilla y visual" | Una acción principal por pantalla; se ve sin iniciar sesión |
| Consejos que no aplican | Cada mentor muestra universidad y zona |
| El gasto de la luz sorprende | La ficha muestra el "costo real" además de la renta |
| Todo desde el celular | Móvil primero |

## Visualización de datos

La calculadora usa dos cifras grandes, una tabla y una barra de dos segmentos con etiqueta directa. Colores de esa barra: `#00917C` y `#E89B00`, validados con el script de `dataviz`. El ámbar queda por debajo de 3:1 contra el fondo; por eso cada segmento lleva etiqueta y hay tabla.

## Accesibilidad

Contraste AA, foco visible con contorno de 3 px, navegación por teclado, etiquetas en todos los campos, mensajes en `aria-live`, enlace para saltar al contenido, controles de 44 px y casillas de 24 px. El sello siempre incluye texto equivalente. Los pines del mapa no dependen solo del color: tienen leyenda, signo y título. Pendiente: lector de pantalla y zoom al 200%.
