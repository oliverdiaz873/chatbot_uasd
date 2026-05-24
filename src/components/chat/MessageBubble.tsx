"use client";

import { useState, useEffect } from "react";
import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [formattedTime, setFormattedTime] = useState<string>("");

  useEffect(() => {
    setFormattedTime(
      new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, [message.createdAt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed",
          isUser
            ? "bg-blue-600 text-white rounded-tr-none"
            : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {formattedTime && (
          <div
            className={cn(
              "text-[10px] mt-2 opacity-70",
              isUser ? "text-right" : "text-left"
            )}
          >
            {formattedTime}
          </div>
        )}
      </div>
    </motion.div>
  );
}
