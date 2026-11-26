# Chatbot contextual y comparación de tecnología

25 de noviembre de 2026.

## Elección para Aluformix

Se eligió Firebase AI Logic con Gemini 3.8 Flash para conversación y fotos. La decisión prioriza español, orientación sobre materiales, multimodalidad, latencia y el requisito del usuario de no contratar un servicio de pago ni depender de la laptop. No se afirma que sea el mejor modelo universal ni que se haya realizado una comparación de calidad en dispositivos reales.

La documentación oficial lo incluye como modelo compatible que no exige facturación en Gemini Developer API. Se comprobó por API que el proyecto no tiene facturación vinculada. Se conserva GoogleAIBackend y Spark; no se activaron Blaze, cobros, suscripciones o claves de otro proveedor. La modalidad gratuita tiene cuotas y puede rechazar solicitudes. El OCR literal mantiene Gemini 3.5 Flash-Lite, para no convertir la lectura de listas en una conversación costosa.

OpenAI API es una alternativa de pago por uso y requeriría otra integración de servidor y gestión de credenciales. Un modelo autoalojado requeriría infraestructura que seguiría funcionando cuando se apague esta computadora. Para este catálogo pequeño no se añadió una base vectorial ni un framework de agentes: se recuperan localmente los productos relevantes, con las utilidades de búsqueda ya existentes, sin nuevos paquetes externos.

Fuentes primarias consultadas:
- Modelos y modalidad sin facturación: https://firebase.google.com/docs/ai-logic/models
- Precio y cuotas: https://firebase.google.com/docs/ai-logic/pricing y https://firebase.google.com/docs/ai-logic/quotas
- Conversación por turnos: https://firebase.google.com/docs/ai-logic/chat
- Respuestas progresivas: https://firebase.google.com/docs/ai-logic/stream-responses
- Nivel LOW para reducir latencia: https://firebase.google.com/docs/ai-logic/thinking
- Streams de Expo SDK 58: https://docs.expo.dev/versions/latest/sdk/expo/
- Comparación de coste de OpenAI API: https://developers.openai.com/api/docs/pricing

## Cambios implementados

assistantContext.js concentra la guía de la app, la selección de materiales, los límites de contexto y las instrucciones. assistantEngine.js prepara la petición multimodal, conserva roles user/model reales, procesa respuestas progresivas y comunica errores sin simular resultados. firebaseClient.js mantiene Firebase/App Check e identidad de cuenta y delega al motor nuevo.

La conversación envía hasta 16 mensajes recientes y 12000 caracteres de historial, sin subir otra vez las fotos de turnos anteriores. El modelo recibe instrucciones para usar las medidas que ya se dieron, pedir solo uno o dos datos decisivos, distinguir una orientación de una lista definitiva y no deducir compatibilidad o medidas exactas de una foto. Se pide texto legible y breve, sin tablas o formato Markdown innecesario.

La recuperación selecciona hasta 16 materiales activos por nombres, códigos, familias y contexto reciente. No aproxima números. Se reutiliza el catálogo cifrado de la cuenta en el teléfono cuando existe; la búsqueda no queda esperando Firebase para cada mensaje. Las preguntas generales no consultan el catálogo. Si no se logra cargarlo, el modelo puede orientar sin afirmar que un material está disponible. Un rechazo de permisos no se oculta con una generación.

No se envían precios, existencias, pedidos, credenciales ni datos de clientes dentro de los hechos del catálogo. Los botones Ver material se construyen únicamente a partir de códigos reales citados por la respuesta y abren la pantalla de producto existente. No significan que la empresa haya confirmado compatibilidad ni disponibilidad. El chat no dispone de herramientas de escritura para crear pedidos, cobrar o modificar inventario.

Las respuestas progresivas se muestran mientras llegan, con actualizaciones limitadas a aproximadamente una cada 120 ms y mensajes anteriores memorizados con React.memo. Se puede detener la respuesta. Una respuesta incompleta no se registra como completada en el historial; se conserva la pregunta y foto para reintentar. No hay reintentos automáticos ni cambio oculto a un proveedor de pago cuando se agota la cuota.

Las guías de encargo, lectura de listas, recuperación de acceso, seguimiento y actualizaciones responden sin conexión y se identifican como guía local. Las consultas libres y las fotos siguen requiriendo internet y App Check. Las sugerencias rellenan el cuadro de texto y no envían consultas por sí solas.

La revisión visible pasa a 25 nov · 2. El chatbot sigue en la app Cliente; Empresa conserva sus funciones administrativas separadas. No se modificaron precios ni datos de Firebase.

## Verificación

117 pruebas JavaScript correctas. Se añadieron pruebas de memoria, preguntas generales, códigos y series exactos, catálogo caído, permisos, OCR separado, cuotas, cancelación, respuestas parciales, tarjetas y guía offline. Una prueba usa el SDK real de Firebase AI con una respuesta SSE simulada: comprueba modelo, roles, foto, App Check, thinkingLevel LOW y texto final; no utiliza tokens reales ni consume cuota del modelo.

Una consulta de solo lectura al catálogo real verificó 124 productos activos y la selección de 16 candidatos para una ventana. En esta computadora la recuperación tardó aproximadamente 5 ms en una ejecución. Esto no mide la latencia de Gemini ni el rendimiento en teléfonos. No había una clave de IA de servidor disponible para una comparación externa. No se crearon cuentas de prueba en Firebase ni se generó un token debug de App Check para saltar la validación.

Queda pendiente el ensayo con un Android real y un token Play Integrity del dispositivo: respuesta a preguntas libres, recomendaciones y fotos, tiempo a la primera palabra y funcionamiento en Wi-Fi/datos. Por ello no se declara que la calidad de las respuestas reales haya quedado validada al 100%. La preparación iPhone sigue pendiente de firma/Team ID/App Attest como indica registro-preparacion-iphone.md.

Publicación completada: revisión 25 nov · 2 en cuatro runtimes de Cliente y tres de Empresa. Grupos actuales: Cliente 3eeee19f-d6b9-4194-9668-0bbfd53b50c5; Empresa dd8b79e5-bd50-4f05-9ca3-89e5ca333bab. Las consultas posteriores a ambos canales devolvieron HTTP 200, hash válido y presencia de la revisión 25 nov · 2, gemini-3.8-flash y gemini-3.5-flash-lite en el bundle servido. La configuración temporal de Expo se restauró al finalizar. No se generó otro APK: son cambios JavaScript compatibles con las versiones Android existentes. Publicación y descarga verificadas no confirman una conversación real de Gemini ni la instalación en el teléfono.
