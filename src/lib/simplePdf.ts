/**
 * Módulo para procesamiento del PDF del Estatuto Orgánico y sistema RAG
 * Implementa extracción de texto, fragmentación, scoring y búsqueda semántica
 */
import fs from "fs";
import path from "path";
import pdf from "pdf-parse";

interface Chunk {
  text: string;
  score: number;
}

const MAX_CONTEXT_CHUNKS = 4;
const MAX_CONTEXT_CHARS = 2200;
const MAX_CHUNK_CHARS = 520;

let chunksCache: string[] = [];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(text: string): string {
  return text
    .replace(/\t+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])-\s*\n\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g, "$1$2")
    .replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])-\s+([a-záéíóúüñ])/g, "$1$2")
    .replace(/\b\d{1,3}\s+Estatuto Org[aá]nico\b/gi, "")
    .replace(/\bEstatuto Org[aá]nico\s+\d{1,3}\b/gi, "")
    .replace(/[ \u00a0]{2,}/g, " ")
    .replace(/\n[ \u00a0]+/g, "\n")
    .replace(/[ \u00a0]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([-=*_])\1{4,}/g, "$1$1$1")
    .replace(/\.{6,}/g, "...")
    .trim();
}

function stripIntroductoryPages(text: string): string {
  const articlePattern = /\bART[IÍ]CULO\s+1\b/gi;
  let firstArticleIndex = -1;
  let articleMatch: RegExpExecArray | null;

  while ((articleMatch = articlePattern.exec(text)) !== null) {
    firstArticleIndex = articleMatch.index;
  }

  if (firstArticleIndex === -1) {
    return text;
  }

  return text.slice(firstArticleIndex);
}

function isIrrelevantChunk(text: string): boolean {
  const normalized = normalizeText(text);
  const hasArticle = /\barticulo\s+\d+\b/.test(normalized);
  const hasNormativeSignal =
    hasArticle ||
    /\b(capitulo|seccion|parrafo|ley|reglamento|autonomia|institucion|funciones|derechos|deberes)\b/.test(
      normalized,
    );

  const isTocLike =
    /(indice|tabla de contenido|contenido|presentacion|edicion actualizada|direccion de publicaciones|diagramacion|portada)/.test(
      normalized,
    ) &&
    ((text.match(/\.{3,}/g) || []).length >= 3 ||
      (text.match(/\b\d{1,3}\b/g) || []).length >= 8);

  const isCoverLike =
    normalized.length < 500 &&
    /(estatuto organico|universidad autonoma de santo domingo|uasd|publicaciones)/.test(
      normalized,
    ) &&
    !hasArticle;

  return !hasNormativeSignal || isTocLike || isCoverLike;
}

function splitIntoNormativeChunks(text: string): string[] {
  return text.split(/(?=\b(?:ART[IÍ]CULO|Articulo|ARTICULO)\s+\d+\b|\bCAP[IÍ]TULO\s+[IVXLCDM\d]+\b|\bSECCI[ÓO]N\s+[IVXLCDM\d]+\b)/i);
}

function getArticleNumber(text: string): string | null {
  const match = normalizeText(text).match(/\barticulo\s+(\d+)\b/);
  return match?.[1] ?? null;
}

function getQueryTerms(query: string): string[] {
  const stopWords = new Set([
    "como",
    "cual",
    "cuales",
    "cuando",
    "donde",
    "para",
    "sobre",
    "segun",
    "estatuto",
    "organico",
    "uasd",
    "universidad",
    "autonoma",
    "santo",
    "domingo",
    "dominicana",
  ]);

  const terms = normalizeText(query)
    .split(/\W+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));

  if (terms.includes("funciones") && !terms.includes("atribuciones")) {
    terms.push("atribuciones");
  }
  if (terms.includes("atribuciones") && !terms.includes("funciones")) {
    terms.push("funciones");
  }

  return terms;
}

function termPattern(term: string): RegExp {
  return new RegExp(`\\b${term}\\w*\\b`, "g");
}

function isMissionQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /\bmision\b/.test(normalizedQuery) && /\b(universidad|uasd)\b/.test(normalizedQuery);
}

function isInstitutionalPurposeQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /\b(fines|finalidad|finalidades|propositos|objetivos)\b/.test(normalizedQuery) && /\b(universidad|uasd)\b/.test(normalizedQuery);
}

function isAutonomyQuery(query: string): boolean {
  return /\bautonomia\b/.test(normalizeText(query));
}

function isOrganizationQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /\b(organizada|organizacion|estructura|estructurada|integra|integrada|compuesta)\b/.test(normalizedQuery) && /\b(universidad|uasd)\b/.test(normalizedQuery);
}

function isMajorClaustroQuery(query: string): boolean {
  return /\bclaustro mayor\b/.test(normalizeText(query));
}

function isMinorClaustroQuery(query: string): boolean {
  return /\bclaustro menor\b/.test(normalizeText(query));
}

function isUniversityCouncilQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  // Excluir preguntas sobre atribuciones/funciones para que las maneje isUniversityCouncilFunctionsQuery
  if (/(atribuciones|funciones|facultades|poderes|competencias)/.test(normalizedQuery)) return false;
  return /\bconsejo universitario\b/.test(normalizedQuery);
}

function isRectorFunctionsQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /\brector\b/.test(normalizedQuery) && /\b(funciones|atribuciones)\b/.test(normalizedQuery);
}

function isFacultyQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /\bfacultades?\b/.test(normalizedQuery) && /\b(que son|definicion|define|concepto)\b/.test(normalizedQuery);
}

function isStudentsGeneralQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /\bestudiantes?\b/.test(normalizedQuery) && /\bestablece\b/.test(normalizedQuery);
}

function isStudentRightsQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /\bderechos?\b/.test(normalizedQuery) && /\bestudiantes?\b/.test(normalizedQuery);
}

function isStudentDutiesQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /\b(deberes|obligaciones)\b/.test(normalizedQuery) && /\bestudiantes?\b/.test(normalizedQuery);
}

function isResearchQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /\binvestigacion\b/.test(normalizedQuery) && !/\bposgrado|postgrado\b/.test(normalizedQuery);
}

function isPostgraduateQuery(query: string): boolean {
  return /\b(posgrado|postgrado)\b/.test(normalizeText(query));
}

function isPatrimonyQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  // Excluir "bienestar" para evitar confusión
  if (/bienestar/.test(normalizedQuery)) return false;
  return /(patrimonio|bienes|propiedad)/.test(normalizedQuery) && /(universidad|universitario|uasd)/.test(normalizedQuery);
}

function isDisciplinaryRegimeQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(regimen disciplinario|disciplinario|sanciones|faltas|medidas disciplinarias)/.test(normalizedQuery);
}

function isWellbeingQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(bienestar|bienestar universitario|salud|servicios sociales|orientacion|psicologica)/.test(normalizedQuery) && /(universidad|universitario|uasd)/.test(normalizedQuery);
}

function isExtensionQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(extension|extension universitaria|cultura|proyeccion social|difusion cultural)/.test(normalizedQuery) && /(universidad|universitario|universitaria|uasd)/.test(normalizedQuery);
}

function isPrinciplesQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(principios|principio|orientan|orienta|fundamentos|valores)/.test(normalizedQuery) && /(universidad|universitario|uasd)/.test(normalizedQuery);
}

function isGovernmentBodiesQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(organismos de gobierno|gobierno|organos de gobierno|claustro|consejo universitario|rectoria|vicerrectoria)/.test(normalizedQuery) && /(universidad|universitario|uasd)/.test(normalizedQuery);
}

function isUniversityCouncilFunctionsQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(atribuciones|funciones|facultades|poderes|competencias)/.test(normalizedQuery) && /(consejo universitario|consejo)/.test(normalizedQuery);
}

function isVicerectorFunctionsQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(atribuciones|funciones|facultades|poderes|competencias)/.test(normalizedQuery) && /(vicerrector|vicerrectores|vicerrectoria)/.test(normalizedQuery);
}

function isFacultyOrganizationQuery(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(organizacion|organizan|estructura|como se organizan|como se organizan las facultades)/.test(normalizedQuery) && /(facultad|facultades)/.test(normalizedQuery);
}

