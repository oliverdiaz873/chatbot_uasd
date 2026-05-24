"use client";

import { SUGGESTED_QUESTIONS } from "@/utils/constants";
import { motion } from "framer-motion";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export default function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-4 max-w-4xl mx-auto px-4">
      {SUGGESTED_QUESTIONS.map((question, index) => (
        <motion.button
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onSelect(question)}
          className="px-4 py-2 text-xs md:text-sm bg-white border border-gray-200 text-gray-700 rounded-full hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm active:scale-95"
        >
          {question}
        </motion.button>
      ))}
    </div>
  );
}
