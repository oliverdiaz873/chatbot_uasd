/**
 * Servicio principal del chatbot
 * Orquesta el flujo de respuesta: detección de patrones, búsqueda RAG, paráfrasis y generación con IA
 */
import { model } from "@/lib/gemini";
import { searchRelevantChunks } from "@/lib/simplePdf";

const NOT_FOUND_MESSAGE =
  "No se encontró esa información en el Estatuto.";

function extractArticleReference(context: string): string | null {
  const match = context.match(/\bART[IÍ]CULO\s+(\d+)\b/i);
  return match ? `Artículo ${match[1]}` : null;
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGreeting(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  const greetings = ["hola", "buenos dias", "buenas tardes", "buenas noches", "hey", "hi", "hello", "buen dia"];
  return greetings.some(greeting => normalizedQuery.includes(greeting));
}

function isGeneralStatuteQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  const generalPhrases = [
    "explicame el estatuto",
    "explícame el estatuto",
    "resumelo",
    "resúmelo",
    "que dice el estatuto",
    "qué dice el estatuto",
    "estatuto general",
    "estatuto en general",
    "hablame del estatuto",
    "háblame del estatuto",
    "cuentame sobre el estatuto",
    "cuéntame sobre el estatuto",
    "que es el estatuto",
    "qué es el estatuto"
  ];
  return generalPhrases.some(phrase => normalizedQuery.includes(phrase));
}

function isInstitutionalDefinitionQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);

  return (
    /\b(que es|definicion|define|concepto|naturaleza)\b/.test(normalizedQuery) &&
    /\b(universidad|uasd)\b/.test(normalizedQuery)
  );
}

function isMissionQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /\bmision\b/.test(normalizedQuery) && /\b(universidad|uasd)\b/.test(normalizedQuery);
}

function isInstitutionalPurposeQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /\b(fines|finalidad|finalidades|propositos|objetivos)\b/.test(normalizedQuery) && /\b(universidad|uasd)\b/.test(normalizedQuery);
}

function isAutonomyQuestion(query: string): boolean {
  return /\bautonomia\b/.test(normalizeForMatch(query));
}

function isOrganizationQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /\b(organizada|organizacion|estructura|estructurada|integra|integrada|compuesta)\b/.test(normalizedQuery) && /\b(universidad|uasd)\b/.test(normalizedQuery);
}

function isMajorClaustroQuestion(query: string): boolean {
  return /\bclaustro mayor\b/.test(normalizeForMatch(query));
}

function isMinorClaustroQuestion(query: string): boolean {
  return /\bclaustro menor\b/.test(normalizeForMatch(query));
}

function isUniversityCouncilQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  // Excluir preguntas sobre atribuciones/funciones para que las maneje isUniversityCouncilFunctionsQuestion
  if (/(atribuciones|funciones|facultades|poderes|competencias)/.test(normalizedQuery)) return false;
  return /\bconsejo universitario\b/.test(normalizedQuery);
}

function isRectorFunctionsQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /\brector\b/.test(normalizedQuery) && /\b(funciones|atribuciones)\b/.test(normalizedQuery);
}

function isFacultyQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /\bfacultades?\b/.test(normalizedQuery) && /\b(que son|definicion|define|concepto)\b/.test(normalizedQuery);
}

function isStudentsGeneralQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /\bestudiantes?\b/.test(normalizedQuery) && /\bestablece\b/.test(normalizedQuery);
}

function isStudentRightsQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /\bderechos?\b/.test(normalizedQuery) && /\bestudiantes?\b/.test(normalizedQuery);
}

function isStudentDutiesQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /\b(deberes|obligaciones)\b/.test(normalizedQuery) && /\bestudiantes?\b/.test(normalizedQuery);
}

function isResearchQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /\binvestigacion\b/.test(normalizedQuery) && !/\b(posgrado|postgrado)\b/.test(normalizedQuery);
}

function isPostgraduateQuestion(query: string): boolean {
  return /\b(posgrado|postgrado)\b/.test(normalizeForMatch(query));
}

function isPatrimonyQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  // Excluir "bienestar" para evitar confusión
  if (/bienestar/.test(normalizedQuery)) return false;
  return /(patrimonio|bienes|propiedad)/.test(normalizedQuery) && /(universidad|universitario|uasd)/.test(normalizedQuery);
}

function isDisciplinaryRegimeQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(regimen disciplinario|disciplinario|sanciones|faltas|medidas disciplinarias)/.test(normalizedQuery);
}

function isWellbeingQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(bienestar|bienestar universitario|salud|servicios sociales|orientacion|psicologica)/.test(normalizedQuery) && /(universidad|universitario|uasd)/.test(normalizedQuery);
}

function isExtensionQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(extension|extension universitaria|cultura|proyeccion social|difusion cultural)/.test(normalizedQuery) && /(universidad|universitario|universitaria|uasd)/.test(normalizedQuery);
}

function isPrinciplesQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(principios|principio|orientan|orienta|fundamentos|valores)/.test(normalizedQuery) && /(universidad|universitario|uasd)/.test(normalizedQuery);
}

function isGovernmentBodiesQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(organismos de gobierno|gobierno|organos de gobierno|claustro|consejo universitario|rectoria|vicerrectoria)/.test(normalizedQuery) && /(universidad|universitario|uasd)/.test(normalizedQuery);
}

function isUniversityCouncilFunctionsQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(atribuciones|funciones|facultades|poderes|competencias)/.test(normalizedQuery) && /(consejo universitario|consejo)/.test(normalizedQuery);
}

function isVicerectorFunctionsQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(atribuciones|funciones|facultades|poderes|competencias)/.test(normalizedQuery) && /(vicerrector|vicerrectores|vicerrectoria)/.test(normalizedQuery);
}

function isFacultyOrganizationQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(organizacion|organizan|estructura|como se organizan|como se organizan las facultades)/.test(normalizedQuery) && /(facultad|facultades)/.test(normalizedQuery);
}

function isFacultyCouncilQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(consejo directivo de facultad|consejos directivos de facultad|consejo de facultad|consejos de facultad)/.test(normalizedQuery);
}

function isSchoolQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(escuela|escuelas)/.test(normalizedQuery) && /(que son|que es|definicion|son las|son las escuelas)/.test(normalizedQuery);
}

function isSchoolDirectorFunctionsQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(atribuciones|funciones|facultades|poderes|competencias)/.test(normalizedQuery) && /(director de escuela|directores de escuela|director escuela)/.test(normalizedQuery);
}

function isCampusesCentersQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(recintos|centros|subcentros|recinto|centro|subcentro)/.test(normalizedQuery) && /(universitario|universitarios|universidad)/.test(normalizedQuery);
}

function isFacultyRightsQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(derechos|facultades|privilegios)/.test(normalizedQuery) && /(personal docente|profesor|profesores|docente|docentes)/.test(normalizedQuery);
}

function isFacultyDutiesQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(deberes|obligaciones|responsabilidades)/.test(normalizedQuery) && /(personal docente|profesor|profesores|docente|docentes)/.test(normalizedQuery);
}

function isStudentRepresentationQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(representacion estudiantil|representante estudiantil|delegados estudiantiles)/.test(normalizedQuery);
}

function isUniversityFunctionsQuestion(query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  return /(funciones fundamentales|funciones principales|funciones basicas|funciones de la universidad|funciones de la uasd)/.test(normalizedQuery) && /(universidad|uasd)/.test(normalizedQuery);
}

function keepPrimaryArticleChunks(chunks: string[]): string[] {
  const primaryArticle = extractArticleReference(chunks[0] ?? "");
  if (!primaryArticle) return chunks;

  const primaryChunks = chunks.filter((chunk) => extractArticleReference(chunk) === primaryArticle);
  return primaryChunks.length > 0 ? primaryChunks : chunks;
}

