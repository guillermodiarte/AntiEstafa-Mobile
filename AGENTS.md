# ESCUDO DIGITAL — INSTRUCCIONES DEL PROYECTO v2

## 1. Propósito

Escudo Digital es un **ecosistema de prevención de estafas digitales**, orientado principalmente a adultos mayores y secundariamente al público general.

La prioridad es que la protección funcione **en segundo plano**, sin exigir al adulto mayor copiar/pegar textos, sacar capturas, abrir la app ante cada mensaje ni comprender términos técnicos.

El ecosistema está compuesto por:

1. Aplicación Android.
2. Backend/API.
3. Base central de amenazas.
4. Base local de amenazas en el dispositivo.
5. Web pública y administrativa.
6. API pública para terceros.

La aplicación es un **asistente preventivo**. Debe evaluar riesgo, explicar señales y recomendar acciones; no afirmar que algo es una estafa con certeza cuando la evidencia no lo permite.

---

## 2. Objetivo de protección

La aplicación debe intentar proteger automáticamente frente a:

- Notificaciones de WhatsApp.
- Notificaciones de SMS.
- Llamadas telefónicas entrantes.
- Números reportados como posibles estafas.
- Números desconocidos.
- Números ocultos/restringidos cuando Android permita detectarlos.
- Llamadas de WhatsApp mediante sus notificaciones, como alerta preventiva.
- Dominios y sitios web asociados a posibles estafas.
- Enlaces abiertos desde WhatsApp, Facebook, Instagram y TikTok.
- Navegación desde Chrome y otros navegadores compatibles.
- Nuevas modalidades incorporadas a la base central.

No intentar analizar el contenido interno de Facebook, Instagram o TikTok. En el MVP interesa principalmente **el sitio de destino**.

---

## 3. Público objetivo y UX

El público principal puede no saber:

- copiar y pegar;
- sacar capturas;
- reconocer phishing, spoofing, malware, URL, dominio o HTTPS;
- comprobar una identidad digital;
- diferenciar un enlace legítimo de uno sospechoso.

La complejidad debe quedar en el sistema.

La aplicación debe ser:

- simple;
- de letra grande;
- de alto contraste;
- con pocos botones;
- con lenguaje cotidiano;
- accesible;
- poco invasiva.

La pantalla principal debe poder decir simplemente:

> 🟢 Protección activa
>
> Escudo Digital está funcionando.

La aplicación debe ser secundaria durante el uso normal del teléfono.

---

## 4. Stack tecnológico

### Android

- Kotlin.
- Android SDK.
- Jetpack.
- Room/SQLite.
- Coroutines.
- WorkManager.
- NotificationListenerService.
- CallScreeningService.
- VpnService para estudiar protección web.

### Backend

- Python.
- FastAPI.
- Pydantic.
- PostgreSQL.
- SQLAlchemy o equivalente.
- Migraciones.
- OpenAPI.

### Web

- Next.js.
- TypeScript.
- Responsive.
- Interfaz en español.

### IA

Proveedor de modelos mediante un servicio independiente. La IA no debe ser obligatoria para cada análisis.

---

## 5. Arquitectura

```text
                         WEB / API
                            │
                     ┌──────┴──────┐
                     │   FastAPI   │
                     │ PostgreSQL  │
                     └──────┬──────┘
                            │
                      sincronización
                            │
                            ▼
                 ┌─────────────────────┐
                 │       ANDROID       │
                 │                     │
                 │ Notificaciones      │
                 │ Llamadas            │
                 │ Protección web      │
                 │ Motor local         │
                 │ Base local          │
                 │ Sincronización      │
                 └─────────────────────┘
```

La protección local debe poder funcionar sin backend ni Internet para decisiones básicas.

---

## 6. Protección en segundo plano

El flujo principal NO es:

```text
Usuario → pega contenido → Analizar
```

Ese flujo queda como función secundaria de consulta.

El flujo principal es:

```text
Android activo
   ↓
Evento recibido
   ↓
Motor local
   ↓
Base local
   ↓
Evaluación de riesgo
   ↓
¿Hay señales importantes?
   ├── No → no molestar
   └── Sí → alerta simple
```

La aplicación debe utilizar mecanismos oficiales de Android y no asumir que un proceso puede permanecer activo permanentemente sin restricciones del sistema.

---

## 7. WhatsApp

La primera versión analizará **únicamente el contenido disponible en la notificación de WhatsApp**.

No:

