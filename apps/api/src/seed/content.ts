/**
 * Contenido inicial. Las guías son orientación general y deben validarlas personas con
 * experiencia antes del lanzamiento. Los montos son SUPUESTOS DE TRABAJO, no datos medidos (SUP-03).
 */

export const ZONES = [
  { slug: 'tecnologico', name: 'Tecnológico', lat: 25.6515, lng: -100.2875, transit: 'Se llega a pie al campus. Es la zona con menos dependencia del coche.', life: 'Mucha vida estudiantil, comida y servicios a pocas cuadras. Suele ser la zona más solicitada.' },
  { slug: 'altavista', name: 'Altavista', lat: 25.6425, lng: -100.2815, transit: 'A pie es un trayecto largo; hay rutas de camión y transporte privado en minutos.', life: 'Residencial y tranquila, con casas compartidas por estudiantes.' },
  { slug: 'roma', name: 'Roma', lat: 25.6645, lng: -100.2845, transit: 'Conviene planear el traslado en horas pico.', life: 'Colonia establecida con opciones más accesibles y comercios locales.' },
  { slug: 'contry', name: 'Contry', lat: 25.6295, lng: -100.2765, transit: 'Depende de avenidas con tráfico en horas pico. Prueba tu ruta antes de decidir.', life: 'Supermercados y servicios cerca. Edificios más nuevos.' },
  { slug: 'nuevo-repueblo', name: 'Nuevo Repueblo', lat: 25.6665, lng: -100.2975, transit: 'Trayecto largo a pie; conviene combinar camión y transporte privado.', life: 'Cerca del centro de la ciudad. Rentas más bajas que junto al campus.' },
] as const

export const COST_ASSUMPTIONS = [
  { key: 'electricity_hot_ac', amount: 1400, label: 'Luz con aire en calor', note: 'Supuesto del equipo; validar con recibos reales.' },
  { key: 'electricity_mild', amount: 450, label: 'Luz sin aire', note: 'Supuesto del equipo.' },
  { key: 'internet', amount: 450, label: 'Internet', note: 'Supuesto del equipo.' },
  { key: 'transport_near', amount: 500, label: 'Transporte, zona cercana', note: 'Supuesto del equipo.' },
  { key: 'transport_far', amount: 1400, label: 'Transporte, zona lejana', note: 'Supuesto del equipo; incluye traslados privados ocasionales.' },
  { key: 'food', amount: 4000, label: 'Comida', note: 'Supuesto del equipo.' },
  { key: 'phone', amount: 300, label: 'Línea de celular', note: 'Supuesto del equipo.' },
  { key: 'bank_fees', amount: 350, label: 'Comisiones bancarias', note: 'Supuesto del equipo; depende del banco de origen.' },
  { key: 'setup', amount: 2500, label: 'Instalación inicial', note: 'Supuesto del equipo.' },
] as const

const CONFIRM = 'Esta guía es orientación general. Confirma los detalles con tu oficina de movilidad y las autoridades correspondientes.'

