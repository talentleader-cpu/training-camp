# Training Camp · Wexpand

Plataforma gratuita para que estudiantes y profesionistas **armen su CV** y **entrenen sus entrevistas** con un coach de IA, en español o inglés. Cada entrevista se vive como un partido: los wexpancitos son los coaches.

> **Estado: lanzamiento 1.** Funcionan el registro (se guarda en Supabase con consentimientos separados), El Vestidor (coach de CV con IA, CV formato Harvard, revisión ATS y descarga en PDF y Word) y la comunidad de WhatsApp. **La Cancha** (`/cancha`): simulador de entrevistas solo por voz (10, 20 o 30 min) con 5 coaches y análisis post-partido. Las pantallas de `/web` y `/app` (previa, vivo, resumen, cromo) siguen como demos de diseño.

## Qué hay

| Ruta | Qué es |
|---|---|
| `/` | Portada con scroll 3D en campo de golf: el wexpancito hace hoyo en uno y revela la ficha de registro con un cromo que se arma en vivo. El registro se guarda en Supabase. |
| `/cancha` | **La Cancha** (funcional): la previa (CV del Vestidor, PDF o texto; vacante; coach; idioma; duración), la entrevista por voz en vivo y el resumen del partido con PDF descargable. |
| `/cv` | **El Vestidor** (funcional): el coach guía por 7 etapas (objetivo, datos, estudios, experiencia, proyectos, habilidades, revisión) con checklist de lo que falta en cada una; CV Harvard en vivo en español, inglés o ambos; revisión ATS, match con la vacante y descarga PDF/Word. Responsive para web y app. |
| `/aviso-de-privacidad` | Aviso de privacidad (completar razón social, domicilio y correo antes del lanzamiento). |
| `/web/…` | Versión de escritorio. |
| `/app/…` | Versión móvil. Se puede instalar en el teléfono ("Agregar a pantalla de inicio"). |

Pantallas (mismo nombre en `/web` y `/app`):

| Página | Módulo | Contenido |
|---|---|---|
| `hub` | — | ¿Qué entrenas hoy? Elegir entre armar CV o simular entrevista. |
| `previa` | La Cancha (demo) | Subir CV, pegar la vacante, elegir coach, idioma y duración (10, 20 o 30 min). La entrevista es solo por voz. |
| `vivo` | La Cancha (demo) | La entrevista como transmisión en vivo: marcador, stats en tiempo real, checklist STAR. |
| `resumen` | La Cancha (demo) | Resumen del partido: momentum, revisión VAR, stats por competencia, plan de entrenamiento. |
| `cromo` | — (demo) | Cromo coleccionable, ADN de jugador, álbum de coaches e historial. |

Comunidad: botón para unirse al grupo de WhatsApp en la portada, en "¿Qué entrenas hoy?" y en el cromo.

Coaches: fútbol (RH y cultura), tenis (inglés), voleibol (técnica y armado de CV), box (preguntas difíciles), golf (nivel ejecutivo y negociación), básquetbol (análisis post-partido).

## Cómo funciona

- **Registro:** `index.html` → `js/tc.js` inserta en `tc_jugadores` (Supabase, proyecto *Recruitment Dashboard*) con la llave pública. Las tablas `tc_jugadores` y `tc_cvs` solo permiten **insertar**; leer los datos requiere la llave de servicio (equipo Wexpand, desde el panel de Supabase).
- **Coach de CV:** `cv/index.html` + `js/vestidor.js` llaman a la función `api/cv-coach.js` (Vercel), que usa la API de Claude con salida estructurada. Las etapas y lo que necesita cada una viven en `js/etapas.js`, que comparten la página (barra y checklist) y el coach (sabe qué falta en la etapa actual). Reglas clave: nunca inventa datos, una pregunta a la vez, un puesto a la vez, busca resultados medibles, no pide datos sensibles.
- **Idiomas del CV:** al empezar la persona elige español, inglés o ambos. Con *ambos* el coach arma el CV en español y `api/cv-traducir.js` genera la versión en inglés con los mismos datos; se puede ver y descargar cada versión. Cambiar de ES a EN a mitad del camino traduce el CV sin perder nada.
- **Revisión ATS:** se calcula en el navegador con reglas fijas (contacto, educación, experiencia, verbos de acción, resultados medibles, habilidades), así el puntaje es explicable y siempre igual para el mismo CV.
- **La Cancha:** `js/cancha.js` usa el reconocimiento de voz y la voz del navegador (Chrome, Edge, Safari). `api/cancha-turno.js` es el entrevistador (sabe el tiempo restante y cierra al acabarse); `api/cancha-evaluar.js` es un evaluador independiente con anclas conductuales (BARS) que solo cita lo que dijo la persona; `api/cv-leer.js` convierte un CV en PDF al formato del Vestidor. Al terminar se guarda la transcripción (nunca el audio) en `tc_entrevistas`.
- **Descargas:** PDF con texto seleccionable (jsPDF) y Word (.docx) generados en el navegador; librerías en `vendor/`. Cada descarga guarda una versión del CV en `tc_cvs`.

### Variables de entorno (Vercel)

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | **Obligatoria.** Llave de la API de Claude para el coach. Sin ella el chat responde "El coach todavía no está conectado". |
| `ANTHROPIC_WORKSPACE_ID` | Solo si la llave no pertenece a un workspace de Anthropic: ID del workspace (empieza con `wrkspc_`). |
| `TC_MODEL` | Opcional. Modelo a usar (por defecto `claude-sonnet-5-5`). |
| `ELEVENLABS_API_KEY` | Opcional, recomendada. Voz neural nativa para La Cancha (inglés y español). Sin ella se usa la voz del navegador. |
| `TC_VOZ_EN` / `TC_VOZ_ES` | Opcional. ID de la voz de ElevenLabs para inglés y para español (Voice Library → copiar Voice ID). |
| `OPENAI_API_KEY` | Alternativa a ElevenLabs para la voz (`gpt-4o-mini-tts`). Solo se usa si no hay llave de ElevenLabs. |

### Ver los registros

En Supabase → proyecto *Recruitment Dashboard* → Table Editor → `tc_jugadores` y `tc_cvs`.

## Correr en local

Es HTML estático, sin build (la función del coach necesita `vercel dev` para correr en local):

```bash
npx serve .
# o
python3 -m http.server 8080
```

## Despliegue

Vercel (equipo **Talent Lead**) despliega automáticamente cada push a `main`. `vercel.json` activa URLs limpias (`/web/hub` en lugar de `/web/hub.html`).

## Identidad

Colores y tipografías del brandbook de Wexpand 2025: azul `#0653A1`, naranja `#F07E2E`, azul profundo `#00415E`, azul claro `#96D4E7`, cian `#00A0C1`, amarillo `#F7A700`; Bebas Neue para títulos y Montserrat para texto.

## Siguientes pasos

1. La Cancha: voz más natural (proveedor de voz en tiempo real) y avatar animado; hoy usa la voz y el reconocimiento del navegador.
2. Cuentas de usuario (iniciar sesión, ver mis CVs en otro dispositivo, borrar cuenta).
3. Panel interno para el equipo (registros, CVs, métricas) y conexión con WeAI usando solo datos con consentimiento.
4. Apps nativas para Play Store y App Store (Capacitor).