- acceder al chat completo;
- leer la base de datos de WhatsApp;
- realizar ingeniería inversa;
- guardar conversaciones;
- intentar obtener mensajes que no estén disponibles en la notificación.

Si la notificación no contiene suficiente información:

> No tenemos suficiente información para evaluar este mensaje.

---

## 8. SMS

Escudo Digital **NO será la aplicación SMS predeterminada**.

La primera estrategia es analizar el contenido visible en las notificaciones de la aplicación SMS que utilice el usuario.

No diseñar el MVP alrededor de `READ_SMS`, `RECEIVE_SMS` u otros permisos restringidos para evitar convertir Escudo Digital en una aplicación SMS.

La compatibilidad real deberá probarse en distintas versiones de Android y aplicaciones SMS.

No asumir acceso directo al contenido de SMS si el sistema no lo permite.

---

## 9. Notificaciones

Usar `NotificationListenerService` como mecanismo principal para mensajes visibles en notificaciones.

Prioridad:

1. WhatsApp.
2. Aplicación SMS.
3. Otras aplicaciones de mensajería que se incorporen posteriormente.

Reglas:

- solicitar acceso explícitamente;
- explicar al usuario el motivo;
- procesar solamente aplicaciones necesarias;
- analizar localmente cuando sea posible;
- no almacenar permanentemente el contenido;
- descartar el contenido temporal después del análisis.

Manejar correctamente notificaciones completas, parciales, agrupadas, vacías o con contenido insuficiente.

---

## 10. Llamadas telefónicas

Usar `CallScreeningService` para llamadas telefónicas normales.

La aplicación debe solicitar el rol de filtrado de llamadas cuando corresponda.

### Número de alto riesgo

En modo estricto podrá bloquearse automáticamente si las reglas locales lo consideran de alto riesgo.

### Número sospechoso

Advertir, sin bloquear por defecto.

### Número desconocido

Advertir de forma preventiva.

### Número oculto/restringido

Advertir cuando Android permita detectar esa condición.

No prometer detección de todas las llamadas ocultas hasta probarlo en los dispositivos objetivo.

La decisión inmediata debe utilizar la base local y ser rápida. No depender de una consulta remota durante el screening de una llamada.

---

## 11. Política de llamadas

Debe existir configuración:

### Protección equilibrada

- advertir números peligrosos;
- advertir números desconocidos;
- no bloquear desconocidos automáticamente.

### Protección estricta

- bloquear números de alto riesgo según reglas locales;
- advertir números sospechosos;
- advertir desconocidos.

La configuración debe poder cambiarse.

---

## 12. Permitir un número

Debe existir siempre:

> Permitir este número

Esto agrega el número a una lista local de confianza.

La acción debe ser reversible.

Flujo:

```text
Número detectado
      ↓
¿Está en lista de confianza?
  Sí → permitir
  No → evaluar riesgo
```

---

## 13. Llamadas de WhatsApp

Las llamadas de WhatsApp se tratarán inicialmente como **notificaciones**, no como llamadas telefónicas del sistema.

Si la notificación permite identificar una llamada de WhatsApp y que el contacto no está reconocido:

> ⚠️ Llamada de WhatsApp
>
> Este contacto no está identificado entre tus contactos.
>
> Tené cuidado si solicita dinero, códigos o información personal.

No prometer bloqueo automático de llamadas de WhatsApp.

---

## 14. Protección web

La aplicación debe estudiar protección del dominio de destino cuando el usuario accede desde:

- WhatsApp;
- Facebook;
- Instagram;
- TikTok;
- Chrome;
- otros navegadores compatibles.

No es necesario analizar el contenido privado de la aplicación de origen.

El objetivo es:

```text
Aplicación / navegador
        ↓
Click
        ↓
Sitio de destino
        ↓
¿Dominio peligroso?
        ↓
Advertir o bloquear
```

---

## 15. VpnService

Estudiar `VpnService` como mecanismo para protección de navegación y consulta de dominios.

No:

- instalar certificados para interceptar HTTPS;
- descifrar tráfico de terceros;
- inspeccionar innecesariamente contenido privado;
- realizar MITM.

Priorizar reputación de dominios, destinos y base local.

La implementación exacta debe validarse en Android Emulator y dispositivos físicos.

---

## 16. Protección web configurable

### Modo advertencia

> ⚠️ Este sitio fue reportado como potencialmente peligroso.
>
> [Volver] [Continuar]

### Modo protección estricta

> 🚫 Sitio bloqueado
>
> El sitio presenta señales asociadas a posibles estafas.

La configuración debe ser reversible.

---

