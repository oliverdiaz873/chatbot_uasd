# Chatbot Inteligente para Consulta del Estatuto Orgánico de la UASD

Este proyecto es un chatbot basado en Inteligencia Artificial desarrollado como proyecto final de la asignatura **Laboratorio de Lenguaje de Programación III – Web**. Permite realizar consultas en lenguaje natural sobre el Estatuto Orgánico de la Universidad Autónoma de Santo Domingo (UASD), proporcionando respuestas claras, coherentes y fundamentadas exclusivamente en el documento oficial.

## Objetivo

Desarrollar una aplicación web inteligente que integre tecnologías modernas de desarrollo web e inteligencia artificial para la consulta interactiva del Estatuto Orgánico de la UASD.

## Tecnologías Utilizadas

### Frontend
- **Next.js 14+** (App Router) - Framework de React
- **TypeScript** - Tipado estático
- **TailwindCSS** - Framework de CSS
- **Framer Motion** - Animaciones
- **Lucide React** - Iconos

### Backend
- **Node.js** - Entorno de ejecución
- **Next.js API Routes** - Endpoints API

### Inteligencia Artificial
- **Google Gemini API** - Modelo de lenguaje para generación de respuestas
- **pdf-parse** - Extracción de texto de PDF

### Otras
- **UUID** - Generación de identificadores
- **Zod** - Validación de esquemas
- **clsx & tailwind-merge** - Utilidades CSS

## 📁 Estructura del Proyecto

```txt
src/
├── app/                    # Rutas y API (Next.js App Router)
│   ├── api/
│   │   └── chat/          # Endpoint para procesar mensajes
│   ├── layout.tsx          # Layout principal
│   └── page.tsx           # Página principal
├── components/
│   └── chat/              # Componentes de la interfaz de chat
│       ├── ChatWindow.tsx     # Ventana principal del chat
│       ├── ChatInput.tsx      # Campo de entrada
│       ├── MessageBubble.tsx  # Burbuja de mensaje
│       ├── EmptyState.tsx     # Estado inicial con preguntas sugeridas
│       ├── SuggestedQuestions.tsx  # Preguntas preelaboradas
│       └── TypingIndicator.tsx   # Indicador de escritura
├── lib/
│   ├── gemini.ts           # Configuración de Google Gemini
│   ├── prompts.ts          # Prompts del sistema
│   ├── simplePdf.ts        # Procesamiento del PDF y sistema RAG
│   └── utils.ts            # Utilidades generales
├── services/
│   └── chatbot.service.ts  # Lógica de negocio del chatbot
├── types/
│   └── chat.ts             # Definiciones de TypeScript
└── utils/
    └── constants.ts        # Constantes de la aplicación
data/
└── ESTATUTO-ORGANICO-UASD.pdf  # PDF del Estatuto Orgánico
```

## Características

### Interfaz de Usuario
- Diseño moderno, claro e intuitivo
- Pantalla principal del chatbot
- Área de conversación usuario-sistema
- Campo para escribir preguntas
- Botón para enviar mensajes
- 37 preguntas sugeridas relacionadas con el Estatuto
- Historial de conversación
- Botón "Nueva consulta" para reiniciar
- Diseño responsive (desktop, tablet, móvil)

### Inteligencia Artificial
- Procesamiento de preguntas en lenguaje natural
- Interpretación semántica de consultas
- Búsqueda inteligente en el Estatuto (sistema RAG)
- Generación automática de respuestas con Google Gemini
- Respuestas claras y contextualizadas
- Detección de saludos (responde amigablemente)
- Manejo de preguntas generales (resumen del Estatuto)

### Funcionalidad del Chatbot
- Recibe preguntas escritas por el usuario
- Responde consultas sobre el Estatuto Orgánico
- Respuestas claras, breves y coherentes
- Indica cuando no tiene información suficiente
- Permite múltiples consultas consecutivas
- Evita respuestas inventadas o no relacionadas
- Citación de artículos del Estatuto

