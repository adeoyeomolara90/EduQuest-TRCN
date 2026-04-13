/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  async generateQuestions(topic: string, count: number = 5, difficulty: string = 'medium'): Promise<Question[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: `Generate exactly ${count} multiple-choice questions for a professional teaching exam (like TRCN) on the topic: ${topic}. 
        The difficulty level should be ${difficulty}.
        IMPORTANT: If the topic is "Current Affairs", ensure the questions are up to date as of 2026 (current year).
        Ensure the questions are challenging and relevant to professional teaching standards.
        Include a relevant category for each question.
        
        OUTPUT FORMAT: You MUST return a valid JSON array of objects. Do not include any text before or after the JSON.
        Ensure every string is properly closed and the JSON is complete.` }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctAnswer: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                topic: { type: Type.STRING },
                category: { type: Type.STRING },
                difficulty: { type: Type.STRING }
              },
              required: ["id", "text", "options", "correctAnswer", "topic", "category", "difficulty"]
            }
          }
        }
      });

      let text = response.text;
      if (!text) return [];
      
      // Clean up potential markdown blocks
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error("JSON Parse Error. Raw text:", text);
        // Try to fix common truncation issues if it's an array
        if (text.startsWith('[') && !text.endsWith(']')) {
          try {
            return JSON.parse(text + ']');
          } catch (e) {
            throw parseError;
          }
        }
        throw parseError;
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      return [];
    }
  },

  async extractQuestionsFromFile(fileContent: string | { inlineData: { data: string, mimeType: string } }): Promise<Question[]> {
    try {
      const prompt = `Extract multiple-choice questions from the provided content. 
      For each question, identify:
      1. The question text
      2. Four options
      3. The index of the correct answer (0-3)
      4. A brief explanation
      5. The topic
      6. A category
      
      Format the output as a JSON array of objects.`;

      const parts = typeof fileContent === 'string' 
        ? [{ text: prompt }, { text: fileContent }]
        : [{ text: prompt }, fileContent];

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctAnswer: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                topic: { type: Type.STRING },
                category: { type: Type.STRING },
                difficulty: { type: Type.STRING }
              },
              required: ["id", "text", "options", "correctAnswer", "topic", "category", "difficulty"]
            }
          }
        }
      });

      let text = response.text;
      if (!text) return [];
      
      // Clean up potential markdown blocks
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error("JSON Parse Error. Raw text:", text);
        // Try to fix common truncation issues if it's an array
        if (text.startsWith('[') && !text.endsWith(']')) {
          try {
            return JSON.parse(text + ']');
          } catch (e) {
            throw parseError;
          }
        }
        throw parseError;
      }
    } catch (error) {
      console.error("Error extracting questions:", error);
      return [];
    }
  },

  async explainConcept(question: Question, userAnswerIndex: number): Promise<string> {
    const userAnswer = question.options[userAnswerIndex] || "No answer";
    const correctAnswer = question.options[question.correctAnswer];
    
    // Check cache first to ensure consistency and reduce AI usage
    const cacheKey = `explanation_${question.id}_${userAnswerIndex}`;
    try {
      const cacheDoc = await getDoc(doc(db, "ai_cache", cacheKey));
      if (cacheDoc.exists()) {
        return cacheDoc.data().text;
      }
    } catch (e) {
      console.warn("Cache check failed", e);
    }

    try {
      const prompt = `
        Explain why the correct answer to the following question is "${correctAnswer}" and why "${userAnswer}" might be incorrect.
        
        Question: "${question.text}"
        
        CRITICAL INSTRUCTIONS:
        1. If the question involves mathematics, calculations, or logic, you MUST provide a detailed, step-by-step working of the answer.
        2. Use simple, clear language that even a beginner or someone with no prior knowledge can follow. 
        3. Break down every step of the process clearly.
        4. For non-mathematical questions, still provide a clear, step-by-step educational explanation.
        5. Be educational, encouraging, and clear.
        6. Use Markdown for formatting (bolding, lists, etc.) to make it highly readable.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      
      const explanation = response.text || "No explanation available.";
      
      // Save to cache immediately for future use
      try {
        await setDoc(doc(db, "ai_cache", cacheKey), {
          text: explanation,
          questionId: question.id,
          userAnswerIndex,
          timestamp: new Date().toISOString(),
          type: 'explanation'
        });
      } catch (e) {
        console.warn("Cache save failed", e);
      }

      return explanation;
    } catch (error) {
      console.error("Error explaining concept:", error);
      return "Failed to get explanation.";
    }
  },

  async chatWithTutor(history: { role: 'user' | 'model', parts: { text: string }[] }[], message: string): Promise<string> {
    try {
      const chat = ai.chats.create({
        model: "gemini-2.0-flash",
        history: history,
      });
      const result = await chat.sendMessage({ message });
      const responseText = result.text;

      // Save chat response to database for future reference and consistency
      try {
        const chatLogId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        await setDoc(doc(db, "ai_chat_logs", chatLogId), {
          message,
          response: responseText,
          timestamp: new Date().toISOString(),
          type: 'tutor_chat'
        });
      } catch (e) {
        console.warn("Chat log failed", e);
      }

      return responseText;
    } catch (error) {
      console.error("Error in tutor chat:", error);
      return "I'm sorry, I'm having trouble connecting right now.";
    }
  }
};
