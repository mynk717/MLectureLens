'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export default function Chat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });
  
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
    }
  };

  const isProcessing = status === 'streaming' || status === 'submitted';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl h-[95vh] bg-white/80 backdrop-blur-sm shadow-2xl rounded-2xl border border-white/20 overflow-hidden flex flex-col">
        
        {/* Header with Your Logo */}
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
                className="w-60 h-30 rounded-{xl} object-contain"
              />
              <p className="text-blue-100 text-base">Ask questions about your Node.js and Python courses</p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-gradient-to-b from-gray-50/50 to-white/50 relative">
          {/* Subtle background watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img 
              src="/MLectureLens Logo.png" 
              alt="MLectureLens" 
              className="w-64 h-64 object-contain opacity-3"
            />
          </div>

          {messages.length === 0 ? (
            <div className="text-center py-16 relative z-10">
              {/* Featured logo in empty state */}
              <div className="w-24 h-24 mx-auto mb-6 p-3 bg-white rounded-2xl shadow-lg">
                <img 
                  src="/MLectureLens Logo.png" 
                  alt="MLectureLens Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-3">Welcome to MLectureLens</h3>
              <p className="text-gray-500 text-lg">Ask me anything about your programming courses!</p>
            </div>
          ) : (
            <div className="relative z-10">
              {messages.map((m: UIMessage) => (
                <div
                  key={m.id}
                  className={`flex items-end gap-4 mb-6 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* AI Avatar with your logo */}
                  {m.role === 'assistant' && (
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 p-1.5 shadow-md">
                      <img 
                        src="/MLectureLens Logo.png" 
                        alt="MLectureLens" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div
                    className={`max-w-2xl px-8 py-4 rounded-3xl shadow-lg transition-all duration-200 ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-lg'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-lg shadow-md'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed text-base">
                      {m.parts?.map((part, index) => 
                        part.type === 'text' ? (
                          <span key={index}>{part.text}</span>
                        ) : null
                      )}
                    </div>
                  </div>

                  {/* User Avatar */}
                  {m.role === 'user' && (
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Typing indicator with logo */}
          {isProcessing && (
            <div className="flex items-center gap-4 relative z-10">
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
        </div>

        {/* Input Form */}
        <div className="p-8 bg-white/50 backdrop-blur-sm border-t border-gray-200/50 flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-6">
            <div className="flex-1 relative">
              <input
                className="w-full px-8 py-5 text-lg bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent shadow-lg placeholder-gray-500 transition-all duration-200"
                value={input}
                placeholder="Ask about Node.js or Python courses..."
                onChange={(e) => setInput(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <button
              type="submit"
              className="px-10 py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-2xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all duration-200 transform hover:scale-105"
              disabled={!input.trim() || isProcessing}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