export const GUIDES = [
  {
    slug: 'como-reconocer-una-estafa', category: 'Vivienda y contratos', title: 'Cómo reconocer un anuncio falso',
    summary: 'Las señales más comunes y qué hacer antes de transferir dinero.',
    body: `Casi todas las estafas de renta siguen el mismo guion: un precio atractivo, prisa por decidir y un pago "para apartar" antes de que veas nada.

## Señales de alerta
- La renta está muy por debajo de lo que cuesta la zona.
- Te presionan: "hay más interesados, decide hoy".
- Piden transferencia o depósito antes de la videollamada o del contrato.
- No quieren mostrar el interior en vivo.
- Se niegan a dar recibo o exigen solo efectivo.
- Las fotos aparecen en otros anuncios con otra dirección.

## Qué hacer
- Pide una videollamada en vivo y solicita que muestren algo específico, como abrir una ventana o una llave de agua.
- Pide contrato por escrito antes de pagar. Lee quién firma y comprueba que coincide con quien te atiende.
- Paga por un medio que deje rastro y exige recibo.
- Si algo no te cuadra, repórtalo aquí y pregunta a un mentor.

## Si ya pagaste
Guarda capturas, comprobantes y datos del anuncio. Contacta a tu banco de inmediato, avisa a tu oficina de movilidad y presenta una denuncia.`,
  },
  {
    slug: 'que-revisar-en-un-contrato', category: 'Vivienda y contratos', title: 'Qué revisar en tu contrato de renta',
    summary: 'Los puntos que evitan sorpresas el día que llegas.',
    body: `Un contrato claro es tu mejor protección. Una de las quejas en las entrevistas fue que las condiciones cambiaron el día de llegada.

## Antes de firmar, confirma
- Nombre del arrendador y dirección exacta.
- Fechas de entrada y salida, y qué pasa si te vas antes.
- Monto de la renta, día de pago y forma de pago.
- Monto del depósito y en qué casos se devuelve.
- Qué servicios incluye la renta y si hay un límite de consumo.
- Quién paga las reparaciones.
- Inventario de muebles. Toma fotos al entrar.

## Recomendaciones
- Pide el contrato en un idioma que entiendas o busca quién te ayude a revisarlo.
- Guarda una copia firmada en tu correo.
- Pide recibo por cada pago, también por el depósito.

${CONFIRM}`,
  },
  {
    slug: 'dinero-tarjetas-y-comisiones', category: 'Dinero', title: 'Dinero, tarjetas y comisiones',
    summary: 'Cómo organizar tu dinero en otra moneda sin perder de más.',
    body: `Las comisiones parecen pequeñas hasta que se suman. Organízate antes de viajar.

## Antes de viajar
- Pregunta a tu banco por comisiones de retiro y de pago en el extranjero.
- Avisa a tu banco de tu viaje para que no bloquee tu tarjeta.
- Lleva dos formas de pago y algo de efectivo para los primeros días.

## Una vez aquí
- Usa cajeros dentro de sucursales bancarias.
- Si la terminal te ofrece cobrar en tu moneda, compara: suele convenir pagar en pesos mexicanos.
- Ten efectivo para comercios pequeños y transporte.
- Si te quedas varios meses, compara si conviene abrir una cuenta local.

${CONFIRM}`,
  },
  {
    slug: 'el-recibo-de-luz-en-monterrey', category: 'Dinero', title: 'El recibo de luz en Monterrey',
    summary: 'Por qué sorprende y cómo evitar que se dispare.',
    body: `Este fue el gasto inesperado más mencionado por los estudiantes internacionales entrevistados. El calor de Monterrey es intenso y el aire acondicionado consume mucha energía.

## Pregunta antes de firmar
- ¿La luz está incluida? ¿Hay un tope?
- ¿Cuánto se pagó en los últimos meses de calor?
- ¿El recibo se divide entre roomies? ¿Cómo?

## Para gastar menos
- Sube un poco la temperatura del aire en vez de apagarlo y encenderlo.
- Usa el ventilador cuando puedas.
- Cierra cortinas en las horas de más sol.

Usa la calculadora para ver cómo cambia tu presupuesto según tu mes de llegada.`,
  },
  {
    slug: 'moverte-sin-coche', category: 'Movilidad', title: 'Moverte en Monterrey sin coche',
    summary: 'Es una ciudad pensada para el coche, pero se puede.',
    body: `"Monterrey es una ciudad diseñada para andar en coche." Lo dijo una estudiante en nuestras entrevistas, así que planea tu traslado antes de elegir vivienda.

## Tus opciones
- A pie: la mejor si vives junto al campus. Considera el calor en verano.
- Camión urbano: económico; pregunta a un mentor por la ruta desde tu zona.
- Metro: útil si tu trayecto coincide con sus líneas.
- Transporte por aplicación: práctico en la noche, pero sube mucho tu presupuesto si es diario.

## Antes de decidir
- Prueba tu ruta en la hora en que tendrías clase.
- Pregunta a un mentor que haya vivido en esa zona.
- Suma el costo de transporte a la renta: una renta baja lejos puede salir más cara.`,
  },
  {
    slug: 'del-aeropuerto-a-tu-vivienda', category: 'Movilidad', title: 'Del aeropuerto a tu vivienda',
    summary: 'Qué tener listo para tu primer trayecto en la ciudad.',
    body: `El primer trayecto es más fácil si lo resuelves antes de abordar.

## Antes de volar
- Guarda la dirección exacta y el teléfono de tu vivienda sin depender de internet.
- Acuerda con tu arrendador la hora de llegada y cómo recibirás las llaves.
- Revisa si tu línea funcionará al aterrizar; si no, ubica una red de internet en el aeropuerto.
- Compara las opciones de transporte oficiales del aeropuerto y las apps de viaje.

## Al llegar
- Usa solo transporte identificado y confirma el costo antes de salir.
- Comparte tu trayecto con alguien de confianza.
- Revisa la vivienda contra tu contrato antes de instalarte y toma fotos.

Tu mentor te puede decir qué le funcionó a quien ya hizo este trayecto.`,
  },
  {
    slug: 'tramites-de-llegada', category: 'Trámites', title: 'Trámites antes y después de llegar',
    summary: 'Una lista para no olvidar lo importante.',
    body: `Los requisitos cambian según tu país y tu programa, así que empieza pronto y confirma cada punto con tu oficina de movilidad.

## Antes de viajar
- Carta de aceptación de la universidad.
- Visa o documento migratorio que te corresponda, si aplica.
- Seguro médico con la cobertura que pide tu universidad.
- Convalidación de materias con tu coordinador.
- Copias digitales de tus documentos.

## La primera semana
- Regístrate con tu oficina de movilidad.
- Sigue las instrucciones de tu documento migratorio y sus plazos.
- Consigue una línea de celular local.
- Ubica tu clínica u hospital más cercano.

${CONFIRM}`,
  },
  {
    slug: 'salud-y-emergencias', category: 'Salud', title: 'Salud y emergencias',
    summary: 'Qué tener listo antes de necesitarlo.',
    body: `Es mucho más fácil resolver esto antes de una emergencia.

## Ten a la mano
- El número de emergencias en México: 911.
- Tu póliza de seguro y su teléfono de atención.
- La dirección exacta de tu vivienda, en tu celular.
- Un contacto de confianza en la ciudad.

## Prepárate
- Ubica un hospital y una farmacia cerca de casa.
- Pregunta a tu aseguradora qué hospitales están en su red.
- Trae tus medicamentos con receta si tomas alguno.
- Toma agua y cuídate del sol: el calor puede ser extremo.`,
  },
  {
    slug: 'tu-primera-semana', category: 'Vida diaria', title: 'Tu primera semana',
    summary: 'Lo que otros estudiantes desearían haber sabido.',
    body: `La primera semana se siente menos pesada si ya sabes qué sigue. Estos fueron los obstáculos más mencionados: el horario, la comida, el clima, la forma de hablar y moverse por la ciudad.

## Para empezar con el pie derecho
- Revisa la vivienda con tu contrato en la mano y toma fotos.
- Compra lo básico: ropa de cama, utensilios y agua.
- Prueba tu ruta al campus antes de tu primera clase.
- Habla con tu mentor: una plática te ahorra muchas búsquedas.
- Busca actividades de tu universidad para conocer gente.

## Recuerda
Sentirte desubicado al inicio es normal. Si la soledad o el estrés te pesan, pide apoyo a tu universidad: también es parte de cuidarte.`,
  },
] as const