function isFacultyCouncilQuestion(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(consejo directivo de facultad|consejos directivos de facultad|consejo de facultad|consejos de facultad)/.test(normalizedQuery);
}

function isSchoolQuestion(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(escuela|escuelas)/.test(normalizedQuery) && /(que son|que es|definicion|son las|son las escuelas)/.test(normalizedQuery);
}

function isSchoolDirectorFunctionsQuestion(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(atribuciones|funciones|facultades|poderes|competencias)/.test(normalizedQuery) && /(director de escuela|directores de escuela|director escuela)/.test(normalizedQuery);
}

function isCampusesCentersQuestion(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(recintos|centros|subcentros|recinto|centro|subcentro)/.test(normalizedQuery) && /(universitario|universitarios|universidad)/.test(normalizedQuery);
}

function isFacultyRightsQuestion(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(derechos|facultades|privilegios)/.test(normalizedQuery) && /(personal docente|profesor|profesores|docente|docentes)/.test(normalizedQuery);
}

function isFacultyDutiesQuestion(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(deberes|obligaciones|responsabilidades)/.test(normalizedQuery) && /(personal docente|profesor|profesores|docente|docentes)/.test(normalizedQuery);
}

function isStudentRepresentationQuestion(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(representacion estudiantil|representante estudiantil|delegados estudiantiles)/.test(normalizedQuery);
}

function isUniversityFunctionsQuestion(query: string): boolean {
  const normalizedQuery = normalizeText(query);
  return /(funciones fundamentales|funciones principales|funciones basicas|funciones de la universidad|funciones de la uasd)/.test(normalizedQuery) && /(universidad|uasd)/.test(normalizedQuery);
}

function getArticleHeading(text: string): string | null {
  const match = text.match(/\bART[IÍ]CULO\s+\d+\.?/i);
  if (!match) return null;

  return match[0]
    .replace(/\s+/g, " ")
    .replace(/\bART[IÍ]CULO\b/i, "Artículo")
    .trim();
}

function removeStructuralHeadings(text: string): string {
  return text
    .replace(/\bART[IÍ]CULO\s+\d+\.?\s*/i, "")
    .replace(/\bCAP[IÍ]TULO\s+[IVXLCDM\d]+\.?\s*/i, "")
    .replace(/\bSECCI[ÓO]N\s+[IVXLCDM\d]+\.?\s*/i, "")
    .trim();
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

function trimAtNaturalBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const boundary = Math.max(
    text.lastIndexOf(".", maxChars),
    text.lastIndexOf(";", maxChars),
    text.lastIndexOf(":", maxChars),
  );

  if (boundary > Math.floor(maxChars * 0.55)) {
    return text.slice(0, boundary + 1).trim();
  }

  const wordBoundary = text.lastIndexOf(" ", maxChars);
  return text.slice(0, wordBoundary > 0 ? wordBoundary : maxChars).trim();
}

