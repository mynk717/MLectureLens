'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useRef } from 'react';
import removeMarkdown from 'remove-markdown';

// Define types for upload results
interface UploadResult {
  success: boolean;
  filesProcessed: number;
  documentsGenerated: number;
  sessionId: string;
  courseStructure: Record<string, Record<string, string[]>>;
  documentsPath: string;
}

// Define search result type
interface SearchResult {
  id: string;
  content: string;
  metadata: {
    course: string;
    chapter: string;
    filename: string;
  };
  score: number;
}

// Extend HTML input attributes to include webkitdirectory
interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string;
}

export default function Chat() {
  // Upload-related state variables
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedCourses, setUploadedCourses] = useState<Record<string, Record<string, string[]>> | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Embeddings-related state
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [embeddingsStatus, setEmbeddingsStatus] = useState('');

  const [input, setInput] = useState('');

  // Chat auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: uploadResult?.sessionId ? {
        'X-Session-ID': uploadResult.sessionId,
      } : {},
    }),
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🔥 NEW: Function to clean markdown from AI responses
  const cleanMarkdown = (text: string) => {
    return removeMarkdown(text, {
      stripListLeaders: true,
      gfm: true,
      useImgAltText: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(
        { text: input },
        {
          body: uploadResult?.sessionId ? { sessionId: uploadResult.sessionId } : {},
        }
      );
      setInput('');
    }
  };

  // File upload function
  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus('📤 Uploading and processing files...');
    setUploadedCourses(null);
    setEmbeddingsStatus('');

    const formData = new FormData();
    
    Array.from(files).forEach((file: File) => {
      formData.append('files', file);
      formData.append('paths', (file as any).webkitRelativePath || file.name);
    });

    try {
      const response = await fetch('/api/upload-folder', {
        method: 'POST',
        body: formData,
      });

      const result: UploadResult = await response.json();
      
      if (response.ok) {
        setUploadStatus(`✅ Successfully processed ${result.filesProcessed} files, generated ${result.documentsGenerated} documents`);
        setUploadedCourses(result.courseStructure);
        setUploadResult(result);
      } else {
        setUploadStatus(`❌ Error: ${(result as any).error}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setUploadStatus(`❌ Upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Generate embeddings function
  const generateEmbeddings = async (sessionId: string) => {
    setIsGeneratingEmbeddings(true);
    setEmbeddingsStatus('🧠 Initializing embedding generation...');
    
    try {
      const response = await fetch('/api/generate-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setEmbeddingsStatus(`✅ Progress: ${result.totalEmbeddings || result.embeddingsGenerated}/${result.totalDocuments || 'all'} documents embedded (${result.newEmbeddings || 0} new)`);
      } else {
        setEmbeddingsStatus(`❌ Embedding error: ${result.error}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setEmbeddingsStatus(`❌ Embedding failed: ${errorMessage}`);
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  // Check if AI is currently processing
  const isProcessing = status === 'streaming' || status === 'submitted';

  return (
    <>
      {/* Top left corner logo */}
      <div className="fixed top-6 left-8 z-50">
        <img
          src="/MLectureLens Logo.png"
          alt="MLectureLens Logo"
          className="w-16 h-16 object-contain drop-shadow-lg rounded-xl bg-white/70 p-1"
        />
      </div>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-2 sm:p-4">
        {/* Main Chat Container */}
        <div className="w-full max-w-6xl h-[95vh] bg-white/80 backdrop-blur-sm shadow-2xl rounded-2xl border border-white/20 overflow-hidden flex flex-col">
          
          {/* 🔥 UPDATED: Header with Fan Branding */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center p-2">
                <img 
                  src="/MLectureLens Logo.png" 
                  alt="MLectureLens Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <img
          src="/MLectureLens Logo.png"
          alt="MLectureLens Logo"
          className="w-76 h-16 object-contain drop-shadow-lg rounded-xl "
        />
                <p className="text-blue-100 text-base">🌟 A fan of Hitesh Sir - Learn Node.js and Python with course insights</p>
              </div>
            </div>
          </div>

          {/* Scrollable Upload Section with max height */}
          <div className="max-h-60 overflow-y-auto p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-b border-gray-200/50 flex-shrink-0">
            <div className="space-y-4">
              {/* Upload Input */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📁 Upload Course Materials (SRT/VTT Files)
                  </label>
                  <input
                    type="file"
                    {...({ webkitdirectory: "true" } as FileInputProps)}
                    multiple
                    onChange={handleFolderUpload}
                    disabled={isUploading}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 disabled:opacity-50 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span>💡</span>
                    Select a folder with structure: Course/Subject/Chapter/files.srt or .vtt
                  </p>
                </div>
              </div>

              {/* Upload Status */}
              {(uploadStatus || isUploading) && (
                <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                  {isUploading && (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span className="text-sm text-gray-600">Processing files...</span>
                    </div>
                  )}
                  {uploadStatus && (
                    <div className="text-sm font-medium text-gray-700">{uploadStatus}</div>
                  )}
                </div>
              )}
              
              {/* Course Structure Display */}
              {uploadedCourses && (
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    📚 Uploaded Courses
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(uploadedCourses).map(([course, chapters]) => (
                      <div key={course} className="p-2 bg-gray-50 rounded">
                        <div className="font-medium text-blue-600">{course}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {Object.entries(chapters).map(([chapter, files]) => (
                            <div key={chapter} className="ml-2">
                              📖 {chapter} ({files.length} files)
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {uploadResult && (
                    <div className="mt-3 text-xs text-gray-500">
                      Session ID: {uploadResult.sessionId}
                    </div>
                  )}
                </div>
              )}

              {/* Generate Embeddings Section */}
              {uploadResult && (
                <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      🧠 Vector Embeddings
                    </h4>
                    <button
                      onClick={() => generateEmbeddings(uploadResult.sessionId)}
                      disabled={isGeneratingEmbeddings}
                      className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 transform hover:scale-105"
                    >
                      {isGeneratingEmbeddings ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                          <span>Generating...</span>
                        </div>
                      ) : (
                        '🔥 Generate Vector Embeddings'
                      )}
                    </button>
                  </div>
                  
                  {embeddingsStatus && (
                    <div className="text-sm font-medium text-gray-700 mt-2 p-2 bg-gray-50 rounded">
                      {embeddingsStatus}
                      {embeddingsStatus.includes('✅') && (
                        <div className="mt-2 text-blue-600 font-medium">
                          🎉 Ready! Ask me anything about your courses below.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Messages Area with proper scrolling */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-gradient-to-b from-gray-50/50 to-white/50 relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img 
                src="/MLectureLens Logo.png" 
                alt="MLectureLens" 
                className="w-64 h-64 object-contain opacity-3"
              />
            </div>

            {messages.length === 0 ? (
              <div className="text-center py-16 relative z-10">
                <div className="w-24 h-24 mx-auto mb-6 p-3 bg-white rounded-2xl shadow-lg">
                  <img 
                    src="/MLectureLens Logo.png" 
                    alt="MLectureLens Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-3">Welcome to MLectureLens</h3>
                <p className="text-gray-500 text-lg">🌟 A fan of Hitesh Sir's teaching style!</p>
                <p className="text-gray-400 text-sm mt-2">Upload your courses and ask me anything about programming!</p>
              </div>
            ) : (
              <div className="relative z-10">
                {messages.map((m: UIMessage) => (
                  <div
                    key={m.id}
                    className={`flex items-end gap-4 mb-6 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 p-1.5 shadow-md">
                        <img 
                          src="/MLectureLens Logo.png" 
                          alt="MLectureLens" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    
                    <div
                      className={`max-w-2xl px-8 py-4 rounded-3xl shadow-lg transition-all duration-200 ${
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-lg'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-lg shadow-md'
                      }`}
                    >
                      <div className="leading-relaxed text-base">
                        {m.parts?.map((part, index) => 
                          part.type === 'text' ? (
                            // 🔥 CLEAN AI RESPONSE: Remove markdown formatting
                            <span key={index} style={{ whiteSpace: 'pre-wrap' }}>
                              {cleanMarkdown(part.text)}
                            </span>
                          ) : null
                        )}
                      </div>
                    </div>

                    {m.role === 'user' && (
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
                
                {isProcessing && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1.5 shadow-md">
                      <img 
                        src="/MLectureLens Logo.png" 
                        alt="MLectureLens" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-3xl rounded-bl-lg px-8 py-4 shadow-md">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                        <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Auto-scroll target */}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Fixed Input Form at bottom */}
          <div className="p-6 bg-white/90 backdrop-blur-sm border-t border-gray-200/50 flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex items-center gap-4">
              <div className="flex-1 relative">
                <input
                  className="w-full px-6 py-4 text-base bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm placeholder-gray-500 transition-all duration-200"
                  value={input}
                  placeholder="Ask me about Node.js or Python courses..."
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <button
                type="submit"
                className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-200 transform hover:scale-105"
                disabled={!input.trim() || isProcessing}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
