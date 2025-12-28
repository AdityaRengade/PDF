
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FileUp, 
  MessageSquare, 
  Edit3, 
  Layout, 
  FileText, 
  Download, 
  Sparkles, 
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize,
  Search
} from 'lucide-react';
import { PDFState, ChatMessage, EditAction } from './types';
import { extractTextFromPDF } from './services/pdfService';
import { processDocumentAction, chatWithDocument } from './services/geminiService';

declare const pdfjsLib: any;

const EDIT_ACTIONS: EditAction[] = [
  { 
    id: 'summarize', 
    label: 'Summarize', 
    description: 'Create a concise summary of the document.',
    prompt: 'Summarize the core points of this document in bullet points.',
    icon: 'Layout'
  },
  { 
    id: 'rewrite-formal', 
    label: 'Formal Rewrite', 
    description: 'Rewrite the text in a highly professional tone.',
    prompt: 'Rewrite the entire content to be more formal and academic.',
    icon: 'Edit3'
  },
  { 
    id: 'extract-data', 
    label: 'Extract Key Data', 
    description: 'Find entities, dates, and amounts.',
    prompt: 'Extract all key entities, dates, financial amounts, and specific action items from this document as a clean list.',
    icon: 'FileText'
  },
  { 
    id: 'translate-es', 
    label: 'Translate (ES)', 
    description: 'Translate the main content to Spanish.',
    prompt: 'Translate the main content of this document into professional Spanish.',
    icon: 'ChevronRight'
  },
];