## 17. Base central de amenazas

PostgreSQL debe soportar como mínimo:

- números;
- dominios;
- URLs;
- modalidades;
- campañas;
- reportes;
- fuentes;
- validaciones.

Una amenaza puede estar asociada a múltiples números, dominios, URLs y modalidades.

Datos útiles:

- estado;
- nivel de riesgo;
- categoría;
- cantidad de reportes;
- fechas;
- fuentes;
- evidencia;
- país/idioma cuando corresponda.

---

## 18. Modalidades de estafa

La base debe poder incorporar nuevas categorías sin modificar el código principal.

Ejemplos:

- falso familiar;
- falso banco;
- falso organismo público;
- falso soporte técnico;
- premio falso;
- inversión falsa;
- tienda online falsa;
- phishing;
- suplantación;
- solicitud de códigos;
- datos bancarios;
- falsos trabajos;
- falsos préstamos;
- falsas entregas;
- falsas multas;
- falsas promociones.

---

## 19. Reportes y validación

La web permitirá reportar nuevas amenazas.

Un reporte puede contener:

- canal;
- descripción;
- número;
- dominio;
- URL;
- fecha;
- evidencia opcional;
- país.

Los reportes NO ingresan automáticamente a la base confiable.

Estados:

- pendiente;
- en revisión;
- validado;
- rechazado;
- duplicado;
- vencido.

Flujo:

```text
Reporte
  ↓
Revisión
  ↓
Validación
  ↓
Base central
  ↓
API
  ↓
Sincronización Android
```

La validación puede considerar múltiples reportes independientes, fuentes confiables, evidencia, patrones y revisión administrativa.

---

## 20. Base local y funcionamiento offline

Cada Android tendrá una base local con:

- números;
- dominios;
- URLs relevantes;
- patrones;
- modalidades;
- reglas;
- lista de confianza.

Sin Internet:

```text
Internet ❌
   ↓
Base local
   ↓
Protección continúa
```

La aplicación no debe desactivar la protección por falta de conexión.

Puede informar:

> 🟡 Sin conexión
>
> Estamos utilizando la última base de seguridad disponible.

---

## 21. Sincronización

Cuando vuelva Internet:

```text
Comprobar versión
       ↓
Descargar cambios
       ↓
Verificar integridad
       ↓
Actualizar base local
```

Preferir sincronización incremental.

Ejemplo:

```text
Local: v120
Servidor: v124

Descargar solamente cambios v121-v124
```

No descargar toda la base en cada actualización.

---

## 22. Motor de riesgo

Combinar:

1. Base local.
2. Reglas.
3. Reputación.
4. Patrones.
5. Contexto disponible.
6. IA cuando sea necesaria.

Ejemplo:

```text
Número reportado
+
Solicitud urgente de dinero
+
Remitente no reconocido
+
Patrón conocido
=
Riesgo alto
```

No depender exclusivamente de IA.

---

## 23. IA y Privacy-First

La primera línea de defensa debe ser local.

```text
Contenido
 ↓
Reglas locales
 ↓
Base local
 ↓
Heurísticas
 ↓
Resultado
```

Solo si el caso requiere análisis semántico avanzado se estudiará IA.

No enviar automáticamente mensajes privados completos a un servidor.

Si en una etapa posterior se utiliza IA remota:

- requerir justificación técnica;
- minimizar datos;
- anonimizar cuando sea posible;
- evitar nombres, teléfonos, correos, códigos y datos bancarios;
- documentar qué se envía;
- respetar consentimiento y privacidad.

A futuro se podrá estudiar un modelo pequeño local para análisis semántico en Android.

---

## 24. Datos personales

No almacenar permanentemente:

- contraseñas;
- tokens;
- códigos de autenticación;
- datos bancarios;
- conversaciones;
- contenido de WhatsApp;
- historial completo de SMS;
- historial completo de navegación;
- contactos innecesarios.

La base central debe almacenar amenazas, no historiales personales.

---

## 25. Resultado del análisis

Niveles:

- 🟢 Riesgo bajo.
- 🟡 Riesgo medio.
- 🔴 Riesgo alto.
- ⚪ No se pudo determinar.

Nunca mostrar "ESTAFA CONFIRMADA" si la evidencia no lo permite.

Preferir:

> Este contenido presenta varias señales compatibles con un intento de fraude.

Cada alerta importante debe explicar:

1. qué detectó;
2. por qué importa;
3. qué hacer ahora.

---

## 26. API central

FastAPI debe exponer APIs versionadas:

