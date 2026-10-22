# Training Camp · Wexpand

Plataforma gratuita para que estudiantes y profesionistas **armen su CV** y **entrenen sus entrevistas** con un coach de IA, en español o inglés. Cada entrevista se vive como un partido: los wexpancitos son los coaches.

> **Estado: prototipo navegable.** Las pantallas muestran el flujo y el diseño final. Todavía no hay backend: el registro no se guarda, el coach no responde de verdad y las descargas de CV no generan archivo. Los nombres, puntajes y CV que aparecen son datos de ejemplo.

## Qué hay

| Ruta | Qué es |
|---|---|
| `/` | Portada con scroll 3D en campo de golf: el wexpancito hace hoyo en uno y revela la ficha de registro con un cromo que se arma en vivo. |
| `/web/…` | Versión de escritorio. |
| `/app/…` | Versión móvil. Se puede instalar en el teléfono ("Agregar a pantalla de inicio"). |

Pantallas (mismo nombre en `/web` y `/app`):

| Página | Módulo | Contenido |
|---|---|---|
| `hub` | — | ¿Qué entrenas hoy? Elegir entre armar CV o simular entrevista. |
| `cv-vestidor` | El Vestidor (CV) | Chat con el coach armador; el CV se escribe mientras platicas. |
| `cv-resultado` | El Vestidor (CV) | CV formato Harvard, revisión ATS, match con la vacante, descarga PDF/Word. |
| `previa` | La Cancha (entrevista) | Subir CV, pegar la vacante, elegir coach, idioma, duración y modo. |
| `vivo` | La Cancha (entrevista) | La entrevista como transmisión en vivo: marcador, stats en tiempo real, checklist STAR. |
| `resumen` | La Cancha (entrevista) | Resumen del partido: momentum, revisión VAR, stats por competencia, plan de entrenamiento. |
| `cromo` | — | Cromo coleccionable, ADN de jugador, álbum de coaches e historial. |

Coaches: fútbol (RH y cultura), tenis (inglés), voleibol (técnica y armado de CV), box (preguntas difíciles), golf (nivel ejecutivo y negociación), básquetbol (análisis post-partido).

## Correr en local

Es HTML estático, sin build:

```bash
npx serve .
# o
python3 -m http.server 8080
```

## Despliegue

Vercel (equipo **Talent Lead**) despliega automáticamente cada push a `main`. `vercel.json` activa URLs limpias (`/web/hub` en lugar de `/web/hub.html`).

## Identidad

Colores y tipografías del brandbook de Wexpand 2025: azul `#0653A1`, naranja `#F07E2E`, azul profundo `#00415E`, azul claro `#96D4E7`, cian `#00A0C1`, amarillo `#F7A700`; Bebas Neue para títulos y Montserrat para texto.

## Siguientes pasos para producto

1. Backend de registro y consentimientos (tres casillas separadas, con versión del aviso aceptado).
2. Coach de entrevista: voz en tiempo real + evaluador separado con rúbricas BARS.
3. Coach de CV: extracción a CV Harvard, chequeo ATS y exportación real a PDF/Word.
4. Dataset anonimizado hacia WeAI (solo con el consentimiento opcional).
