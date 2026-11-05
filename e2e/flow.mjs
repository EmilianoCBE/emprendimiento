// Recorrido de punta a punta en Chrome. Requiere `npm run demo` con datos limpios: modifica los datos.
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
const S=process.argv[2]||'e2e/capturas'; mkdirSync(S,{recursive:true}); const base=process.env.BASE_URL||'http://localhost:4000'
const b=await chromium.launch({channel:'chrome',headless:true})
const issues=[]
async function open(name,who,w=1440,h=900){ const c=await b.newContext({viewport:{width:w,height:h},...(process.env.DEMO_ACCESS_PASSWORD?{httpCredentials:{username:'equipo',password:process.env.DEMO_ACCESS_PASSWORD}}:{})}); const p=await c.newPage();
 p.on('console',m=>{ if(m.type()==='error'&&!/401|422|409|403/.test(m.text())) issues.push(name+': '+m.text().slice(0,200)) }); p.on('pageerror',e=>issues.push(name+' PAGEERROR: '+String(e).slice(0,200)));
 if(who){ await p.goto(base+'/entrar'); await p.getByRole('button',{name:new RegExp(who)}).click(); await p.waitForURL(u=>!u.pathname.includes('entrar')) } return p }
const step=(s)=>console.log('ok  ',s)
const shot=(p,n,full=false)=>p.screenshot({path:`${S}/f-${n}.png`,fullPage:full})
const anon=await open('anon')
await anon.goto(base+'/'); await anon.getByRole('heading',{name:/Llega a Monterrey/}).waitFor(); await anon.waitForTimeout(1200); await shot(anon,'home'); step('portada con CSP real')
await anon.goto(base+'/viviendas'); await anon.locator('.leaflet-tile-loaded').first().waitFor({timeout:15000}); step('mapa con CSP real')
await anon.getByLabel('Solo con 4 revisiones').click(); await anon.waitForURL(/verifiedOnly/); step('filtro en URL')

