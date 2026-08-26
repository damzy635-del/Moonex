import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Paperclip,
  Mic,
  MicOff,
  Globe,
  BrainCircuit,
  X,
  FileText,
  Lock,
  LogIn,
  BookOpen,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { FileAttachment, UserPreferences } from '../types';

interface ChatInputProps {
  onSendMessage: (content: string, files: FileAttachment[]) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  enableThinking: boolean;
  onToggleThinking: () => void;
  enableWebSearch: boolean;
  onToggleWebSearch: () => void;
  selectedModelName: string;
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
  onOpenPromptLibrary?: () => void;
  currentTone?: UserPreferences['tone'];
  onChangeTone?: (tone: UserPreferences['tone']) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isStreaming,
  onStopStreaming,
  enableThinking,
  onToggleThinking,
  enableWebSearch,
  onToggleWebSearch,
  selectedModelName: _selectedModelName,
  isAuthenticated = true,
  onRequireAuth,
  onOpenPromptLibrary,
  currentTone = 'balanced',
  onChangeTone,
}) => {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showToneMenu, setShowToneMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        220
      )}px`;
    }
  }, [content]);

  // Handle Speech Recognition for voice dictation
  const toggleSpeechRecognition = () => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setContent((prev) => (prev ? `${prev} ${transcript}` : transcript));
          } else {
            currentTranscript += transcript;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setIsListening(false);
    }
  };

  // Handle file uploads (reading base64 or text)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    await processUploadedFiles(Array.from(selectedFiles));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processUploadedFiles = async (fileList: File[]) => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }

    const newAttachments: FileAttachment[] = [];

    for (const file of fileList) {
      const isImage = file.type.startsWith('image/');
      const isCode = /\.(ts|tsx|js|jsx|py|json|md|html|css|sql|sh|txt|csv)$/i.test(
        file.name
      );

      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

      newAttachments.push({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: file.name,
        size: file.size,
        mimeType: file.type || (isCode ? 'text/plain' : 'application/octet-stream'),
        data: fileData,
        type: isImage ? 'image' : isCode ? 'code' : 'document',
      });
    }

    setFiles((prev) => [...prev, ...newAttachments]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = () => {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }

    if ((!content.trim() && files.length === 0) || isStreaming) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    onSendMessage(content.trim(), files);
    setContent('');
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isAuthenticated) {
        onRequireAuth?.();
        return;
      }
      handleSubmit();
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const tones: Array<{ id: UserPreferences['tone']; label: string }> = [
    { id: 'concise', label: 'Concise' },
    { id: 'balanced', label: 'Balanced' },
    { id: 'explanatory', label: 'Explanatory' },
    { id: 'technical', label: 'Technical' },
    { id: 'creative', label: 'Creative' },
  ];

  return (
    <div
      className="relative w-full max-w-3xl mx-auto px-3 sm:px-4 pb-3 sm:pb-5"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && isAuthenticated && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-indigo-500 bg-indigo-950/90 text-indigo-300 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-2 text-sm font-semibold">
            <Paperclip className="h-6 w-6 animate-bounce" />
            <span>Drop files or images here to analyze</span>
          </div>
        </div>
      )}

      {/* Main Input Card */}
      <div
        id="chat-input-box"
        className={`relative flex flex-col rounded-2xl border bg-[#171717] shadow-xl transition-all ${
          !isAuthenticated
            ? 'border-indigo-900/60 bg-gradient-to-b from-[#1a1a24] to-[#141419]'
            : 'border-gray-800 focus-within:border-gray-700'
        }`}
      >
        {/* Attached Files Preview Bar */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {files.map((file) => (
              <div
                key={file.id}
                className="relative group flex items-center gap-2 rounded-xl border border-gray-800 bg-[#1f1f1f] px-2.5 py-1.5 text-xs text-gray-200"
              >
                {file.type === 'image' ? (
                  <img
                    src={file.data}
                    alt={file.name}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-indigo-400" />
                )}
                <div className="truncate max-w-[120px]">
                  <span className="truncate font-medium text-gray-200">
                    {file.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="rounded-full bg-gray-800 p-0.5 text-gray-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Guest Lock Banner or Standard Text Area */}
        {!isAuthenticated ? (
          <div
            onClick={onRequireAuth}
            className="cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <Lock className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-xs sm:text-sm font-semibold text-gray-100">
                  Sign in required to make requests
                </div>
                <div className="text-[11px] text-gray-400">
                  Sign in with Google, Apple, or Email to chat and run reasoning models.
                </div>
              </div>
            </div>

            <button
              type="button"
              id="btn-guest-login-cta"
              onClick={(e) => {
                e.stopPropagation();
                onRequireAuth?.();
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In to Chat</span>
            </button>
          </div>
        ) : (
          <div className="relative">
            <textarea
              ref={textareaRef}
              id="chat-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything, write code, analyze documents, or brainstorm..."
              rows={1}
              className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-hidden max-h-[220px]"
            />
            {/* Dictation Live Wave Indicator */}
            {isListening && (
              <div className="flex items-center gap-2 px-4 pb-2 text-xs text-rose-400 font-medium">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-1 bg-rose-400 rounded-full animate-pulse" />
                  <span className="h-3.5 w-1 bg-rose-400 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                  <span className="h-2 w-1 bg-rose-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                </span>
                <span>Listening... speak now</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom Bar: Action Pills and Send Button */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-gray-800/40">
          {/* Left: Quick Mode Buttons & Attachments */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Attach File Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
              accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.js,.py,.html,.css,.sql"
            />
            <button
              type="button"
              id="btn-attach-file"
              onClick={() => {
                if (!isAuthenticated) {
                  onRequireAuth?.();
                  return;
                }
                fileInputRef.current?.click();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
              title="Attach images, PDFs, CSVs, or code files"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Prompt Templates Library Button */}
            {onOpenPromptLibrary && (
              <button
                type="button"
                id="btn-prompt-library"
                onClick={() => {
                  if (!isAuthenticated) {
                    onRequireAuth?.();
                    return;
                  }
                  onOpenPromptLibrary();
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-400 hover:bg-indigo-950/40 hover:text-indigo-300 transition-all border border-indigo-900/30"
                title="Browse Prompt Templates & Snippets"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Templates</span>
              </button>
            )}

            {/* Thinking Pill */}
            <button
              type="button"
              id="btn-toggle-thinking"
              onClick={() => {
                if (!isAuthenticated) {
                  onRequireAuth?.();
                  return;
                }
                onToggleThinking();
              }}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                enableThinking
                  ? 'bg-purple-950/70 text-purple-300 border border-purple-800'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
              title="Deep Thinking chain-of-thought reasoning"
            >
              <BrainCircuit className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Thinking</span>
            </button>

            {/* Web Search Pill */}
            <button
              type="button"
              id="btn-toggle-search"
              onClick={() => {
                if (!isAuthenticated) {
                  onRequireAuth?.();
                  return;
                }
                onToggleWebSearch();
              }}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                enableWebSearch
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
              title="Google Web Search grounding"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
            </button>

            {/* Tone Selector Pill */}
            {onChangeTone && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowToneMenu(!showToneMenu)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
                  title="Adjust response tone"
                >
                  <Sliders className="h-3 w-3 text-indigo-400" />
                  <span className="capitalize text-[11px] hidden md:inline">{currentTone}</span>
                </button>

                {showToneMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowToneMenu(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-1 w-36 rounded-xl border border-gray-800 bg-[#171717] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        Response Tone
                      </div>
                      {tones.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            onChangeTone(t.id);
                            setShowToneMenu(false);
                          }}
                          className={`w-full flex items-center justify-between rounded-lg px-2 py-1 text-xs text-left transition-colors ${
                            currentTone === t.id
                              ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Voice Dictation Button */}
            <button
              type="button"
              id="btn-voice-dictation"
              onClick={toggleSpeechRecognition}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                isListening
                  ? 'bg-rose-950 text-rose-400 animate-pulse border border-rose-800'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
              title={isListening ? 'Stop recording voice' : 'Dictate with voice'}
            >
              {isListening ? (
                <MicOff className="h-4 w-4 text-rose-400" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Right: Character Count + Send / Stop Button */}
          <div className="flex items-center gap-2">
            {content.length > 0 && (
              <span className="hidden sm:inline-block text-[10px] text-gray-500 font-mono">
                {content.length} chars
              </span>
            )}

            {isStreaming ? (
              <button
                type="button"
                id="btn-stop-streaming"
                onClick={onStopStreaming}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-900 hover:bg-white shadow-xs transition-colors"
                title="Stop generation"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                id="btn-send-message"
                onClick={handleSubmit}
                disabled={isAuthenticated && (!content.trim() && files.length === 0)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-900 hover:bg-white disabled:opacity-20 disabled:pointer-events-none shadow-xs transition-all"
                title={isAuthenticated ? 'Send message (Enter)' : 'Sign in to send'}
              >
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-1.5 text-center text-[11px] text-gray-500">
        My AI Model can make mistakes. Verify important facts, code, and medical info.
      </div>
    </div>
  );
};
