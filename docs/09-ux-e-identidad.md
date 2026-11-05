# 09 · UX e identidad visual

## Idea

Aterrizar en una ciudad que no conoces. Dos imágenes propias del tema guían todo:

1. **El sello de pasaporte.** Es el elemento memorable: un sello circular en tinta añil con cuatro segmentos, uno por criterio de verificación. No decora: **es el dato**. Una vivienda con 2 de 4 muestra un sello con dos segmentos entintados.
2. **El Cerro de la Silla.** La silueta que identifica a Monterrey es el horizonte de la portada; ubica al producto en este lugar y en ningún otro.

La señalización de aeropuerto aporta el resto: letra alta y condensada, alto contraste, indicaciones directas.

## Tokens

| Nombre | Hex | Uso |
| --- | --- | --- |
| Agave | `#E8EEE6` | Fondo general |
| Papel | `#FBFCF9` | Superficies |
| Sierra | `#0F2F2E` | Texto, barra de navegación |
| Cempasúchil | `#FFB400` | Acción principal, con texto Sierra |
| Añil | `#3A2FC4` | **Solo** verificación y enlaces (la tinta del sello) |
| Chile | `#B3261E` | Peligro y alertas de estafa |
| Nopal | `#1F7A4D` | Criterio cumplido, incluido en la renta |

## Tipografía

| Rol | Fuente | Por qué |
| --- | --- | --- |
| Títulos y cifras | **Big Shoulders Display** (700–800) | Condensada y alta, como un letrero de aeropuerto; permite precios grandes en tarjetas angostas |
| Texto | **Atkinson Hyperlegible Next** | Diseñada para máxima legibilidad; ayuda a quien lee en su segundo idioma |

Se sirven desde el propio dominio (`@fontsource`), sin llamadas a terceros.

## Maquetación

- **Búsqueda:** resultados a la izquierda y mapa fijo a la derecha; en móvil se alterna lista y mapa.
- **Ficha:** contenido a la izquierda; a la derecha un panel fijo con precio, sello y acción. Lectura en este orden: ¿es real?, ¿cuánto cuesta de verdad?, ¿quién me puede contar?
- **Tarjetas de vivienda:** foto + texto sobre el fondo, sin caja ni sombra. La jerarquía la da el precio grande.
- **Móvil:** barra de pestañas inferior; todo se puede usar con el pulgar.

Alineación a la izquierda en todo el producto. Radios por jerarquía: fotos 4 px, botones 6 px, sello circular.

## Movimiento

Un único momento no solicitado: el sello cae sobre la portada al cargar la página. El resto solo responde a acciones. Todo respeta `prefers-reduced-motion`.

## Reglas para no caer en lo genérico

- Sin mayúsculas sostenidas en etiquetas, sin subtítulos decorativos sobre cada título.
- Sin degradados, sin sombra gris uniforme, sin una cuadrícula de tarjetas idénticas para todo.
- Sin flechas en el texto de los botones; sin fuente monoespaciada.
- Sin números decorativos: solo se numera lo que es una secuencia (línea de tiempo, checklist).
- Añil solo donde se comunica verificación o un enlace.

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
| Miedo a transferir sin comprobar | El sello aparece antes que las fotos en importancia; aviso antes de solicitar |
| "Navegación sencilla y visual" | Una acción principal por pantalla; se ve sin iniciar sesión |
| Consejos que no aplican | Cada mentor muestra universidad y zona |
| El gasto de la luz sorprende | La ficha muestra el "costo real" además de la renta |
| Todo desde el celular | Móvil primero |

## Visualización de datos

La calculadora usa dos cifras grandes, una tabla y una barra de dos segmentos con etiqueta directa. Colores de esa barra: `#00917C` y `#E89B00`, validados con el script de `dataviz`. El ámbar queda por debajo de 3:1 contra el fondo; por eso cada segmento lleva etiqueta y hay tabla.

## Accesibilidad

Contraste AA, foco visible con contorno de 3 px, navegación por teclado, etiquetas en todos los campos, mensajes en `aria-live`, enlace para saltar al contenido, objetivos táctiles de 44 px. El sello siempre incluye texto equivalente.
