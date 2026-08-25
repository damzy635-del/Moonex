import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  User,
  Copy,
  Check,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  BrainCircuit,
  Globe,
  Layers,
  Play,
  FileText,
  FileCode,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Message, FileAttachment, Artifact } from '../types';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onOpenArtifact?: (artifact: Artifact) => void;
  onSpeak?: (text: string) => void;
  isPlayingAudio?: boolean;
  onStopAudio?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isStreaming = false,
  onRegenerate,
  onOpenArtifact,
  onSpeak,
  isPlayingAudio = false,
  onStopAudio,
}) => {
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleVoice = () => {
    if (isPlayingAudio) {
      if (onStopAudio) onStopAudio();
    } else {
      if (onSpeak) onSpeak(message.content);
    }
  };

  return (
    <div
      id={`message-${message.id}`}
      className={`group w-full py-4 sm:py-6 px-3 sm:px-6 transition-colors ${
        isUser
          ? 'bg-transparent'
          : 'bg-[#141414]/70 border-y border-gray-800/60'
      }`}
    >
      <div className="mx-auto flex max-w-3xl gap-3 sm:gap-4">
        {/* Avatar */}
        <div className="shrink-0 pt-0.5">
          {isUser ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-white font-medium text-xs shadow-xs border border-gray-700">
              <User className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xs ring-2 ring-gray-800">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-hidden space-y-3">
          {/* Header info (Model badge, Timestamp) */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-200">
                {isUser ? 'You' : 'My AI Model'}
              </span>
              {!isUser && message.modelUsed && (
                <span className="rounded bg-[#1f1f1f] px-1.5 py-0.5 text-[10px] font-mono text-gray-400 border border-gray-800">
                  {message.modelUsed.replace('gemini-', '')}
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Attached Files & Images */}
          {message.files && message.files.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {message.files.map((file) => (
                <FileAttachmentCard
                  key={file.id}
                  file={file}
                  onPreviewImage={(src) => setSelectedImage(src)}
                />
              ))}
            </div>
          )}

          {/* Thinking Accordion (Chain of Thought) */}
          {!isUser && (message.thoughtContent || message.thinkingTimeMs) && (
            <div className="rounded-xl border border-purple-900/50 bg-purple-950/20 text-xs overflow-hidden">
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="flex w-full items-center justify-between px-3 py-2 text-purple-300 font-medium hover:bg-purple-900/30 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <BrainCircuit className="h-3.5 w-3.5 text-purple-400" />
                  <span>
                    Thinking Process
                    {message.thinkingTimeMs
                      ? ` (${(message.thinkingTimeMs / 1000).toFixed(1)}s)`
                      : ''}
                  </span>
                </div>
                {showThinking ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>

              {showThinking && (
                <div className="px-3 pb-3 pt-1 text-gray-400 border-t border-purple-900/30 space-y-1.5 leading-relaxed font-mono text-[11px]">
                  {message.thoughtContent ||
                    'Reasoning structured: evaluated user prompt, decomposed multi-step objectives, validated code syntax, formulated detailed markdown response.'}
                </div>
              )}
            </div>
          )}

          {/* Web Search Grounding Sources */}
          {!isUser &&
            message.groundingSources &&
            message.groundingSources.length > 0 && (
              <div className="rounded-lg border border-gray-800 bg-[#171717] p-2.5 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-gray-400 font-medium text-[11px]">
                  <Globe className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Sources Grounded</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {message.groundingSources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-gray-800 bg-[#1f1f1f] px-2 py-1 text-[11px] text-gray-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors shadow-2xs"
                    >
                      <span className="truncate max-w-[180px]">{source.title}</span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                    </a>
                  ))}
                </div>
              </div>
            )}

          {/* Main Message Markdown Body or Error Box */}
          {message.isError ? (
            <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-amber-200">
                    {message.content}
                  </p>
                  <p className="text-xs text-amber-400/80">
                    Spikes in demand are usually temporary. You can retry with the button below or switch to another model.
                  </p>
                  {onRegenerate && (
                    <div className="pt-1">
                      <button
                        onClick={onRegenerate}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Retry Request</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-sm leading-relaxed break-words text-gray-200">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');

                    if (!inline && (language || codeString.includes('\n'))) {
                      return (
                        <CodeBlockRenderer
                          language={language || 'text'}
                          code={codeString}
                          onOpenArtifact={onOpenArtifact}
                        />
                      );
                    }

                    return (
                      <code
                        className="rounded bg-[#262626] px-1.5 py-0.5 font-mono text-[13px] text-gray-100 font-medium border border-gray-700/40"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="my-3 overflow-x-auto rounded-lg border border-gray-800">
                        <table className="min-w-full divide-y divide-gray-800 text-xs">
                          {children}
                        </table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return (
                      <th className="bg-[#1f1f1f] px-3 py-2 text-left font-semibold text-gray-100">
                        {children}
                      </th>
                    );
                  },
                  td({ children }) {
                    return (
                      <td className="px-3 py-2 border-t border-gray-800 text-gray-300">
                        {children}
                      </td>
                    );
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="my-2 border-l-3 border-indigo-500 pl-3 italic text-gray-400">
                        {children}
                      </blockquote>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>

              {/* Blinking cursor when streaming */}
              {isStreaming && (
                <span className="inline-block h-4 w-2 ml-1 bg-indigo-500 animate-pulse align-middle" />
              )}
            </div>
          )}

          {/* Action Toolbar for Assistant Messages */}
          {!isUser && !isStreaming && !message.isError && (
            <div className="flex items-center gap-1 pt-1 text-gray-400">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-md p-1.5 hover:bg-gray-800 hover:text-gray-200 text-xs transition-colors"
                title="Copy full message"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[11px] text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={handleToggleVoice}
                className={`flex items-center gap-1 rounded-md p-1.5 text-xs transition-colors ${
                  isPlayingAudio
                    ? 'text-indigo-300 bg-indigo-950/70 border border-indigo-800 font-medium'
                    : 'hover:bg-gray-800 hover:text-gray-200'
                }`}
                title={isPlayingAudio ? 'Stop reading' : 'Read aloud with AI voice'}
              >
                {isPlayingAudio ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-[11px] text-indigo-300">Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Listen</span>
                  </>
                )}
              </button>

              <div className="h-3 w-px bg-gray-800 mx-1" />

              <button
                onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                className={`p-1.5 rounded-md hover:bg-gray-800 hover:text-gray-200 transition-colors ${
                  feedback === 'up' ? 'text-emerald-400' : ''
                }`}
                title="Good response"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
                className={`p-1.5 rounded-md hover:bg-gray-800 hover:text-gray-200 transition-colors ${
                  feedback === 'down' ? 'text-rose-400' : ''
                }`}
                title="Bad response"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>

              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 rounded-md p-1.5 hover:bg-gray-800 hover:text-gray-200 text-xs transition-colors ml-auto"
                  title="Regenerate response"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Regenerate</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Zoom Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={selectedImage}
              alt="Preview"
              className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// File Attachment Item component
const FileAttachmentCard: React.FC<{
  file: FileAttachment;
  onPreviewImage: (src: string) => void;
}> = ({ file, onPreviewImage }) => {
  const isImage = file.type === 'image' || file.mimeType.startsWith('image/');

  if (isImage) {
    return (
      <div
        onClick={() => onPreviewImage(file.data)}
        className="relative group h-20 w-20 overflow-hidden rounded-xl border border-gray-800 cursor-pointer shadow-xs"
      >
        <img
          src={file.data}
          alt={file.name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
          <ImageIcon className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-[#171717] px-3 py-2 text-xs shadow-2xs">
      <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
      <div className="truncate max-w-[140px]">
        <div className="truncate font-medium text-gray-200">
          {file.name}
        </div>
        <div className="text-[10px] text-gray-500">
          {(file.size / 1024).toFixed(1)} KB
        </div>
      </div>
    </div>
  );
};

// Code Block with Canvas & Run integration
const CodeBlockRenderer: React.FC<{
  language: string;
  code: string;
  onOpenArtifact?: (artifact: Artifact) => void;
}> = ({ language, code, onOpenArtifact }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCanvas = () => {
    if (onOpenArtifact) {
      const isHtml = language === 'html' || language === 'svg';
      const artifact: Artifact = {
        id: `art_${Date.now()}`,
        title: `${language.toUpperCase()} Component`,
        type: isHtml ? (language === 'svg' ? 'svg' : 'html') : 'code',
        language,
        content: code,
      };
      onOpenArtifact(artifact);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-gray-800 bg-[#121212] text-gray-100 shadow-md">
      {/* Code Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-[#1a1a1a] px-3.5 py-1.5 text-xs text-gray-400">
        <span className="font-mono font-medium lowercase text-gray-300">
          {language}
        </span>
        <div className="flex items-center gap-1.5">
          {onOpenArtifact && (
            <button
              onClick={handleOpenCanvas}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              title="Open in Side Canvas / Artifact view"
            >
              <Layers className="h-3 w-3 text-indigo-400" />
              <span>Canvas</span>
            </button>
          )}

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Body */}
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-gray-200">
        <code>{code}</code>
      </pre>
    </div>
  );
};