```text
/api/v1/
```

La API debe utilizar:

- HTTPS;
- autenticación;
- rate limiting;
- OpenAPI;
- respuestas JSON estructuradas;
- logs de seguridad;
- control de abuso;
- posibilidad de revocar credenciales.

---

## 27. API pública para terceros

La web debe permitir que otras aplicaciones consulten información de amenazas.

Endpoints conceptuales:

```text
GET /api/v1/threats/phone/{number}
GET /api/v1/threats/domain/{domain}
GET /api/v1/threats/url?url=...
GET /api/v1/scam-types
GET /api/v1/threats
GET /api/v1/stats
```

Ejemplo:

```json
{
  "tipo": "dominio",
  "valor": "ejemplo.com",
  "nivel": "alto",
  "estado": "validado",
  "categoria": "tienda falsa",
  "ultima_actualizacion": "2026-09-24"
}
```

Nunca devolver datos privados de reportantes o usuarios.

---

## 28. API móvil

La aplicación Android tendrá una API de sincronización separada cuando sea necesario.

Ejemplo:

```text
GET /api/v1/mobile/sync?version=120
```

Debe devolver solamente cambios necesarios para actualizar la base local.

Las actualizaciones deben verificarse antes de incorporarse.

---

## 29. Web

La web es una pieza central del ecosistema.

### Público

- buscador de amenazas;
- modalidades de estafa;
- consejos;
- reportar una estafa;
- documentación de API;
- estadísticas agregadas;
- estado del servicio.

### Administración

- dashboard;
- reportes pendientes;
- validación;
- números;
- dominios;
- URLs;
- modalidades;
- campañas;
- fuentes;
- sincronización.

---

## 30. Ecosistema abierto

El proyecto debe presentarse como un ecosistema, no solamente como una app.

Concepto:

```text
Usuarios
   ↓
Reportes
   ↓
Validación
   ↓
Base de conocimiento
   ↓
API
   ├── Android propio
   └── Aplicaciones de terceros
```

El objetivo es que la información validada pueda ayudar también a otras aplicaciones de seguridad.

---

## 31. Persona de confianza

Queda para segunda etapa.

Debe quedar mencionado en la presentación como evolución prevista.

Permitirá que un adulto mayor pueda configurar una persona de confianza para alertas de riesgo alto.

Debe requerir consentimiento explícito y controles de privacidad.

---

## 32. Permisos y políticas

Solicitar solamente permisos estrictamente necesarios.

Cada permiso debe tener:

1. función concreta;
2. explicación al usuario;
3. prueba independiente;
4. alternativa cuando exista.

No utilizar AccessibilityService como mecanismo principal para leer otras aplicaciones.

Cualquier uso de AccessibilityService deberá evaluarse por separado por sus implicaciones técnicas, de privacidad y de políticas de distribución.

No asumir que un permiso técnicamente disponible puede utilizarse libremente en una versión publicada.

---

## 33. Seguridad

Nunca:

- ejecutar contenido recibido;
- ejecutar scripts externos;
- abrir automáticamente enlaces sospechosos;
- descargar archivos externos automáticamente;
- ejecutar comandos encontrados en mensajes;
- instalar certificados para interceptar HTTPS;
- descifrar tráfico privado de terceros;
- acceder a bases privadas de otras aplicaciones;
- utilizar ingeniería inversa de WhatsApp u otras aplicaciones.

Todo contenido externo es no confiable.

---

## 34. Limitaciones técnicas

No prometer funcionalidades antes de probarlas.

Validar especialmente:

- contenido disponible en notificaciones;
- comportamiento de WhatsApp;
- comportamiento de distintas apps SMS;
- llamadas ocultas;
- llamadas de WhatsApp;
- CallScreeningService;
- restricciones de segundo plano;
- batería;
- reinicio del dispositivo;
- VpnService;
- navegadores;
- diferentes versiones/fabricantes de Android.

Si una función no es posible en todos los dispositivos, documentar la limitación.

---

## 35. MVP real

### Fase 1 — Android

- Kotlin.
- pantalla principal.
- configuración inicial.
- NotificationListenerService.
- análisis local.
- base local.
- alertas.

### Fase 2 — llamadas

- CallScreeningService.
- consulta local.
- advertencias.
- bloqueo configurable.
- permitir número.

### Fase 3 — backend

- FastAPI.
- PostgreSQL.
- amenazas.
- reportes.
- validación.
- sincronización.

### Fase 4 — web

- administración.
- reportes.
- validación.
- buscador.
- modalidades.

