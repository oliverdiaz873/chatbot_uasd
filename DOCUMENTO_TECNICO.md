# Documento Técnico - Chatbot UASD

## Tecnologías Utilizadas

### Frontend
- **Next.js 14+**: Framework de React con App Router para desarrollo web moderno
- **TypeScript**: Superset de JavaScript para tipado estático y mayor seguridad
- **TailwindCSS**: Framework de CSS para diseño responsive y utilidades
- **Framer Motion**: Librería para animaciones suaves y modernas
- **Lucide React**: Biblioteca de iconos moderna y ligera

### Backend
- **Node.js**: Entorno de ejecución JavaScript del lado del servidor
- **Next.js API Routes**: Endpoints API integrados en Next.js

### Inteligencia Artificial
- **Google Gemini API**: Modelo de lenguaje para generación de respuestas
- **pdf-parse**: Librería para extracción de texto de archivos PDF

### Otras Tecnologías
- **UUID**: Generación de identificadores únicos
- **Zod**: Validación de esquemas de datos
- **clsx & tailwind-merge**: Utilidades para manejo de clases CSS

---

## Arquitectura del Sistema

### Estructura de Carpetas

```
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
│   ├── simplePdf.ts        # Procesamiento del PDF y RAG
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

### Flujo de Arquitectura

1. **Usuario** envía mensaje desde la interfaz
2. **ChatWindow** llama a la API `/api/chat`
3. **API Route** invoca `ChatbotService.getResponse()`
4. **ChatbotService**:
   - Detecta saludos y responde amigablemente
   - Detecta preguntas generales y da resumen
   - Busca chunks relevantes en el PDF (`simplePdf.ts`)
   - Aplica paráfrasis predefinidas si aplica
   - Si no, usa Gemini para generar respuesta
5. **Respuesta** se devuelve al usuario

---

## Integración de Inteligencia Artificial

### 1. Procesamiento de Lenguaje Natural

El sistema utiliza dos enfoques complementarios:

#### A. Sistema RAG Simplificado (Retrieval-Augmented Generation)
- **Extracción de texto**: `pdf-parse` extrae texto del PDF del Estatuto
- **Fragmentación**: El texto se divide por artículos usando expresiones regulares
- **Scoring inteligente**: Cada chunk recibe un puntaje basado en:
  - Coincidencia exacta de términos de la consulta
  - Relevancia de artículo específico (boost para artículos clave)
  - Señales normativas (palabras como "deberá", "podrá", "funciones")
  - Detección de preguntas específicas (Claustro Mayor, Claustro Menor, etc.)

#### B. Detección de Patrones
Funciones específicas detectan tipos de preguntas:
- Saludos ("hola", "buenos días")
- Preguntas generales ("explícame el estatuto")
- Preguntas institucionales (misión, fines, autonomía)
- Preguntas sobre organismos (Claustro Mayor, Claustro Menor, Consejo Universitario)
- Preguntas sobre roles (Rector, Decanos, estudiantes)

### 2. Generación de Respuestas

#### A. Paráfrasis Predefinidas
Para preguntas frecuentes, el sistema usa respuestas predefinidas:
- Mayor precisión y consistencia
- Respuestas inmediatas sin depender de la API
- Cubren temas clave del Estatuto

#### B. Google Gemini API
Para consultas específicas no cubiertas por paráfrasis:
- **Prompt engineering**: Instrucciones claras sobre comportamiento
- **Contexto relevante**: Solo se envían chunks pertinentes
- **Reglas estrictas**: No inventar información, citar artículos, mantener tono formal

### 3. Configuración de IA

```typescript
// lib/gemini.ts
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.3,  // Baja temperatura para respuestas más consistentes
    maxOutputTokens: 500,
  },
});
```

---

## Funcionamiento del Chatbot

### 1. Inicialización
- Al iniciar, el sistema carga el PDF en memoria (`chunksCache`)
- El texto se limpia y fragmenta por artículos
- Se filtran chunks irrelevantes (índice, portada, etc.)

### 2. Procesamiento de Consulta

```typescript
async getResponse(query: string) {
  // Paso 1: Detectar saludos
  if (isGreeting(query)) {
    return "Hola 👋 ¿en qué puedo ayudarte sobre la UASD?";
  }

  // Paso 2: Detectar preguntas generales
  if (isGeneralStatuteQuestion(query)) {
    return resumenGeneral;
  }

  // Paso 3: Buscar chunks relevantes
  const chunks = await searchRelevantChunks(query, 4);

  // Paso 4: Aplicar paráfrasis predefinidas si aplica
  const summary = buildKnownParaphrase(context, article, query);
  if (summary) return summary;

  // Paso 5: Usar Gemini para generar respuesta
  const response = await model.generateContent(prompt);
  
  // Paso 6: Aplicar reglas de respuesta
  return enforceResponseRules(response, article);
}
```

### 3. Sistema de Scoring

Cada chunk recibe un puntaje basado en:

```typescript
score = 
  (coincidencia exacta de artículo: +100) +
  (boost para artículo específico: +260) +
  (coincidencias de términos: +8 a +20) +
  (señales normativas: +12) +
  (penalización por longitud: -4 a -20)