function removeArticleHeading(text: string): string {
  return text
    .replace(/\bART[IÍ]CULO\s+\d+[\.:]?\s*/i, "")
    .replace(/\bCAP[IÍ]TULO\s+[IVXLCDM\d]+[\.:]?\s*/i, "")
    .replace(/\bSECCI[ÓO]N\s+[IVXLCDM\d]+[\.:]?\s*/i, "")
    .trim();
}

function cleanOutputText(text: string): string {
  return text
    .replace(/\b\d{1,3}\s+Estatuto Org[aá]nico\b/gi, "")
    .replace(/\bEstatuto Org[aá]nico\s+\d{1,3}\b/gi, "")
    .replace(/\.{3,}/g, ".")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.]+/, "")
    .trim();
}

function buildKnownParaphrase(context: string, article: string | null, query = ""): string | null {
  const normalizedContext = normalizeForMatch(context);

  if (isGeneralStatuteQuestion(query)) {
    return [
      "El Estatuto Orgánico de la UASD establece la organización y funcionamiento de la Universidad Autónoma de Santo Domingo.",
      "Define su naturaleza como institución pública autónoma, su estructura de gobierno (Claustro Mayor, Claustro Menor, Consejo Universitario), los derechos y deberes de estudiantes, y las funciones de las autoridades universitarias.",
      "También regula la vida académica, la investigación, la extensión y los procesos electorales."
    ].join("\n");
  }

  if (article === "Artículo 3" && normalizedContext.includes("patrimonio social publico")) {
    return [
      "La UASD se define como una institución pública de educación superior de alto interés social y estratégico dentro del sistema estatal dominicano.",
      "Su estructura incluye la sede central, recintos, centros y subcentros, con centralización normativa, descentralización operativa y régimen de autonomía.",
    ].join("\n");
  }

  if (article === "Artículo 7" && normalizedContext.includes("es mision de la universidad")) {
    return [
      "La misión de la UASD es elevar el nivel cultural de la sociedad, buscar la verdad y contribuir al desarrollo sostenible del país.",
      "También comprende formar profesionales e investigadores críticos, promover la investigación, la paz, la justicia social, los derechos humanos, la creatividad y la defensa del medio ambiente.",
    ].join("\n");
  }

  if (article === "Artículo 10" && normalizedContext.includes("actividades de la universidad deben dirigirse")) {
    return [
      "Los fines de la Universidad se orientan a ampliar la educación, servir a los intereses nacionales y formar profesionales y técnicos conforme a las necesidades del país.",
      "También incluyen impulsar la investigación, la extensión cultural y científica, la capacitación académica, los valores espirituales, los derechos humanos y el intercambio universitario internacional.",
    ].join("\n");
  }

  if (
    article === "Artículo 11" &&
    (normalizedContext.includes("criterio de autonomia") || isAutonomyQuestion(query))
  ) {
    return [
      "El Estatuto establece la autonomía universitaria como un criterio rector de la institución.",
      "Esta autonomía implica mantener el fuero universitario y preservar la independencia de la Universidad en los ámbitos administrativo, educativo, político, religioso y económico.",
    ].join("\n");
  }

  if (
    article === "Artículo 13" &&
    (normalizedContext.includes("estructura multiple") || isOrganizationQuestion(query))
  ) {
    return [
      "La Universidad está organizada en una estructura múltiple formada por organismos interrelacionados para cumplir sus fines y funciones.",
      "Esa estructura incluye organismos de gobierno colegiados y unipersonales, además de las instancias académicas, administrativas y de apoyo previstas por el Estatuto.",
    ].join("\n");
  }

  if (isMajorClaustroQuestion(query)) {
    return [
      "El Claustro Mayor es la autoridad máxima de la Universidad Autónoma de Santo Domingo.",
      "Está integrado por personal académico activo, profesores meritísimos, representantes estudiantiles y representantes del personal administrativo, conforme a las proporciones establecidas por el Estatuto.",
    ].join("\n");
  }

  if (isMinorClaustroQuestion(query)) {
    return [
      "El Claustro Menor es un organismo claustral integrado por el Consejo Universitario, profesores elegidos para ese fin, representación estudiantil y representantes del personal administrativo.",
      "Su composición equivale a una proporción del Claustro Mayor, dentro de los límites establecidos por el Estatuto.",
    ].join("\n");
  }

  if (isUniversityCouncilQuestion(query)) {
    return [
      "El Consejo Universitario es un órgano compuesto por el Rector, quien lo preside, los vicerrectores, decanos, representantes de recintos y centros, delegados estudiantiles y representantes gremiales.",
      "El Secretario General actúa como secretario del Consejo, con voz pero sin voto.",
    ].join("\n");
  }

  if (isRectorFunctionsQuestion(query)) {
    return [
      "El Rector debe velar por el cumplimiento del Estatuto, los reglamentos y las resoluciones de los organismos superiores de la Universidad.",
      "También preside sesiones, representa legalmente a la institución, supervisa la labor universitaria, autoriza actuaciones administrativas y ejerce las atribuciones previstas por el Estatuto.",
    ].join("\n");
  }

  if (article === "Artículo 16" && isFacultyQuestion(query)) {
    return [
      "Las Facultades son las unidades fundamentales de la Universidad y deben estar constituidas por al menos dos escuelas.",
      "Sus funciones de docencia, investigación y extensión se organizan mediante cátedras, escuelas e institutos, conforme a sus necesidades académicas y de servicio.",
    ].join("\n");
  }

  if (article === "Artículo 97" && isStudentsGeneralQuestion(query)) {
    return [
      "El Estatuto establece que para inscribirse en la Universidad se requiere título de bachiller o equivalente, expedido o convalidado por el organismo competente.",
      "También prevé que ciertos programas puedan exigir requisitos especiales de admisión conforme a los reglamentos universitarios.",
    ].join("\n");
  }

  if (article === "Artículo 100" && isStudentRightsQuestion(query)) {
    return [
      "Los estudiantes tienen derechos como asociarse, elegir y ser elegidos, preservar su integridad física y moral, y estar representados en los organismos de gobierno universitario.",
      "También pueden presentar acusaciones y defensas ante los organismos de cogobierno, además de otros derechos reconocidos por los reglamentos.",
    ].join("\n");
  }

  if (article === "Artículo 101" && isStudentDutiesQuestion(query)) {
    return [
      "Los estudiantes deben asistir a sus actividades académicas, cumplir las normas universitarias y mantener una conducta digna dentro y fuera de la Universidad.",
      "También deben cooperar con actividades institucionales, cuidar el patrimonio universitario, votar en los procesos estudiantiles y respetar las reglas éticas y reglamentarias.",
    ].join("\n");
  }

  if (article === "Artículo 21" && isResearchQuestion(query)) {
    return [
      "El Estatuto vincula la investigación con los institutos adscritos a las facultades, destinados a producir nuevos conocimientos y tecnologías.",
      "Estos organismos apoyan la investigación y contribuyen al perfeccionamiento de la docencia en coordinación con escuelas, cátedras y unidades de posgrado.",
    ].join("\n");
  }

  if (article === "Artículo 143" && isPostgraduateQuestion(query)) {
    return [
      "Para inscribirse en programas de posgrado se requiere poseer título de licenciado o su equivalente.",
      "Además, deben cumplirse los requisitos adicionales establecidos por los reglamentos correspondientes.",
    ].join("\n");
  }

  if (isPatrimonyQuestion(query)) {
    return [
      "Son propiedad de la Universidad todos los bienes de cualquier naturaleza que figuren en su patrimonio.",
      "Estos bienes deben ser identificados, ubicados físicamente y dados a conocer públicamente, conforme a lo establecido por el Estatuto.",
    ].join("\n");
  }

  if (isDisciplinaryRegimeQuestion(query)) {
    return [
      "El Estatuto establece un régimen disciplinario para todos los miembros de la comunidad universitaria.",
      "Este régimen incluye procedimientos para la aplicación de sanciones por faltas cometidas, garantizando el debido proceso y el derecho a la defensa.",
    ].join("\n");
  }

  if (isWellbeingQuestion(query)) {
    return [
      "La Universidad promoverá el bienestar universitario a través de servicios de orientación, apoyo psicológico y programas de desarrollo personal.",
      "Estos servicios están dirigidos a estudiantes, profesores y personal administrativo para favorecer su desarrollo integral y calidad de vida.",
    ].join("\n");
  }

  if (isExtensionQuestion(query)) {
    return [
      "La extensión universitaria es una función fundamental que proyecta la Universidad hacia la comunidad a través de programas culturales, educativos y de servicio social.",
      "Esta función incluye actividades de difusión cultural, programas de educación continua, y colaboración con instituciones públicas y privadas para el desarrollo social.",
    ].join("\n");
  }

  if (isPrinciplesQuestion(query)) {
    return [
      "La Universidad se orienta por principios de autonomía, libertad académica, democracia, justicia social y excelencia educativa.",
      "Estos principios fundamentan su misión de formar profesionales comprometidos con el desarrollo de la sociedad dominicana.",
    ].join("\n");
  }

  if (isGovernmentBodiesQuestion(query)) {
    return [
      "Los organismos de gobierno de la UASD incluyen el Claustro Mayor, el Claustro Menor, el Consejo Universitario, la Rectoría y las Vicerrectorías.",
      "También existen los Consejos de Facultad y otros órganos colegiados que participan en la toma de decisiones académicas y administrativas.",
    ].join("\n");
  }

  if (isUniversityCouncilFunctionsQuestion(query)) {
    return [
      "El Consejo Universitario tiene como atribuciones principales dictar las políticas generales de la Universidad, aprobar el presupuesto, y resolver los asuntos académicos y administrativos de mayor importancia.",
      "También tiene competencia para crear, modificar o suprimir facultades, escuelas y dependencias, así como para nombrar y remover personal académico y administrativo.",
    ].join("\n");
  }

  if (isVicerectorFunctionsQuestion(query)) {
    return [
      "Los Vicerrectores auxilian al Rector en el gobierno de la Universidad y tienen a su cargo la dirección de las áreas académicas, administrativas y de extensión.",
      "Cada Vicerrector coordina las actividades de su respectiva área y representa al Rector en las funciones que este le delegue.",
    ].join("\n");
  }

  if (isFacultyOrganizationQuestion(query)) {
    return [
      "Las Facultades se organizan en departamentos académicos que agrupan áreas de conocimiento afines, cada uno dirigido por un Jefe de Departamento.",
      "Cada Facultad cuenta con un Consejo de Facultad, presidido por el Decano, que coordina las actividades académicas y administrativas de la facultad.",
    ].join("\n");
  }

  if (isFacultyCouncilQuestion(query)) {
    return [
      "Los Consejos Directivos de Facultad son órganos colegiados que dirigen y administran cada facultad, presididos por el Decano e integrados por profesores, estudiantes y representantes administrativos.",
      "Tienen como función principal coordinar las actividades académicas, administrativas y de investigación de la facultad, así como evaluar el personal académico.",
    ].join("\n");
  }

  if (isSchoolQuestion(query)) {
    return [
      "Las Escuelas son unidades académicas que agrupan carreras afines dentro de una Facultad, dirigidas por un Director de Escuela.",
      "Su función es organizar y coordinar los programas de estudio, así como gestionar los recursos académicos necesarios para la formación de los estudiantes en su área específica.",
    ].join("\n");
  }

  if (isSchoolDirectorFunctionsQuestion(query)) {
    return [
      "Los Directores de Escuela tienen como función principal dirigir y administrar la escuela, coordinando los programas académicos y supervisando el personal docente.",
      "También son responsables de planificar y evaluar las actividades de enseñanza, así como de representar a la escuela ante el Consejo de Facultad.",
    ].join("\n");
  }

  if (isCampusesCentersQuestion(query)) {
    return [
      "Los Recintos, Centros y Subcentros Universitarios son extensiones de la UASD que permiten la descentralización operativa y el acceso a la educación superior en diferentes regiones del país.",
      "Cada recinto, centro y subcentro opera bajo la normativa central de la Universidad con autonomía administrativa para adaptarse a las necesidades de su localidad.",
    ].join("\n");
  }

  if (isFacultyRightsQuestion(query)) {
    return [
      "El personal docente tiene derecho a la libertad de cátedra, a participar en los órganos de gobierno universitario, y a recibir estímulos por su labor académica y de investigación.",
      "También tiene derecho a la estabilidad laboral, a la formación y actualización profesional, y a un salario justo acorde con sus funciones y responsabilidades.",
    ].join("\n");
  }

  if (isFacultyDutiesQuestion(query)) {
    return [
      "El personal docente tiene el deber de cumplir con las funciones docentes, de investigación y de extensión establecidas en el Estatuto y los reglamentos.",
      "También debe mantener la actualización académica, participar en las actividades de la facultad, y respetar los principios éticos y normas de conducta de la Universidad.",
    ].join("\n");
  }

  if (isStudentRepresentationQuestion(query)) {
    return [
      "La representación estudiantil permite que los estudiantes participen en los órganos de gobierno universitario, como el Consejo Universitario y los Consejos de Facultad.",
      "Los representantes estudiantiles son elegidos democráticamente y tienen voz y voto en las decisiones académicas y administrativas que afectan a la comunidad estudiantil.",
    ].join("\n");
  }

  if (isUniversityFunctionsQuestion(query)) {
    return [
      "Las funciones fundamentales de la UASD son la docencia, la investigación y la extensión universitaria.",
      "La docencia se encarga de la formación de profesionales, la investigación genera nuevos conocimientos, y la extensión proyecta la Universidad hacia la comunidad.",
    ].join("\n");
  }

  return null;
}

