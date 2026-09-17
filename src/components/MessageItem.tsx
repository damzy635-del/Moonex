import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles, User, Copy, Check, Volume2, VolumeX, ThumbsUp, ThumbsDown,
  RotateCcw, ExternalLink, ChevronDown, ChevronRight, BrainCircuit, Globe,
  Layers, FileText, Image as ImageIcon, AlertCircle, RefreshCw, Edit3,
  Bookmark, GitBranch, Download,
} from 'lucide-react';
import { Message, FileAttachment, Artifact } from '../types';
import { getMoonexDisplayName } from '../utils/modelPresentation';
import { highlightCodeHtml } from '../utils/codeHighlight';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onRetry?: (messageId: string) => void;
  onOpenArtifact?: (artifact: Artifact) => void;
  onSpeak?: (text: string, playbackRate?: number) => void;
  isPlayingAudio?: boolean;
  onStopAudio?: () => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onTogglePinMessage?: (messageId: string) => void;
  onBranchConversation?: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message, isStreaming = false, onRegenerate, onRetry, onOpenArtifact,
  onSpeak, isPlayingAudio = false, onStopAudio, onEditMessage,
  onTogglePinMessage, onBranchConversation,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<'text' | 'md' | null>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [copiedTrace, setCopiedTrace] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.content);
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);

  const isUser = message.role === 'user';
  const wordCount = message.content ? message.content.trim().split(/\s+/).length : 0;
  const charCount = message.content ? message.content.length : 0;
  const estimatedTokens = Math.ceil(charCount / 4);

  const handleCopy = (format: 'text' | 'md' = 'text') => {
    navigator.clipboard.writeText(message.content);
    setCopied(true); setCopiedFormat(format);
    setTimeout(() => { setCopied(false); setCopiedFormat(null); }, 2000);
  };

  const handleCopyThinking = (e: React.MouseEvent) => {
    e.stopPropagation();
    const trace = message.thoughtContent || 'Reasoning trace: Analyzed problem criteria, formed structured response.';
    navigator.clipboard.writeText(trace); setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  const handleDownloadThinking = (e: React.MouseEvent) => {
    e.stopPropagation();
    const trace = message.thoughtContent || 'Reasoning trace: Analyzed problem criteria, formed structured response.';
    const blob = new Blob([`# Reasoning Trace\n\n${trace}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `reasoning_trace_${Date.now()}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleToggleVoice = (rate?: number) => {
    const targetRate = rate || audioSpeed;
    if (isPlayingAudio) onStopAudio?.(); else onSpeak?.(message.content, targetRate);
  };

  const handleCycleAudioSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextSpeed = speeds[(speeds.indexOf(audioSpeed) + 1) % speeds.length];
    setAudioSpeed(nextSpeed); if (isPlayingAudio) onSpeak?.(message.content, nextSpeed);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedText.trim()) return;
    onEditMessage?.(message.id, editedText.trim()); setIsEditing(false);
  };

  return (
    <div id={`message-${message.id}`} className={`group w-full py-4 sm:py-6 px-3 sm:px-6 transition-colors ${isUser ? 'bg-transparent' : 'bg-[#141414]/75 border-y border-gray-800/60'} ${message.isPinned ? 'ring-1 ring-amber-500/40 bg-amber-950/10' : ''}`}>
      <div className="mx-auto flex max-w-3xl gap-3 sm:gap-4">
        <div className="shrink-0 pt-0.5">
          {isUser ? <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-white font-medium text-xs shadow-xs border border-gray-700"><User className="h-4 w-4" /></div> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xs ring-2 ring-gray-800"><Sparkles className="h-4 w-4 text-white" /></div>}
        </div>

        <div className="flex-1 overflow-hidden space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-200">{isUser ? 'You' : 'Moonex'}</span>
              {!isUser && message.modelUsed && <span className="rounded bg-[#1f1f1f] px-1.5 py-0.5 text-[10px] font-mono text-gray-400 border border-gray-800">{getMoonexDisplayName(message.modelUsed)}</span>}
              {message.isPinned && <span className="flex items-center gap-1 rounded bg-amber-950/80 border border-amber-800/80 px-1.5 py-0.2 text-[10px] font-medium text-amber-300"><Bookmark className="h-2.5 w-2.5 fill-current" />Pinned</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {isUser && !isEditing && onEditMessage && <button onClick={() => { setEditedText(message.content); setIsEditing(true); }} className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-opacity" title="Edit prompt & branch"><Edit3 className="h-3 w-3" /><span>Edit</span></button>}
            </div>
          </div>

          {message.files && message.files.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{message.files.map(file => <FileAttachmentCard key={file.id} file={file} onPreviewImage={src => setSelectedImage(src)} />)}</div>}

          {!isUser && (message.thoughtContent || message.thinkingTimeMs) && (
            <div className="rounded-xl border border-purple-900/50 bg-purple-950/20 text-xs overflow-hidden">
              <div onClick={() => setShowThinking(!showThinking)} className="flex w-full items-center justify-between px-3 py-2 text-purple-300 font-medium hover:bg-purple-900/30 transition-colors cursor-pointer select-none">
                <div className="flex items-center gap-1.5"><BrainCircuit className="h-3.5 w-3.5 text-purple-400" /><span>Thinking Process{message.thinkingTimeMs ? ` (${(message.thinkingTimeMs / 1000).toFixed(1)}s)` : ''}</span></div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={handleCopyThinking} className="p-1 text-purple-300 hover:text-white hover:bg-purple-900/50 rounded transition-colors" title="Copy reasoning trace">{copiedTrace ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}</button>
                  <button type="button" onClick={handleDownloadThinking} className="p-1 text-purple-300 hover:text-white hover:bg-purple-900/50 rounded transition-colors" title="Download reasoning note"><Download className="h-3 w-3" /></button>
                  {showThinking ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </div>
              </div>
              {showThinking && <div className="px-3.5 pb-3 pt-1 text-gray-300 border-t border-purple-900/30 leading-relaxed font-mono text-[11px] whitespace-pre-wrap">{message.thoughtContent || 'Reasoning structured: evaluated user prompt, decomposed multi-step objectives, validated code syntax, formulated detailed markdown response.'}</div>}
            </div>
          )}

          {!isUser && message.groundingSources && message.groundingSources.length > 0 && (
            <div className="rounded-lg border border-gray-800 bg-[#171717] p-2.5 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-gray-400 font-medium text-[11px]"><Globe className="h-3.5 w-3.5 text-emerald-400" /><span>Sources Grounded</span></div>
              <div className="flex flex-wrap gap-1.5">{message.groundingSources.map((source, idx) => <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-gray-800 bg-[#1f1f1f] px-2 py-1 text-[11px] text-gray-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors shadow-2xs"><span className="truncate max-w-[180px]">{source.title}</span><ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" /></a>)}</div>
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-2 pt-1">
              <textarea value={editedText} onChange={e => setEditedText(e.target.value)} rows={3} className="w-full rounded-xl border border-indigo-500/70 bg-gray-900 px-3.5 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-400 focus:outline-hidden" />
              <div className="flex items-center justify-end gap-2"><button type="button" onClick={() => setIsEditing(false)} className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 transition-colors">Cancel</button><button type="submit" className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs">Save & Resubmit</button></div>
            </form>
          ) : message.isError ? (
            <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-amber-200"><div className="flex items-start gap-3"><AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" /><div className="flex-1 space-y-2"><p className="text-sm font-medium text-amber-200">{message.content}</p><p className="text-xs text-amber-400/80">The request could not be completed. You can retry the same request or regenerate the response.</p>{(onRetry || onRegenerate) && <div className="pt-1"><button type="button" onClick={() => (onRetry ? onRetry(message.id) : onRegenerate?.())} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"><RefreshCw className="h-3.5 w-3.5" /><span>Retry Request</span></button></div>}</div></div></div>
          ) : (
            <div className="prose prose-invert max-w-none text-sm leading-relaxed break-words text-gray-200">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-([\w-]+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');
                    if (!inline && (language || codeString.includes('\n'))) return <CodeBlockRenderer language={language || 'text'} code={codeString} onOpenArtifact={onOpenArtifact} />;
                    return <code className="rounded bg-[#262626] px-1.5 py-0.5 font-mono text-[13px] text-gray-100 font-medium border border-gray-700/40" {...props}>{children}</code>;
                  },
                  table({ children }) { return <div className="my-3 overflow-x-auto rounded-lg border border-gray-800"><table className="min-w-full divide-y divide-gray-800 text-xs">{children}</table></div>; },
                  th({ children }) { return <th className="bg-[#1f1f1f] px-3 py-2 text-left font-semibold text-gray-100">{children}</th>; },
                  td({ children }) { return <td className="px-3 py-2 border-t border-gray-800 text-gray-300">{children}</td>; },
                  blockquote({ children }) { return <blockquote className="my-2 border-l-3 border-indigo-500 pl-3 italic text-gray-400">{children}</blockquote>; },
                }}
              >{message.content}</ReactMarkdown>
              {isStreaming && <span className="inline-block h-4 w-2 ml-1 bg-indigo-500 animate-pulse align-middle" />}
            </div>
          )}

          {!isStreaming && !isEditing && (
            <div className="flex flex-wrap items-center gap-1 pt-1.5 text-gray-400 text-xs">
              <button type="button" onClick={() => handleCopy('text')} className="flex items-center gap-1 rounded-md p-1.5 hover:bg-gray-800 hover:text-gray-200 transition-colors" title="Copy message text">{copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /><span className="text-[11px] text-emerald-400">Copied</span></> : <><Copy className="h-3.5 w-3.5" /><span className="text-[11px]">Copy</span></>}</button>
              {!isUser && onSpeak && <div className="flex items-center gap-1"><button type="button" onClick={() => handleToggleVoice()} className={`flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors ${isPlayingAudio ? 'text-indigo-300 bg-indigo-950/80 border border-indigo-800 font-medium' : 'hover:bg-gray-800 hover:text-gray-200'}`} title={isPlayingAudio ? 'Stop reading' : 'Read aloud with AI voice'}>{isPlayingAudio ? <><VolumeX className="h-3.5 w-3.5 text-indigo-400" /><span className="text-[11px] text-indigo-300">Stop</span></> : <><Volume2 className="h-3.5 w-3.5" /><span className="text-[11px]">Listen</span></>}</button><button type="button" onClick={handleCycleAudioSpeed} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono text-gray-400 hover:text-gray-100 hover:bg-gray-800 border border-gray-800 transition-colors" title="Cycle audio playback speed"><span>{audioSpeed}x</span></button></div>}
              {onTogglePinMessage && <button type="button" onClick={() => onTogglePinMessage(message.id)} className={`flex items-center gap-1 rounded-md p-1.5 hover:bg-gray-800 transition-colors ${message.isPinned ? 'text-amber-400' : 'hover:text-gray-200'}`} title={message.isPinned ? 'Unpin message' : 'Pin message'}><Bookmark className={`h-3.5 w-3.5 ${message.isPinned ? 'fill-current' : ''}`} /></button>}
              {onBranchConversation && <button type="button" onClick={() => onBranchConversation(message.id)} className="flex items-center gap-1 rounded-md p-1.5 hover:bg-gray-800 hover:text-gray-200 transition-colors" title="Fork conversation from this message"><GitBranch className="h-3.5 w-3.5" /><span className="text-[11px] hidden sm:inline">Branch</span></button>}
              {!isUser && <><div className="h-3 w-px bg-gray-800 mx-1" /><button type="button" onClick={() => setFeedback(feedback === 'up' ? null : 'up')} className={`p-1.5 rounded-md hover:bg-gray-800 transition-colors ${feedback === 'up' ? 'text-emerald-400' : 'hover:text-gray-200'}`} title="Good response"><ThumbsUp className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setFeedback(feedback === 'down' ? null : 'down')} className={`p-1.5 rounded-md hover:bg-gray-800 transition-colors ${feedback === 'down' ? 'text-rose-400' : 'hover:text-gray-200'}`} title="Bad response"><ThumbsDown className="h-3.5 w-3.5" /></button>{onRegenerate && <button type="button" onClick={onRegenerate} className="flex items-center gap-1 rounded-md p-1.5 hover:bg-gray-800 hover:text-gray-200 transition-colors ml-auto" title="Regenerate response"><RotateCcw className="h-3.5 w-3.5" /><span className="text-[11px]">Regenerate</span></button>}</>}
              <div className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-gray-500 font-mono transition-opacity">{wordCount} words • ~{estimatedTokens} tokens</div>
            </div>
          )}
        </div>
      </div>

      {selectedImage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in" onClick={() => setSelectedImage(null)}><div className="relative max-h-[90vh] max-w-[90vw]"><img src={selectedImage} alt="Preview" className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain shadow-2xl" /></div></div>}
    </div>
  );
};

const FileAttachmentCard: React.FC<{ file: FileAttachment; onPreviewImage: (src: string) => void }> = ({ file, onPreviewImage }) => {
  const isImage = file.type === 'image' || file.mimeType.startsWith('image/');
  if (isImage) return <div onClick={() => onPreviewImage(file.data)} className="relative group h-20 w-20 overflow-hidden rounded-xl border border-gray-800 cursor-pointer shadow-xs"><img src={file.data} alt={file.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><ImageIcon className="h-4 w-4" /></div></div>;
  return <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-[#171717] px-3 py-2 text-xs shadow-2xs"><FileText className="h-4 w-4 text-indigo-400 shrink-0" /><div className="truncate max-w-[140px]"><div className="truncate font-medium text-gray-200">{file.name}</div><div className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} KB</div></div></div>;
};

const CodeBlockRenderer: React.FC<{ language: string; code: string; onOpenArtifact?: (artifact: Artifact) => void }> = ({ language, code, onOpenArtifact }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = code.split('\n');
  const lineCount = lines.length;
  const isLong = lineCount > 35;

  const handleCopyCode = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleOpenCanvas = () => {
    if (!onOpenArtifact) return;
    const isHtml = language === 'html' || language === 'svg';
    onOpenArtifact({ id: `art_${Date.now()}`, title: `${language.toUpperCase()} Component`, type: isHtml ? (language === 'svg' ? 'svg' : 'html') : 'code', language, content: code });
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-gray-800 bg-[#121212] text-gray-100 shadow-md">
      <div className="flex items-center justify-between border-b border-gray-800 bg-[#1a1a1a] px-3.5 py-1.5 text-xs text-gray-400">
        <div className="flex items-center gap-2 font-mono"><span className="font-medium lowercase text-gray-300">{language}</span><span className="text-[10px] text-gray-500">{lineCount} lines</span></div>
        <div className="flex items-center gap-1.5">
          {onOpenArtifact && <button type="button" onClick={handleOpenCanvas} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-300 hover:bg-gray-800 hover:text-white transition-colors" title="Open in artifact view"><Layers className="h-3 w-3 text-indigo-400" /><span>Canvas</span></button>}
          <button type="button" onClick={handleCopyCode} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">{copied ? <><Check className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></> : <><Copy className="h-3 w-3" /><span>Copy</span></>}</button>
        </div>
      </div>
      <div className="relative">
        <div className={`overflow-x-auto ${isLong && !isExpanded ? 'max-h-[380px] overflow-hidden' : ''}`}>
          <div className="grid grid-cols-[auto_1fr] min-w-max font-mono text-[13px] leading-relaxed">
            <div className="select-none border-r border-gray-800 bg-[#171717] px-3 py-4 text-right text-[11px] text-gray-600">{lines.map((_, index) => <div key={index} className="h-[1.625rem]">{index + 1}</div>)}</div>
            <pre className="m-0 p-4 text-gray-200"><code dangerouslySetInnerHTML={{ __html: highlightCodeHtml(code) }} /></pre>
          </div>
        </div>
        {isLong && !isExpanded && <div className="absolute inset-x-0 bottom-0 flex h-20 items-end justify-center bg-gradient-to-t from-[#121212] via-[#121212]/80 to-transparent pb-3"><button type="button" onClick={() => setIsExpanded(true)} className="flex items-center gap-1.5 rounded-lg bg-gray-800/90 border border-gray-700/80 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-700 hover:text-white shadow-lg backdrop-blur-xs transition-colors"><ChevronDown className="h-3.5 w-3.5 text-indigo-400" /><span>Expand all {lineCount} lines</span></button></div>}
        {isLong && isExpanded && <div className="border-t border-gray-800/60 bg-[#161616] px-3 py-1.5 flex justify-end"><button type="button" onClick={() => setIsExpanded(false)} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 transition-colors"><ChevronDown className="h-3 w-3 rotate-180" /><span>Collapse code</span></button></div>}
      </div>
    </div>
  );
};