const lucia=await open('lucia','lucia'); const marcela=await open('marcela','marcela')
await lucia.goto(base+'/viviendas?q=Estudio'); 
await lucia.goto(base+'/viviendas'); await lucia.getByRole('link',{name:/Cuarto con baño propio/}).click(); await lucia.getByRole('button',{name:'Solicitar vivienda'}).click()
await lucia.getByLabel('Preséntate').fill('Hola, soy Lucía de Madrid. Llego en enero para mi intercambio.'); 
assert.equal(await lucia.getByRole('button',{name:'Enviar solicitud'}).isDisabled(),true); step('no se envía sin aceptar aviso')
await shot(lucia,'request',true)
await lucia.getByLabel(/no voy a pagar por fuera/).click(); await lucia.waitForTimeout(100); await lucia.getByRole('button',{name:'Enviar solicitud'}).click(); await lucia.waitForURL(/solicitudes\//); await lucia.getByText('Solicitud enviada').first().waitFor(); step('solicitud creada')
const bookingUrl=lucia.url()
assert.equal(await lucia.getByText('Calle Demo').count(),0); step('dirección oculta antes de aceptar')
await lucia.getByLabel(/Carta de aceptación/).click(); await lucia.waitForFunction(()=>[...document.querySelectorAll('.task input')].some(i=>i.checked)); await lucia.waitForTimeout(500); await shot(lucia,'booking',true); step('lista para mudarte')

await marcela.goto(base+'/mis-viviendas'); await marcela.locator('.iconbtn').first().waitFor(); await marcela.waitForTimeout(800); await shot(marcela,'landlord')
await marcela.getByRole('button',{name:/Notificaciones/}).click(); await marcela.getByText('Nueva solicitud').first().waitFor(); step('notificación al arrendador')
await marcela.goto(bookingUrl); await marcela.getByRole('button',{name:'Agendar videollamada'}).click(); await marcela.getByLabel(/Fecha y hora/).fill('2026-12-15T17:00'); await marcela.getByRole('button',{name:'Confirmar videollamada'}).click(); await marcela.getByText('Videollamada agendada').first().waitFor(); step('videollamada')

// Chat en vivo entre dos ventanas
await lucia.reload(); await lucia.getByRole('link',{name:/Abrir el chat/}).click(); await lucia.waitForURL(/mensajes\//)
await marcela.goto(lucia.url()); await marcela.getByLabel('Escribe un mensaje').waitFor(); await lucia.getByLabel('Escribe un mensaje').waitFor(); await lucia.waitForTimeout(500)
await marcela.getByLabel('Escribe un mensaje').fill('Para apartar hazme una transferencia hoy, te paso la CLABE por WhatsApp'); await marcela.getByRole('button',{name:'Enviar'}).click()
await lucia.getByText(/Ten cuidado/).waitFor({timeout:6000}); step('mensaje en vivo por SSE, con aviso de estafa solo al destinatario')
assert.equal(await marcela.getByText(/Ten cuidado/).count(),0)
await shot(lucia,'chat')

await marcela.goto(bookingUrl); await marcela.getByRole('button',{name:'Aceptar solicitud'}).click(); await marcela.getByText('Aceptada').first().waitFor()
await lucia.goto(bookingUrl); await lucia.getByText(/Calle Demo/).waitFor(); step('dirección visible al aceptar')
await lucia.getByRole('button',{name:'Ya firmé el contrato'}).click(); await lucia.getByText('Contrato confirmado').first().waitFor(); step('contrato confirmado')

// Calculadora
await lucia.goto(base+'/presupuesto'); await lucia.getByText('Primer mes, con depósito').waitFor(); await lucia.waitForTimeout(600); await shot(lucia,'budget',true)
const before=await lucia.locator('.total__n').first().innerText(); await lucia.getByLabel('Mes de llegada').selectOption('1'); await lucia.waitForFunction(v=>document.querySelector('.total__n')?.innerText!==v,before); step('calculadora reacciona: '+before+' -> '+await lucia.locator('.total__n').first().innerText())
await lucia.goto(base+'/checklist'); await lucia.getByText('Calcula tu presupuesto').click(); await lucia.waitForTimeout(400); await lucia.getByText('1 de 14').waitFor(); await lucia.reload(); await lucia.getByText('1 de 14').waitFor(); step('checklist persiste')
await lucia.goto(base+'/mentores'); await lucia.getByRole('heading',{name:'Mentores'}).waitFor(); await lucia.waitForTimeout(500); await shot(lucia,'mentors')

// Conectar con mentora
await lucia.getByRole('article').filter({hasText:'Inés Moreau'}).getByRole('button',{name:'Escribirle'}).click(); await lucia.getByLabel('Tu primer mensaje').fill('Hola Inés, ¿cómo manejaste tus tarjetas al llegar?'); await lucia.getByRole('button',{name:'Enviar solicitud'}).click(); await lucia.waitForURL(/mensajes\//); step('solicitud a mentora')
const ines=await open('ines'); await ines.goto(base+'/entrar'); await ines.getByLabel('Correo').fill('ines@demo.aterriza.mx'); await ines.getByLabel('Contraseña').fill('Aterriza-Demo-2026'); await ines.getByRole('button',{name:'Entrar',exact:true}).click(); await ines.waitForURL(/mensajes/)
await ines.goto(lucia.url()); await ines.getByRole('button',{name:'Aceptar'}).click(); await ines.getByLabel('Escribe un mensaje').waitFor(); step('mentora acepta')

// Registro real
const nuevo=await open('nuevo'); await nuevo.goto(base+'/registro'); await nuevo.getByLabel('Nombre completo').fill('Ana Prueba'); await nuevo.getByLabel('Correo').fill('ana.prueba@tec.mx'); await nuevo.getByLabel('Contraseña').fill('cielo-azul-sobre-sierra'); await nuevo.getByLabel(/Acepto/).click(); await nuevo.waitForTimeout(100); await shot(nuevo,'register',true); await nuevo.getByRole('button',{name:'Crear cuenta'}).last().click(); await nuevo.waitForURL(/confirmar/)
const code=await nuevo.locator('.note b').innerText(); await nuevo.getByLabel('Código').fill(code); await nuevo.getByRole('button',{name:'Confirmar correo'}).click(); await nuevo.waitForURL(/cuenta/); await nuevo.getByLabel('Matrícula').fill('A01999888'); await nuevo.getByRole('button',{name:'Validar matrícula'}).click(); await nuevo.getByText(/Matrícula validada:/).waitFor(); step('registro, código y validación automática'); await shot(nuevo,'account')

// Arrendadora publica con foto; admin aprueba
await marcela.goto(base+'/mis-viviendas/nueva'); await marcela.getByLabel('Zona').selectOption({label:'Roma'}); await marcela.getByLabel('Título').fill('Cuarto de prueba en la colonia Roma'); await marcela.getByLabel('Descripción').fill('Cuarto luminoso con escritorio, cerca de la ruta de camión al campus.'); await marcela.getByLabel('Dirección exacta').fill('Calle Prueba 123, Col. Roma, Monterrey'); await marcela.getByRole('button',{name:'Guardar borrador'}).click(); await marcela.waitForURL(/mis-viviendas\/[0-9a-f-]{36}/); step('borrador')
// En la demo en línea (varias instancias, sin disco compartido) no se suben fotos: se comprueba el aviso.
if (await marcela.getByText('Fotos en la demo en línea').count()) { step('fotos desactivadas en la demo en línea, con aviso') }
else { await marcela.getByLabel('Agregar foto').setInputFiles(process.argv[3]||'apps/web/public/demo/cuarto-doble.jpg'); await marcela.locator('.photoedit img').first().waitFor(); assert.ok(await marcela.locator('.photoedit img').first().evaluate(i=>i.complete&&i.naturalWidth>0),'foto visible'); step('foto subida y visible') }
await marcela.getByRole('button',{name:'Enviar a revisión'}).click(); await marcela.getByText('La estamos revisando').waitFor(); await shot(marcela,'edit',true)
const admin=await open('admin','admin'); await admin.waitForTimeout(800); await shot(admin,'admin')
await admin.goto(base+'/admin/viviendas'); const item=admin.getByRole('article').filter({hasText:'Cuarto de prueba'}); for (const c of ['Documentos de propiedad','Identidad del arrendador','Contrato por escrito y recibos','Fotos con fecha']) { await item.getByLabel(c).click(); await admin.waitForTimeout(80) } await shot(admin,'queue',true); await item.getByRole('button',{name:'Aprobar'}).click(); await item.waitFor({state:'detached'}); step('admin aprueba')
await anon.goto(base+'/viviendas?q=Cuarto de prueba'); await anon.getByRole('link',{name:/Cuarto de prueba/}).waitFor(); step('ya aparece en la búsqueda')
await admin.goto(base+'/admin/bitacora'); await admin.getByText('Aprobó una vivienda').first().waitFor(); step('bitácora'); await admin.goto(base+'/admin/estudiantes'); await admin.getByText('Nadia Haddad').waitFor(); await admin.goto(base+'/admin/mentores'); await admin.getByText('Sofía Ibarra').waitFor(); step('colas de admin')
// Autorización en UI
await lucia.goto(base+'/admin'); await lucia.getByText('Esta sección es para otro tipo de cuenta').waitFor(); step('estudiante no entra a admin')
// Móvil
const m=await open('movil','lucia',390,844); await m.goto(base+'/mensajes'); await m.waitForTimeout(700); await shot(m,'m-messages'); await m.goto(base+'/presupuesto'); await m.waitForTimeout(800); await shot(m,'m-budget'); 
for (const path of ['/','/viviendas','/mentores','/presupuesto','/guias','/checklist','/solicitudes','/cuenta','/ayuda']){ await m.goto(base+path); await m.waitForTimeout(350); const o=await m.evaluate(()=>document.documentElement.scrollWidth-innerWidth); if(o>0) issues.push('overflow móvil '+path+': '+o) }
console.log('Problemas:',JSON.stringify(issues,null,1)); await b.close(); if(issues.length) process.exit(1)
