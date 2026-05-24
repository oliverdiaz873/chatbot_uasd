import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("Falta la variable de entorno GOOGLE_API_KEY");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Usamos el SDK directo en versión v1 para máxima compatibilidad.
 * Si gemini-1.5-flash falla, el sistema tiene un respaldo local.
 */
export const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
}, { apiVersion: 'v1' });