function toBriefInstitutionalSummary(context: string): string {
  const normalized = cleanOutputText(removeArticleHeading(context));

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 2);

  const summary = sentences.join(" ");
  if (summary.length <= 450) return summary;

  const boundary = Math.max(
    summary.lastIndexOf(".", 450),
    summary.lastIndexOf(";", 450),
    summary.lastIndexOf(",", 450),
  );

  return summary.slice(0, boundary > 220 ? boundary + 1 : 450).trim();
}

function enforceResponseRules(response: string, article: string | null): string {
  const cleanResponse = response
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\bArtículo\s+\d+\s*:\s*/gi, "")
    .replace(/\bSegún\s+el\s+Artículo\s+\d+\.?/gi, "")
    .replace(/\b(chunk|fragmento|contexto)\s+\d*:?/gi, "")
    .replace(/\s+\n/g, "\n");

  const cleanedText = cleanOutputText(cleanResponse);

  if (!cleanedText || cleanedText === NOT_FOUND_MESSAGE) {
    return NOT_FOUND_MESSAGE;
  }

  const linesLimit = article ? 6 : 7;
  const lines = cleanedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, linesLimit);

  let finalResponse = lines.join("\n");

  if (article && !new RegExp(`Según\\s+el\\s+${article}`, "i").test(finalResponse)) {
    finalResponse = `${finalResponse}\nSegún el ${article}.`;
  }

  return finalResponse;
}