## Requisitos Previos

- Node.js 18.x o superior
- npm o yarn
- API Key de Google Gemini ([Obtener aquí](https://makersuite.google.com/app/apikey))

## Instalación

1. Clona el repositorio o descarga los archivos:
   ```bash
   git clone <repositorio>
   cd chatbot-uasd
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura las variables de entorno:
   Crea un archivo `.env.local` en la raíz del proyecto:
   ```env
   GOOGLE_API_KEY=tu_api_key_aqui
   ```

4. **IMPORTANTE**: Descarga el PDF oficial del Estatuto Orgánico:
   - Fuente: https://postgrado.uasd.edu.do/wp-content/uploads/2024/06/ESTATUTO-ORGANICO-UASD.pdf
   - Colócalo en la carpeta `data/` con el nombre `ESTATUTO-ORGANICO-UASD.pdf`

## Ejecución

Para iniciar el servidor de desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

## Cómo Funciona

### Flujo RAG (Retrieval-Augmented Generation)

1. **Carga**: El sistema lee el PDF localmente usando `pdf-parse`
2. **Fragmentación**: El texto se divide por artículos usando expresiones regulares
3. **Scoring**: Cada fragmento recibe un puntaje basado en:
   - Coincidencia de términos con la consulta
   - Relevancia del artículo específico
   - Señales normativas (palabras como "deberá", "podrá", "funciones")
4. **Búsqueda**: Se seleccionan los 4 fragmentos más relevantes
5. **Generación**: Se envía el contexto a Google Gemini para generar la respuesta
6. **Citación**: Se incluye referencia al artículo correspondiente

### Detección de Patrones

El sistema detecta automáticamente:
- **Saludos**: Responde amigablemente sin buscar en el PDF
- **Preguntas generales**: Proporciona un resumen del Estatuto
- **Preguntas específicas**: Usa paráfrasis predefinidas para temas frecuentes
- **Consultas complejas**: Utiliza el sistema RAG + Gemini

## Preguntas Sugeridas

El chatbot incluye 37 preguntas preelaboradas sobre:

- Definición y misión de la UASD
- Organización y gobierno universitario
- Claustro Mayor y Claustro Menor
- Consejo Universitario
- Funciones del Rector y Vicerrectores
- Facultades, Escuelas y Consejos Directivos
- Personal docente (derechos y deberes)
- Estudiantes (derechos, deberes, representación)
- Investigación, postgrado y extensión
- Bienestar universitario y régimen disciplinario
- Patrimonio universitario

## Documentación

- **[DOCUMENTO_TECNICO.md](DOCUMENTO_TECNICO.md)** - Documentación técnica detallada
- **[ANALISIS_REQUERIMIENTOS.md](ANALISIS_REQUERIMIENTOS.md)** - Análisis de cumplimiento de requerimientos

## Criterios de Evaluación

| Criterio | Valor | Cumplimiento |
|----------|-------|--------------|
| Funcionamiento del chatbot | 25% | Si |
| Integración de inteligencia artificial | 25% | Si |
| Diseño e interfaz web | 15% | Si |
| Calidad y organización del código | 15% | Si |
| Pertinencia de las respuestas según el Estatuto | 10% | Si |
| Presentación y demostración final | 10% | Pendiente |

## Scripts Disponibles

```bash
npm run dev      # Inicia servidor de desarrollo
npm run build    # Compila para producción
npm run start    # Inicia servidor de producción
npm run lint     # Ejecuta linter
```

## Notas Importantes

- El PDF del Estatuto debe ser el documento oficial completo, no un índice
- Las respuestas se basan exclusivamente en el contenido del PDF
- El sistema no inventa información ni usa conocimiento externo
- Para preguntas fuera del Estatuto, responde: "No se encontró esa información en el Estatuto."

## Autor

Desarrollado como proyecto final de **Laboratorio de Lenguaje de Programación III – Web**

## Licencia

Proyecto académico para la Universidad Autónoma de Santo Domingo (UASD)

