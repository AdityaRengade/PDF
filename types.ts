
export interface PDFState {
  file: File | null;
  url: string | null;
  text: string;
  pageTexts: string[];
  numPages: number;
  isProcessing: boolean;
  error: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EditAction {
  id: string;
  label: string;
  description: string;
  prompt: string;
  icon: string;
}