```

### 4. Manejo de Errores
- Try-catch en todas las operaciones asíncronas
- Fallback local si Gemini falla
- Mensajes de error amigables para el usuario
- Logging en consola para debugging

---

## Uso del Estatuto Orgánico como Fuente de Información

### 1. Carga del Documento
- El PDF se lee desde `data/ESTATUTO-ORGANICO-UASD.pdf`
- Se usa `pdf-parse` para extraer texto
- El texto se cachea en memoria para evitar re-procesamiento

### 2. Procesamiento del Texto
- **Limpieza**: Eliminación de saltos de línea incorrectos, espacios extra
- **Normalización**: Eliminación de acentos para mejor matching
- **Fragmentación**: División por artículos usando regex `/ARTÍCULO\s+\d+/i`
- **Filtrado**: Eliminación de chunks irrelevantes (índice, portada)

### 3. Búsqueda Semántica
- Extracción de términos clave de la consulta (stop words removidos)
- Búsqueda de coincidencias en chunks
- Scoring por relevancia y artículo específico
- Retorno de los 4 chunks más relevantes

### 4. Citación de Fuentes
- Extracción automática de número de artículo del contexto
- Formato de cita: "Según el Artículo X."
- Si no hay artículo específico: "Según el Estatuto Orgánico."

### 5. Restricciones de Información
- Solo se usa información del PDF
- No se permite conocimiento externo
- Respuestas inventadas son rechazadas
- Mensaje estándar cuando no hay información: "No se encontró esa información en el Estatuto."

---

## Características Especiales

### 1. Preguntas Sugeridas
- 37 preguntas predefinidas según requerimientos
- Se muestran en estado inicial
- Animaciones suaves con Framer Motion
- Selección directa para iniciar conversación

### 2. Botón "Nueva Consulta"
- Permite limpiar el historial
- Vuelve a mostrar preguntas sugeridas
- Solo aparece cuando hay mensajes

### 3. Indicador de Escritura
- Muestra animación mientras Gemini genera respuesta
- Mejora UX esperando respuesta

### 4. Responsive Design
- Adaptado a desktop, tablet y móvil
- TailwindCSS responsive classes
- Layout flexible

---

## Buenas Prácticas Implementadas

1. **TypeScript**: Tipado estático para mayor seguridad
2. **Componentes Reutilizables**: Modularidad y mantenibilidad
3. **Separación de Concerns**: Lógica de negocio separada de UI
4. **Error Handling**: Try-catch en operaciones críticas
5. **Caching**: Chunks del PDF cacheados en memoria
6. **Clean Code**: Nombres descriptivos, funciones pequeñas
7. **Environment Variables**: API keys en `.env.local`
8. **Git Ignore**: Archivos sensibles no versionados

---

## Consideraciones de Escalabilidad

El sistema está diseñado para escalar:

1. **Base de datos**: Actualmente usa cache en memoria, podría migrarse a Redis
2. **Vector Store**: Para búsquedas semánticas más avanzadas con embeddings
3. **Rate Limiting**: Para prevenir abuso de la API
4. **Logging**: Sistema de logging centralizado para monitoreo
5. **Analytics**: Seguimiento de preguntas frecuentes para mejorar paráfrasis

---

## Conclusión

El proyecto implementa una solución robusta y moderna para consulta del Estatuto Orgánico de la UASD, combinando tecnologías web actuales con inteligencia artificial de manera efectiva. La arquitectura es modular, mantenible y escalable, cumpliendo con todos los requerimientos funcionales y técnicos del proyecto final.
