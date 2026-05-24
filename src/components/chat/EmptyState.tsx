"use client";

import { MessageSquare, BookOpen, ShieldCheck } from "lucide-react";
import SuggestedQuestions from "./SuggestedQuestions";

interface EmptyStateProps {
  onSelectQuestion: (question: string) => void;
}

export default function EmptyState({ onSelectQuestion }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
        <BookOpen size={32} />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
        Consulta del Estatuto Orgánico UASD
      </h1>
      <p className="text-gray-500 max-w-md mb-8">
        Haz cualquier pregunta sobre el estatuto de la Universidad Autónoma de Santo Domingo y obtén respuestas basadas exclusivamente en el documento oficial.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl mb-12">
        <FeatureCard 
          icon={<MessageSquare size={20} />}
          title="Lenguaje Natural"
          description="Pregunta como si hablaras con un experto."
        />
        <FeatureCard 
          icon={<ShieldCheck size={20} />}
          title="Respuestas Veraces"
          description="Basado únicamente en el PDF oficial."
        />
        <FeatureCard 
          icon={<BookOpen size={20} />}
          title="Contexto Institucional"
          description="Cita artículos y secciones relevantes."
        />
      </div>

      <div className="w-full">
        <p className="text-sm font-medium text-gray-400 mb-4">Preguntas sugeridas</p>
        <SuggestedQuestions onSelect={onSelectQuestion} />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
      <div className="text-blue-600 mb-2 flex justify-center">{icon}</div>
      <h3 className="font-semibold text-gray-800 text-sm mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