export const CHECKLIST = [
  { id: 'budget', phase: 'before', title: 'Calcula tu presupuesto del primer mes', hint: 'Incluye depósito, luz, transporte y comisiones.' },
  { id: 'housing', phase: 'before', title: 'Elige una vivienda verificada', hint: 'Revisa los cuatro puntos del sello y las reseñas.' },
  { id: 'videocall', phase: 'before', title: 'Haz una videollamada antes de comprometerte', hint: 'Pide que te muestren el lugar en vivo.' },
  { id: 'contract', phase: 'before', title: 'Revisa tu contrato y pide recibos', hint: 'Confirma qué incluye la renta y cómo se paga.' },
  { id: 'mentor', phase: 'before', title: 'Habla con un mentor de tu zona', hint: 'Sus consejos aplican a tu campus y tu colonia.' },
  { id: 'insurance', phase: 'before', title: 'Contrata el seguro médico que pide tu universidad', hint: 'Revisa la cobertura mínima.' },
  { id: 'documents', phase: 'before', title: 'Reúne tus documentos', hint: 'Visa si aplica, carta de aceptación y convalidación.' },
  { id: 'cash', phase: 'before', title: 'Define cómo vas a pagar', hint: 'Tarjeta, efectivo y comisiones de tu banco.' },
  { id: 'inventory', phase: 'week1', title: 'Revisa la vivienda y toma fotos', hint: 'Te protege al recuperar tu depósito.' },
  { id: 'sim', phase: 'week1', title: 'Consigue una línea de celular local', hint: 'La necesitas para transporte y contactos.' },
  { id: 'route', phase: 'week1', title: 'Prueba tu ruta al campus', hint: 'Hazlo en la hora en que tendrías clase.' },
  { id: 'bank', phase: 'week1', title: 'Ubica banco y cajeros seguros', hint: 'De preferencia dentro de sucursales.' },
  { id: 'clinic', phase: 'week1', title: 'Ubica tu clínica u hospital', hint: 'Ten a la mano los datos de tu seguro.' },
  { id: 'office', phase: 'week1', title: 'Regístrate con tu oficina de movilidad', hint: 'Pregunta por trámites y plazos.' },
] as const
