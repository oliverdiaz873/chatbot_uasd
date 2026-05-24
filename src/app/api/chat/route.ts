import { NextRequest, NextResponse } from "next/server";
import { ChatbotService } from "@/services/chatbot.service";
import { z } from "zod";

const chatSchema = z.object({
  message: z.string().min(1, "El mensaje no puede estar vacío").max(1000, "El mensaje es demasiado largo"),
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = chatSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { message } = result.data;
    
    // El servicio ahora es 100% local y offline
    const response = await ChatbotService.getResponse(message);

    return NextResponse.json({ message: response });
  } catch (error: any) {
    console.error("API Local Error:", error);
    
    return NextResponse.json(
      { 
        error: "Error al procesar la consulta en el servidor local.",
      },
      { status: 500 }
    );
  }
}