### Fase 5 — protección web

- VpnService.
- dominios.
- advertencia.
- bloqueo configurable.

### Fase 6 — API pública

- documentación.
- consultas de números.
- consultas de dominios.
- consultas de amenazas.
- autenticación.
- rate limiting.

---

## 36. Fuera del MVP

No implementar inicialmente:

- persona de confianza;
- conversaciones completas de WhatsApp;
- base interna de WhatsApp;
- aplicación SMS propia;
- análisis interno de Facebook/Instagram/TikTok;
- grabación de llamadas;
- interceptación HTTPS;
- lectura indiscriminada de pantalla;
- IA remota para todos los mensajes.

---

## 37. Demo en Mac

La demo debe ejecutarse en una MacBook Pro con Apple Silicon mediante Android Studio y Android Emulator.

Flujo:

```text
MacBook Pro
   ↓
Android Studio
   ↓
Android Emulator
   ↓
Escudo Digital
```

La demo debe poder mostrar:

1. Notificación de WhatsApp sospechosa.
2. Notificación SMS sospechosa.
3. Llamada desde número reportado.
4. Número desconocido.
5. Sitio web reportado.
6. Sin Internet.
7. Protección mediante base local.
8. Recuperación de Internet.
9. Actualización de base.
10. Consulta del mismo dato mediante la API/web.

---

## 38. Criterios de aceptación del MVP

El MVP será funcional cuando:

- Escudo Digital se instale en Android Emulator.
- La protección pueda activarse.
- Una notificación pueda llegar al servicio.
- El texto disponible pueda analizarse.
- El motor local genere riesgo.
- La alerta sea comprensible.
- Una llamada pueda evaluarse mediante CallScreeningService.
- Un número pueda consultarse en la base local.
- El usuario pueda permitir un número.
- La protección continúe sin Internet.
- La base local pueda sincronizarse.
- La web pueda crear y validar amenazas.
- Android pueda recibir actualizaciones.
- La API pueda consultar amenazas.
- Todo pueda demostrarse desde la Mac.

---

## 39. Arquitectura de carpetas

```text
escudo-digital/
├── android/
│   ├── app/
│   ├── core/
│   ├── data/
│   ├── domain/
│   ├── notifications/
│   ├── calls/
│   ├── webprotection/
│   ├── sync/
│   └── ui/
├── backend/
│   ├── api/
│   ├── services/
│   ├── models/
│   ├── schemas/
│   ├── repositories/
│   ├── security/
│   └── core/
├── web/
│   ├── app/
│   ├── components/
│   ├── services/
│   └── types/
├── docs/
└── README.md
```

---

## 40. Variables de entorno

Utilizar `.env` y mantener `.env.example`.

Nunca subir secretos al repositorio.

Ejemplo:

```text
DATABASE_URL=
AI_API_KEY=
API_SECRET=
JWT_SECRET=
```

---

## 41. Documentación

README debe explicar:

- problema;
- público objetivo;
- arquitectura;
- privacidad;
- permisos;
- funcionamiento Android;
- backend;
- web;
- API;
- funcionamiento offline;
- sincronización;
- instalación;
- ejecución del emulador;
- demo.

Toda documentación visible debe estar en español.

---

## 42. Pruebas

Prioridad:

1. Motor local.
2. Consulta de números.
3. Consulta de dominios.
4. Notificaciones.
5. CallScreeningService.
6. Sincronización.
7. Offline.
8. API.
9. Validación de reportes.
10. Protección web.

---

## 43. Principio de incertidumbre

Cuando la información sea insuficiente:

> No se pudo determinar.

No inventar:

- identidad del remitente;
- empresa;
- propietario de un número;
- legitimidad de un sitio;
- denuncias;
- antecedentes;
- datos personales.

---

## 44. Principio de transparencia

Las alertas importantes deben mostrar las señales detectadas cuando sea posible.

Ejemplo:

> 🔴 Riesgo alto
>
> Detectamos:
> - solicitud urgente de dinero;
> - remitente no reconocido;
> - patrón asociado a una modalidad conocida.

---

## 45. Prioridades del proyecto

1. Protección automática.
2. Privacidad.
3. Funcionamiento offline.
4. Simplicidad para adultos mayores.
5. Estabilidad.
6. Base actualizable.
7. API abierta.
8. Facilidad de demostración.
9. Código claro.
10. Funcionalidades adicionales.

Si existe una decisión entre agregar complejidad o mantener una solución sencilla y comprobable, preferir la solución sencilla.