const App: React.FC = () => {
  const [pdfState, setPdfState] = useState<PDFState>({
    file: null,
    url: null,
    text: '',
    pageTexts: [],
    numPages: 0,
    isProcessing: false,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<'view' | 'edit' | 'chat'>('view');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Viewer State
  const [zoom, setZoom] = useState(1.0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isAiLoading]);

  // PDF Rendering Logic
  const renderPage = useCallback(async (pageNum: number, scale: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    
    setIsRendering(true);
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    } catch (err) {
      console.error("Render error:", err);
    } finally {
      setIsRendering(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'view' && pdfDocRef.current) {
      renderPage(currentPage, zoom);
    }
  }, [activeTab, currentPage, zoom, renderPage]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setPdfState(prev => ({ ...prev, error: 'Please upload a valid PDF file.' }));
      return;
    }

    setPdfState({
      file,
      url: URL.createObjectURL(file),
      text: '',
      pageTexts: [],
      numPages: 0,
      isProcessing: true,
      error: null,
    });

    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfDocRef.current = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const { fullText, pageTexts, numPages } = await extractTextFromPDF(file);
      setPdfState(prev => ({ 
        ...prev, 
        text: fullText, 
        pageTexts, 
        numPages, 
        isProcessing: false 
      }));
      setCurrentPage(1);
    } catch (err) {
      setPdfState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Failed to extract text from PDF.'
      }));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const lowerQuery = searchQuery.toLowerCase();
    const foundPageIndex = pdfState.pageTexts.findIndex(t => t.toLowerCase().includes(lowerQuery));
    
    if (foundPageIndex !== -1) {
      setCurrentPage(foundPageIndex + 1);
    }
  };

  const handleAction = async (action: EditAction) => {
    if (!pdfState.text) return;
    setIsAiLoading(true);
    setActiveTab('edit');
    try {
      const result = await processDocumentAction(pdfState.text, action.prompt);
      setEditedContent(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || !pdfState.text || isAiLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: userInput };
    setChatHistory(prev => [...prev, userMsg]);
    setUserInput('');
    setIsAiLoading(true);

    try {
      const aiResponse = await chatWithDocument(pdfState.text, chatHistory, userInput);
      setChatHistory(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, I failed to process that.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([editedContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited-document.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!pdfState.file) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
              <Sparkles className="text-white w-10 h-10" />
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">
              Omni<span className="text-blue-600">PDF</span>
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              The AI-Powered PDF Workspace. Analyze, rewrite, and transform your documents instantly.
            </p>
          </div>

          <div className="p-8 border-2 border-dashed border-slate-300 rounded-3xl bg-white shadow-sm hover:border-blue-400 hover:bg-blue-50 transition-all group relative">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-slate-100 rounded-2xl group-hover:bg-blue-100 transition-colors">
                <FileUp className="w-8 h-8 text-slate-500 group-hover:text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-700">Drop your PDF here</p>
                <p className="text-sm text-slate-400">or click to browse from your device</p>
              </div>
            </div>
          </div>

          {pdfState.error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {pdfState.error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="p-4 bg-white rounded-2xl border border-slate-100 flex items-start space-x-3">
              <div className="bg-orange-100 p-2 rounded-lg"><Edit3 className="w-5 h-5 text-orange-600" /></div>
              <div>
                <h4 className="font-bold text-slate-800">Smart Edits</h4>
                <p className="text-xs text-slate-500">Rewrite tone or language instantly.</p>
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-100 flex items-start space-x-3">
              <div className="bg-green-100 p-2 rounded-lg"><MessageSquare className="w-5 h-5 text-green-600" /></div>
              <div>
                <h4 className="font-bold text-slate-800">AI Chat</h4>
                <p className="text-xs text-slate-500">Ask questions about your data.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Navbar */}
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 z-20 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">OmniPDF</h1>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <div className="flex items-center space-x-2 text-sm font-medium text-slate-600">
            <FileText className="w-4 h-4" />
            <span className="truncate max-w-[200px]">{pdfState.file.name}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => {
              pdfDocRef.current = null;
              setPdfState({ file: null, url: null, text: '', pageTexts: [], numPages: 0, isProcessing: false, error: null });
            }}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <button 
            onClick={handleExport}
            disabled={!editedContent}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-blue-100 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export MD</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Tools */}
        <div className="w-72 border-r bg-white flex flex-col overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Navigation</h3>
            <div className="space-y-1">
              {[
                { id: 'view', label: 'PDF Preview', icon: FileText },
                { id: 'edit', label: 'AI Editor', icon: Edit3 },
                { id: 'chat', label: 'Document Chat', icon: MessageSquare },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === tab.id 
                      ? 'bg-blue-50 text-blue-600 shadow-sm' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2">
              {EDIT_ACTIONS.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className="group flex items-start space-x-3 p-3 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                >
                  <div className="mt-0.5 p-2 bg-slate-50 group-hover:bg-white rounded-lg transition-colors">
                    {action.id === 'summarize' && <Layout className="w-4 h-4 text-blue-500" />}
                    {action.id === 'rewrite-formal' && <Edit3 className="w-4 h-4 text-purple-500" />}
                    {action.id === 'extract-data' && <FileText className="w-4 h-4 text-orange-500" />}
                    {action.id === 'translate-es' && <ChevronRight className="w-4 h-4 text-green-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">{action.label}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{action.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto p-4 bg-blue-600 rounded-2xl text-white space-y-2 relative overflow-hidden">
            <Sparkles className="absolute -top-4 -right-4 w-16 h-16 opacity-20 rotate-12" />
            <h4 className="text-sm font-bold relative z-10">Gemini Powered</h4>
            <p className="text-[11px] text-blue-100 relative z-10">Advanced reasoning and document understanding activated.</p>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative bg-slate-100 flex flex-col overflow-hidden">
          {pdfState.isProcessing && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">Processing Document</p>
                <p className="text-sm text-slate-500">Extracting text and indexing pages...</p>
              </div>
            </div>
          )}

          {activeTab === 'view' && (
            <div className="flex flex-col h-full">
              {/* PDF Toolbar */}
              <div className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center bg-slate-100 rounded-lg p-1">
                    <button 
                      onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
                      className="p-1.5 hover:bg-white rounded-md transition-all text-slate-600"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold w-12 text-center text-slate-700">{Math.round(zoom * 100)}%</span>
                    <button 
                      onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                      className="p-1.5 hover:bg-white rounded-md transition-all text-slate-600"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-slate-300 mx-1" />
                    <button 
                      onClick={() => setZoom(1.0)}
                      className="p-1.5 hover:bg-white rounded-md transition-all text-slate-600"
                      title="Reset Zoom"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center bg-slate-100 rounded-lg p-1">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 hover:bg-white disabled:opacity-30 rounded-md transition-all text-slate-600"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center px-2 space-x-1">
                      <input 
                        type="number" 
                        value={currentPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val >= 1 && val <= pdfState.numPages) setCurrentPage(val);
                        }}
                        className="w-10 bg-transparent text-center text-xs font-bold text-slate-700 outline-none"
                      />
                      <span className="text-xs text-slate-400 font-medium">/ {pdfState.numPages}</span>
                    </div>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(pdfState.numPages, prev + 1))}
                      disabled={currentPage === pdfState.numPages}
                      className="p-1.5 hover:bg-white disabled:opacity-30 rounded-md transition-all text-slate-600"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSearch} className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search in PDF..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-slate-100 rounded-lg text-xs font-medium w-48 focus:w-64 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </form>
              </div>

              {/* PDF Container */}
              <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-slate-100 scroll-smooth">
                <div className="relative shadow-2xl rounded-sm bg-white border border-slate-200">
                  {isRendering && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    </div>
                  )}
                  <canvas ref={canvasRef} className="max-w-full" />
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'edit' || activeTab === 'chat') && (
            <div className="h-full flex flex-col p-6">
              <div className="flex-1 max-w-5xl w-full mx-auto shadow-2xl rounded-2xl overflow-hidden bg-white border border-slate-200 relative">
                {activeTab === 'edit' && (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Edit3 className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold text-slate-700">AI Drafting Area</span>
                      </div>
                      {isAiLoading && (
                        <div className="flex items-center space-x-2 text-blue-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs font-medium">AI is thinking...</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-8 overflow-y-auto prose prose-slate max-w-none">
                      {!editedContent && !isAiLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-400">
                          <div className="bg-slate-50 p-6 rounded-full">
                            <Plus className="w-12 h-12" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-600">Ready to transform your document?</p>
                            <p className="text-sm">Select a tool from the sidebar to begin editing.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap font-serif text-slate-800 leading-relaxed text-lg">
                          {editedContent}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'chat' && (
                  <div className="h-full flex flex-col">
                    <div className="p-4 border-b bg-slate-50 flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-slate-700">Document Intelligence</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {chatHistory.length === 0 && (
                        <div className="text-center py-12 space-y-3">
                          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                            <MessageSquare className="w-8 h-8 text-blue-600" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-700">Ask anything about this PDF</h3>
                          <p className="text-sm text-slate-500 max-w-xs mx-auto">"What are the main action items?" or "Who is the primary stakeholder mentioned?"</p>
                        </div>
                      )}
                      {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm ${
                            msg.role === 'user' 
                              ? 'bg-blue-600 text-white shadow-blue-100' 
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {isAiLoading && (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 px-4 py-3 rounded-2xl">
                            <div className="flex space-x-1">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
                      <div className="relative flex items-center">
                        <input
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          placeholder="Ask a question about the document..."
                          className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-all"
                        />
                        <button 
                          type="submit"
                          disabled={!userInput.trim() || isAiLoading}
                          className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-100"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
