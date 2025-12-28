
declare const pdfjsLib: any;

// Configure PDF.js worker
if (typeof window !== 'undefined' && 'pdfjsLib' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export interface ExtractedData {
  fullText: string;
  pageTexts: string[];
  numPages: number;
}

export const extractTextFromPDF = async (file: File): Promise<ExtractedData> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    pageTexts.push(pageText);
  }

  return {
    fullText,
    pageTexts,
    numPages: pdf.numPages
  };
};
