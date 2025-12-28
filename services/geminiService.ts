
import { GoogleGenAI } from "@google/genai";

const getAIClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const processDocumentAction = async (
  docText: string,
  actionPrompt: string,
  context: string = ""
): Promise<string> => {
  const ai = getAIClient();
  const model = "gemini-3-pro-preview";

  const prompt = `
    You are a professional document editor and analyst.
    Below is the content of a PDF document:
    --- DOCUMENT START ---
    ${docText.substring(0, 15000)} // Truncate if too long for safety
    --- DOCUMENT END ---

    Instruction: ${actionPrompt}
    ${context ? `Additional Context/User Input: ${context}` : ""}

    Please provide a high-quality response. If the request is to "rewrite", "summarize", or "transform", provide the new content clearly.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text || "I couldn't process the request. Please try again.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return `Error: ${error.message || "Failed to communicate with AI"}`;
  }
};

export const chatWithDocument = async (
  docText: string,
  history: { role: 'user' | 'assistant', content: string }[],
  userMessage: string
): Promise<string> => {
  const ai = getAIClient();
  const model = "gemini-3-pro-preview";

  const systemInstruction = `
    You are OmniPDF Assistant. You have full access to the document text provided below.
    Answer questions based ONLY on the document content where possible.
    If the information is not in the document, state that clearly but try to be helpful.
    Document content:
    ${docText.substring(0, 20000)}
  `;

  try {
    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction,
      }
    });

    // Note: In standard SDK, we send the prompt. 
    // We simulate history by appending context if needed, 
    // but the library's chat.sendMessage is preferred.
    const response = await chat.sendMessage({ message: userMessage });
    return response.text || "No response received.";
  } catch (error: any) {
    console.error("Chat Error:", error);
    return "Something went wrong during the conversation.";
  }
};