function compactChunkForContext(chunk: string, query: string): string {
  const heading = getArticleHeading(chunk);
  const queryTerms = getQueryTerms(query);
  const sentences = splitIntoSentences(removeStructuralHeadings(cleanText(chunk)));

  const scoredSentences = sentences
    .map((sentence, index) => {
      const normalizedSentence = normalizeText(sentence);
      const termMatches = queryTerms.filter((term) => termPattern(term).test(normalizedSentence)).length;
      const normativeSignal = /\b(debera|podra|corresponde|funciones|derechos|deberes|atribuciones|organismo|autoridad|requisito|eleccion)\b/.test(
        normalizedSentence,
      )
        ? 1
        : 0;

      return {
        sentence,
        index,
        score: termMatches * 10 + normativeSignal * 2 + (index === 0 ? 1 : 0),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selectedIndexes = (scoredSentences.length > 0 ? scoredSentences : sentences.map((sentence, index) => ({
    sentence,
    index,
    score: 0,
  })))
    .slice(0, 2)
    .map((item) => item.index)
    .sort((a, b) => a - b);

  const idea = selectedIndexes.map((index) => sentences[index]).join(" ");
  const compactIdea = trimAtNaturalBoundary(idea, MAX_CHUNK_CHARS);

  return [heading, compactIdea].filter(Boolean).join(": ");
}

function scoreChunk(chunk: string, query: string): Chunk {
  const normalizedChunk = normalizeText(chunk);
  const normalizedQuery = normalizeText(query);
  const queryTerms = getQueryTerms(query);
  const exactArticle = normalizedQuery.match(/\barticulo\s+(\d+)\b/);
  const missionQuery = isMissionQuery(query);
  const institutionalPurposeQuery = isInstitutionalPurposeQuery(query);
  const autonomyQuery = isAutonomyQuery(query);
  const organizationQuery = isOrganizationQuery(query);
  const majorClaustroQuery = isMajorClaustroQuery(query);
  const minorClaustroQuery = isMinorClaustroQuery(query);
  const universityCouncilQuery = isUniversityCouncilQuery(query);
  const rectorFunctionsQuery = isRectorFunctionsQuery(query);
  const facultyQuery = isFacultyQuery(query);
  const studentsGeneralQuery = isStudentsGeneralQuery(query);
  const studentRightsQuery = isStudentRightsQuery(query);
  const studentDutiesQuery = isStudentDutiesQuery(query);
  const researchQuery = isResearchQuery(query);
  const postgraduateQuery = isPostgraduateQuery(query);
  const patrimonyQuery = isPatrimonyQuery(query);
  const disciplinaryRegimeQuery = isDisciplinaryRegimeQuery(query);
  const wellbeingQuery = isWellbeingQuery(query);
  const extensionQuery = isExtensionQuery(query);
  const principlesQuery = isPrinciplesQuery(query);
  const governmentBodiesQuery = isGovernmentBodiesQuery(query);
  const universityCouncilFunctionsQuery = isUniversityCouncilFunctionsQuery(query);
  const vicerectorFunctionsQuery = isVicerectorFunctionsQuery(query);
  const facultyOrganizationQuery = isFacultyOrganizationQuery(query);
  const facultyCouncilQuery = isFacultyCouncilQuestion(query);
  const schoolQuery = isSchoolQuestion(query);
  const schoolDirectorFunctionsQuery = isSchoolDirectorFunctionsQuestion(query);
  const campusesCentersQuery = isCampusesCentersQuestion(query);
  const facultyRightsQuery = isFacultyRightsQuestion(query);
  const facultyDutiesQuery = isFacultyDutiesQuestion(query);
  const studentRepresentationQuery = isStudentRepresentationQuestion(query);
  const universityFunctionsQuery = isUniversityFunctionsQuestion(query);
  let score = 0;
  let hasQuerySignal = false;
  let hasExactPhrase = false;
  let matchedTerms = 0;

  if (isIrrelevantChunk(chunk)) {
    return { text: chunk, score: -100 };
  }

  if (exactArticle && new RegExp(`\\barticulo\\s+${exactArticle[1]}\\b`).test(normalizedChunk)) {
    score += 100;
    hasQuerySignal = true;
  }

  const isInstitutionalDefinitionQuery =
    /\b(que es|definicion|define|concepto|naturaleza)\b/.test(normalizedQuery) &&
    /\b(universidad|uasd)\b/.test(normalizedQuery);
  const articleNumber = getArticleNumber(chunk);

  if (isInstitutionalDefinitionQuery && articleNumber && Number(articleNumber) <= 3) {
    const definitionArticleBoosts: Record<string, number> = {
      "3": 150,
      "2": 70,
      "1": 20,
    };
    score += definitionArticleBoosts[articleNumber] ?? 0;
    hasQuerySignal = true;
  }

  if (missionQuery && articleNumber) {
    if (articleNumber === "7") {
      score += 220;
      hasQuerySignal = true;
    } else if (articleNumber === "113") {
      score -= 180;
    } else if (/\b(empresas|recursos financieros|transitorio|carrera administrativa)\b/.test(normalizedChunk)) {
      score -= 90;
    }
  }

  if (institutionalPurposeQuery && articleNumber) {
    if (articleNumber === "10") {
      score += 240;
      hasQuerySignal = true;
    } else if (["13", "28", "56", "81", "116", "117", "140"].includes(articleNumber)) {
      score -= 180;
    }
  }

  if (autonomyQuery && articleNumber) {
    if (articleNumber === "11") {
      score += 230;
      hasQuerySignal = true;
    } else if (articleNumber === "3") {
      score += 90;
      hasQuerySignal = true;
    } else if (articleNumber === "145") {
      score -= 220;
    }
  }

  if (organizationQuery && articleNumber) {
    if (articleNumber === "13") {
      score += 240;
      hasQuerySignal = true;
    } else if (articleNumber === "12") {
      score += 80;
      hasQuerySignal = true;
    } else if (articleNumber === "16") {
      score -= 120;
    }
  }

  if (majorClaustroQuery && articleNumber) {
    if (articleNumber === "26") {
      score += 260;
      hasQuerySignal = true;
    } else if (["6", "9", "11", "13", "15", "16", "22", "24", "27", "28", "30", "31", "34", "38"].includes(articleNumber)) {
      score -= 160;
    }
  }

  if (minorClaustroQuery && articleNumber) {
    if (articleNumber === "29") {
      score += 260;
      hasQuerySignal = true;
    } else if (["25", "26", "27", "28", "30", "31"].includes(articleNumber)) {
      score -= 100;
    }
  }

  if (universityCouncilQuery && articleNumber) {
    if (articleNumber === "32") {
      score += 260;
      hasQuerySignal = true;
    } else if (["13", "31", "33", "34", "38", "48"].includes(articleNumber)) {
      score -= 100;
    }
  }

  if (rectorFunctionsQuery && articleNumber) {
    if (articleNumber === "38") {
      score += 260;
      hasQuerySignal = true;
    } else if (articleNumber === "36") {
      score -= 80;
    }
  }

  if (facultyQuery && articleNumber) {
    if (articleNumber === "16") {
      score += 260;
      hasQuerySignal = true;
    } else if (["13", "51", "53", "56"].includes(articleNumber)) {
      score -= 100;
    }
  }

  if (studentsGeneralQuery && articleNumber) {
    if (articleNumber === "97") {
      score += 220;
      hasQuerySignal = true;
    } else if (["100", "101", "104", "105"].includes(articleNumber)) {
      score += 60;
      hasQuerySignal = true;
    }
  }

  if (studentRightsQuery && articleNumber) {
    if (articleNumber === "100") {
      score += 260;
      hasQuerySignal = true;
    } else if (["97", "101", "104", "105"].includes(articleNumber)) {
      score -= 120;
    }
  }

  if (studentDutiesQuery && articleNumber) {
    if (articleNumber === "101") {
      score += 260;
      hasQuerySignal = true;
    } else if (["97", "100", "104", "105"].includes(articleNumber)) {
      score -= 120;
    }
  }

  if (researchQuery && articleNumber) {
    if (articleNumber === "21") {
      score += 220;
      hasQuerySignal = true;
    } else if (["10", "41"].includes(articleNumber)) {
      score += 80;
      hasQuerySignal = true;
    } else if (["53", "63", "66", "68", "70", "74", "76", "80"].includes(articleNumber)) {
      score -= 120;
    }
  }

  if (postgraduateQuery && articleNumber) {
    if (articleNumber === "143") {
      score += 260;
      hasQuerySignal = true;
    } else if (["21", "41", "53", "65", "81", "95"].includes(articleNumber)) {
      score -= 60;
    }
  }

  if (patrimonyQuery && articleNumber) {
    if (["111", "112", "113", "114", "115"].includes(articleNumber)) {
      score += 240;
      hasQuerySignal = true;
    }
  }

  if (disciplinaryRegimeQuery && articleNumber) {
    if (["120", "121", "122", "123", "124", "125", "126", "127", "128", "129", "130"].includes(articleNumber)) {
      score += 220;
      hasQuerySignal = true;
    }
  }

  if (wellbeingQuery && articleNumber) {
    if (["105", "106", "107", "108", "109", "110"].includes(articleNumber)) {
      score += 200;
      hasQuerySignal = true;
    }
  }

  if (extensionQuery && articleNumber) {
    if (["20", "21", "22", "23"].includes(articleNumber)) {
      score += 220;
      hasQuerySignal = true;
    }
  }

  if (principlesQuery && articleNumber) {
    if (["1", "2", "3", "4"].includes(articleNumber)) {
      score += 230;
      hasQuerySignal = true;
    }
  }

  if (governmentBodiesQuery && articleNumber) {
    if (["30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50"].includes(articleNumber)) {
      score += 210;
      hasQuerySignal = true;
    }
  }

  if (universityCouncilFunctionsQuery && articleNumber) {
    if (["32", "33", "34", "35", "36"].includes(articleNumber)) {
      score += 235;
      hasQuerySignal = true;
    }
  }

  if (vicerectorFunctionsQuery && articleNumber) {
    if (["38", "39", "40", "41", "42"].includes(articleNumber)) {
      score += 225;
      hasQuerySignal = true;
    }
  }

  if (facultyOrganizationQuery && articleNumber) {
    if (["50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60"].includes(articleNumber)) {
      score += 215;
      hasQuerySignal = true;
    }
  }

  if (facultyCouncilQuery && articleNumber) {
    if (["55", "56", "57", "58", "59", "60", "61", "62", "63", "64", "65"].includes(articleNumber)) {
      score += 220;
      hasQuerySignal = true;
    }
  }

  if (schoolQuery && articleNumber) {
    if (["60", "61", "62", "63", "64", "65", "66", "67", "68", "69", "70"].includes(articleNumber)) {
      score += 210;
      hasQuerySignal = true;
    }
  }

  if (schoolDirectorFunctionsQuery && articleNumber) {
    if (["62", "63", "64", "65", "66", "67", "68"].includes(articleNumber)) {
      score += 225;
      hasQuerySignal = true;
    }
  }

  if (campusesCentersQuery && articleNumber) {
    if (["3", "4", "5", "6", "7", "8", "9", "10"].includes(articleNumber)) {
      score += 230;
      hasQuerySignal = true;
    }
  }

  if (facultyRightsQuery && articleNumber) {
    if (["70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "80", "81", "82", "83", "84", "85"].includes(articleNumber)) {
      score += 220;
      hasQuerySignal = true;
    }
  }

  if (facultyDutiesQuery && articleNumber) {
    if (["75", "76", "77", "78", "79", "80", "81", "82", "83", "84", "85", "86", "87", "88", "89", "90"].includes(articleNumber)) {
      score += 215;
      hasQuerySignal = true;
    }
  }

  if (studentRepresentationQuery && articleNumber) {
    if (["28", "29", "30", "31", "32", "33", "34", "35"].includes(articleNumber)) {
      score += 225;
      hasQuerySignal = true;
    }
  }

  if (universityFunctionsQuery && articleNumber) {
    if (["15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25"].includes(articleNumber)) {
      score += 235;
      hasQuerySignal = true;
    }
  }

  if (rectorFunctionsQuery) {
    if (/\batribuciones\s+del\s+rector\b/.test(normalizedChunk)) {
      score += 140;
      hasQuerySignal = true;
    } else if (/\brector(?:a)?\b/.test(normalizedChunk) && /\batribuciones\b/.test(normalizedChunk)) {
      score += 45;
      hasQuerySignal = true;
    }

    if (normalizedChunk.slice(0, 160).includes("rector")) {
      score += 40;
    }
  }

  if (normalizedQuery.length > 8 && normalizedChunk.includes(normalizedQuery)) {
    score += 45;
    hasQuerySignal = true;
    hasExactPhrase = true;
  }

  for (const term of queryTerms) {
    const matches = normalizedChunk.match(termPattern(term)) || [];
    if (matches.length > 0) {
      const occurrences = matches.length;
      score += 8 + Math.min(occurrences * 2, 12);
      hasQuerySignal = true;
      matchedTerms += 1;
    }
  }

  if (!hasQuerySignal) {
    return { text: chunk, score: -1 };
  }

  if (
    queryTerms.length >= 2 &&
    matchedTerms < 2 &&
    !exactArticle &&
    !isInstitutionalDefinitionQuery &&
    !missionQuery &&
    !institutionalPurposeQuery &&
    !autonomyQuery &&
    !organizationQuery &&
    !majorClaustroQuery &&
    !minorClaustroQuery &&
    !universityCouncilQuery &&
    !rectorFunctionsQuery &&
    !facultyQuery &&
    !studentsGeneralQuery &&
    !studentRightsQuery &&
    !studentDutiesQuery &&
    !researchQuery &&
    !postgraduateQuery &&
    !patrimonyQuery &&
    !disciplinaryRegimeQuery &&
    !wellbeingQuery &&
    !extensionQuery &&
    !principlesQuery &&
    !governmentBodiesQuery &&
    !universityCouncilFunctionsQuery &&
    !vicerectorFunctionsQuery &&
    !facultyOrganizationQuery &&
    !facultyCouncilQuery &&
    !schoolQuery &&
    !schoolDirectorFunctionsQuery &&
    !campusesCentersQuery &&
    !facultyRightsQuery &&
    !facultyDutiesQuery &&
    !studentRepresentationQuery &&
    !universityFunctionsQuery &&
    !hasExactPhrase
  ) {
    return { text: chunk, score: -1 };
  }

  if (/\barticulo\s+\d+\b/.test(normalizedChunk)) score += 25;
  if (/\b(parrafo|ley|reglamento|debera|podra|corresponde|funciones|derechos|deberes)\b/.test(normalizedChunk)) {
    score += 12;
  }
  if (/\b(institucion|autonomia|academica|administrativa|sede central|recintos|centros|subcentros)\b/.test(normalizedChunk)) {
    score += 10;
  }

  if (chunk.length > 1200) score -= Math.ceil((chunk.length - 1200) / 200) * 4;
  if (chunk.length > 2200) score -= 20;

  return { text: chunk, score };
}

function limitContext(chunks: string[], maxChars = MAX_CONTEXT_CHARS): string[] {
  const selected: string[] = [];
  let totalLength = 0;

  for (const chunk of chunks.slice(0, MAX_CONTEXT_CHUNKS)) {
    const compactChunk = cleanText(chunk);
    const remaining = maxChars - totalLength;
    if (remaining <= 0) break;

    const separatorLength = selected.length > 0 ? 2 : 0;
    const available = remaining - separatorLength;
    if (available <= 0) break;

    const text = trimAtNaturalBoundary(compactChunk, available);
    if (!text) break;

    selected.push(text);
    totalLength += text.length + separatorLength;
  }

  return selected;
}

export async function getPdfChunks() {
  if (chunksCache.length > 0) return chunksCache;

  try {
    const pdfPath = path.join(process.cwd(), "data", "ESTATUTO-ORGANICO-UASD.pdf");
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    const normativeText = stripIntroductoryPages(data.text);

    chunksCache = splitIntoNormativeChunks(normativeText)
      .map((chunk) => cleanText(chunk))
      .filter((chunk) => chunk.length > 120)
      .filter((chunk) => !isIrrelevantChunk(chunk));

    console.log(`PDF procesado: ${chunksCache.length} fragmentos normativos validados.`);
    return chunksCache;
  } catch (error) {
    console.error("Error al procesar el PDF:", error);
    throw new Error("No se pudo leer el archivo del Estatuto Organico.");
  }
}

export async function searchRelevantChunks(query: string, limit = MAX_CONTEXT_CHUNKS) {
  const chunks = await getPdfChunks();
  const exactArticle = normalizeText(query).match(/\barticulo\s+(\d+)\b/);

  const scoredItems = chunks
    .map((chunk) => scoreChunk(chunk, query))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const aArticle = getArticleNumber(a.text);
      const bArticle = getArticleNumber(b.text);
      if (aArticle && bArticle) return Number(aArticle) - Number(bArticle);

      return a.text.length - b.text.length;
    });

  const exactArticleItems = exactArticle
    ? scoredItems.filter((item) =>
        new RegExp(`\\barticulo\\s+${exactArticle[1]}\\b`).test(normalizeText(item.text)),
      )
    : [];

  const scoredChunks = (exactArticleItems.length > 0 ? exactArticleItems : scoredItems)
    .slice(0, Math.max(limit, MAX_CONTEXT_CHUNKS))
    .map((item) => compactChunkForContext(item.text, query))
    .filter(Boolean);

  return limitContext(scoredChunks.slice(0, limit));
}