function buildLocalFallback(context: string): string {
  const article = extractArticleReference(context);
  const summary = buildKnownParaphrase(context, article) ?? toBriefInstitutionalSummary(context);

  if (!article || !summary) {
    return NOT_FOUND_MESSAGE;
  }

  return `${summary}\nSegún el ${article}.`;
}

export class ChatbotService {
  static async getResponse(query: string) {
    // Detectar saludos y responder de forma amigable
    if (isGreeting(query)) {
      return "Hola, ¿en qué puedo ayudarte sobre la UASD?";
    }

    // Detectar preguntas generales sobre el Estatuto y dar resumen
    if (isGeneralStatuteQuestion(query)) {
      const summary = buildKnownParaphrase("", null, query);
      if (summary) {
        return `${summary}\n\n¿Te gustaría saber más sobre algún aspecto específico del Estatuto?`;
      }
    }

    let context = "";

    try {
      console.log("Iniciando orquestacion de respuesta para:", query);

      const relevantChunks = await searchRelevantChunks(query, 4);

      if (relevantChunks.length === 0) {
        return NOT_FOUND_MESSAGE;
      }

      const primaryChunks = keepPrimaryArticleChunks(relevantChunks);

      context = primaryChunks
        .map((chunk) => chunk.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n\n");
      const article = extractArticleReference(context);
      const directSummary =
        isInstitutionalDefinitionQuestion(query) ||
        isMissionQuestion(query) ||
        isInstitutionalPurposeQuestion(query) ||
        isAutonomyQuestion(query) ||
        isOrganizationQuestion(query) ||
        isMajorClaustroQuestion(query) ||
        isMinorClaustroQuestion(query) ||
        isUniversityCouncilQuestion(query) ||
        isRectorFunctionsQuestion(query) ||
        isFacultyQuestion(query) ||
        isStudentsGeneralQuestion(query) ||
        isStudentRightsQuestion(query) ||
        isStudentDutiesQuestion(query) ||
        isResearchQuestion(query) ||
        isPostgraduateQuestion(query) ||
        isPatrimonyQuestion(query) ||
        isDisciplinaryRegimeQuestion(query) ||
        isWellbeingQuestion(query) ||
        isExtensionQuestion(query) ||
        isPrinciplesQuestion(query) ||
        isGovernmentBodiesQuestion(query) ||
        isUniversityCouncilFunctionsQuestion(query) ||
        isVicerectorFunctionsQuestion(query) ||
        isFacultyOrganizationQuestion(query) ||
        isFacultyCouncilQuestion(query) ||
        isSchoolQuestion(query) ||
        isSchoolDirectorFunctionsQuestion(query) ||
        isCampusesCentersQuestion(query) ||
        isFacultyRightsQuestion(query) ||
        isFacultyDutiesQuestion(query) ||
        isStudentRepresentationQuestion(query) ||
        isUniversityFunctionsQuestion(query)
        ? buildKnownParaphrase(context, article, query)
        : null;

      if (directSummary) {
        const articleRef = article ? `Según el ${article}.` : "Según el Estatuto Orgánico.";
        return `${directSummary}\n${articleRef}`;
      }

      const prompt = `
Eres un asistente virtual especializado en responder preguntas sobre la Universidad Autónoma de Santo Domingo (UASD) y su Estatuto Orgánico. Responde de forma clara, breve y precisa, utilizando únicamente la información disponible en el contenido proporcionado.

Reglas de comportamiento:

Si el usuario saluda (ej: "hola", "buenos días", "hey"), responde de forma amigable y orientada a ayuda. No menciones el Estatuto ni digas que no se encontró información. Ejemplo:
"Hola, ¿en qué puedo ayudarte sobre la UASD?"

Si el usuario pide explicaciones generales o amplias (ej: "explícame el estatuto", "resúmelo", "qué dice el estatuto"), NO rechaces. Debes dar un resumen general basado en el contenido conocido (organización, estudiantes, gobierno, etc.). Si es muy amplio, puedes responder por partes o dar un resumen corto.

Si la pregunta está relacionada con la universidad o el Estatuto, responde usando la información disponible de forma clara y resumida.

Si la información NO existe en el contenido proporcionado, responde exactamente:
"No se encontró esa información en el Estatuto."

No inventes información ni hagas suposiciones.

Mantén un tono formal pero sencillo, adecuado para estudiantes.

Si la pregunta es ambigua, pide aclaración antes de responder.

CONTEXTO DEL ESTATUTO:
${context}

PREGUNTA DEL USUARIO:
${query}

RESPUESTA:
      `;

      console.log("Llamando a Gemini para redaccion academica...");
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();

      return enforceResponseRules(response, article);
    } catch (error) {
      console.error("Error en Gemini, activando respaldo local:", error);

      if (context) {
        return buildLocalFallback(context);
      }

      throw new Error(NOT_FOUND_MESSAGE);
    }
  }
}
