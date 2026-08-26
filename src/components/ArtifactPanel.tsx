import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  Copy,
  Check,
  Download,
  Play,
  Code2,
  Eye,
  Terminal,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  Send,
  Trash2,
  Columns,
} from 'lucide-react';
import { Artifact } from '../types';

interface ArtifactPanelProps {
  artifact: Artifact | null;
  isOpen: boolean;
  onClose: () => void;
  onSendRefactorPrompt?: (prompt: string) => void;
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifact,
  isOpen,
  onClose,
  onSendRefactorPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'preview' | 'split' | 'run'>('code');
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [content, setContent] = useState<string>('');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [refactorInput, setRefactorInput] = useState('');
  const [showRefactorBar, setShowRefactorBar] = useState(false);

  useEffect(() => {
    if (artifact) {
      setContent(artifact.content);
      // Auto-select preview or split if it's HTML, SVG, or Markdown
      if (['html', 'svg', 'markdown'].includes(artifact.type)) {
        setActiveTab('preview');
      } else {
        setActiveTab('code');
      }
      setTerminalOutput('');
      setShowRefactorBar(false);
      setRefactorInput('');
    }
  }, [artifact]);

  if (!isOpen || !artifact) return null;

  const isPreviewable = ['html', 'svg', 'markdown', 'json'].includes(artifact.type);
  const lineCount = content ? content.split('\n').length : 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    let ext = '.txt';
    let mimeType = 'text/plain';

    if (artifact.type === 'html') {
      ext = '.html';
      mimeType = 'text/html';
    } else if (artifact.type === 'svg') {
      ext = '.svg';
      mimeType = 'image/svg+xml';
    } else if (artifact.type === 'markdown') {
      ext = '.md';
      mimeType = 'text/markdown';
    } else if (artifact.type === 'json') {
      ext = '.json';
      mimeType = 'application/json';
    } else if (artifact.language) {
      const l = artifact.language.toLowerCase();
      if (l === 'python' || l === 'py') ext = '.py';
      else if (l === 'typescript' || l === 'ts') ext = '.ts';
      else if (l === 'tsx') ext = '.tsx';
      else if (l === 'javascript' || l === 'js') ext = '.js';
      else if (l === 'jsx') ext = '.jsx';
      else if (l === 'css') ext = '.css';
      else if (l === 'sql') ext = '.sql';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setTerminalOutput('⚡ Executing sandbox simulation...\n');
    setActiveTab('run');

    try {
      const res = await fetch('/api/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: content,
          language: artifact.language || artifact.type,
        }),
      });
      const data = await res.json();
      setTerminalOutput(data.output || 'Execution completed with 0 errors.');
    } catch (e: any) {
      setTerminalOutput(`Error executing sandbox: ${e.message || 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRefactorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refactorInput.trim() || !onSendRefactorPrompt) return;
    const prompt = `Refactor the artifact "${artifact.title}" (${artifact.language || artifact.type}):\n\nGoal: ${refactorInput.trim()}\n\nCurrent Content:\n\`\`\`${artifact.language || ''}\n${content}\n\`\`\``;
    onSendRefactorPrompt(prompt);
    setRefactorInput('');
    setShowRefactorBar(false);
  };

  // Helper to render preview element
  const renderPreviewElement = (isSplit = false) => {
    if (artifact.type === 'html') {
      return (
        <div
          className={`h-full w-full flex items-center justify-center transition-all duration-200 ${
            !isSplit && previewViewport === 'mobile'
              ? 'max-w-[375px]'
              : !isSplit && previewViewport === 'tablet'
              ? 'max-w-[768px]'
              : 'w-full'
          }`}
        >
          <iframe
            title="Artifact Live Preview"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><script src="https://cdn.tailwindcss.com"></script><style>body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0d0d0d; color: #e5e5e5; }</style></head><body>${content}</body></html>`}
            sandbox="allow-scripts allow-modals"
            className="h-full min-h-[350px] w-full rounded-xl border border-gray-800 bg-[#121212] shadow-xl"
          />
        </div>
      );
    } else if (artifact.type === 'svg') {
      return (
        <div
          className="flex h-full min-h-[350px] w-full items-center justify-center rounded-xl border border-gray-800 bg-[#121212] p-6 shadow-xl"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    } else if (artifact.type === 'markdown') {
      return (
        <div className="prose prose-invert max-w-none w-full h-full overflow-auto rounded-xl border border-gray-800 bg-[#121212] p-6 text-gray-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      );
    } else {
      return (
        <pre className="p-4 font-mono text-xs text-gray-200 w-full overflow-auto">
          {content}
        </pre>
      );
    }
  };

  return (
    <aside
      id="artifacts-canvas-panel"
      className={`fixed md:relative inset-y-0 right-0 z-40 flex flex-col bg-[#171717] border-l border-gray-800 shadow-2xl md:shadow-none transition-all duration-200 text-gray-200 ${
        isMaximized
          ? 'fixed inset-0 z-50 w-full'
          : activeTab === 'split'
          ? 'w-full sm:w-[600px] lg:w-[840px] xl:w-[980px]'
          : 'w-full sm:w-[480px] lg:w-[560px] xl:w-[640px]'
      }`}
    >
      {/* Canvas Header */}
      <div className="flex h-14 items-center justify-between border-b border-gray-800 px-4 bg-[#141414]">
        <div className="flex items-center gap-2 truncate">
          <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
          <span className="font-semibold text-sm text-white truncate">
            {artifact.title}
          </span>
          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono text-gray-300 uppercase border border-gray-700/50">
            {artifact.language || artifact.type}
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          {/* Ask AI to Refactor */}
          {onSendRefactorPrompt && (
            <button
              type="button"
              onClick={() => setShowRefactorBar(!showRefactorBar)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                showRefactorBar
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-400 hover:bg-gray-800'
              }`}
              title="Ask AI to refine or refactor this code"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refactor</span>
            </button>
          )}

          {/* Maximize / Restore */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            title={isMaximized ? 'Restore canvas' : 'Maximize canvas'}
          >
            {isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            title="Copy content"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>

          {/* Download File */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            title="Download file"
          >
            <Download className="h-4 w-4" />
          </button>

          {/* Close Panel */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            title="Close canvas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Refactor Bar Drawer */}
      {showRefactorBar && onSendRefactorPrompt && (
        <form
          onSubmit={handleRefactorSubmit}
          className="border-b border-gray-800 bg-[#16161c] p-3 flex items-center gap-2 animate-in slide-in-from-top duration-150"
        >
          <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
          <input
            type="text"
            value={refactorInput}
            onChange={(e) => setRefactorInput(e.target.value)}
            placeholder="e.g. Add TypeScript types, improve responsive CSS, or optimize algorithm..."
            className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
            autoFocus
          />
          <button
            type="submit"
            disabled={!refactorInput.trim()}
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors shadow-xs"
          >
            Submit
          </button>
        </form>
      )}

      {/* Tabs Switcher Bar */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2 bg-[#171717] text-xs">
        <div className="flex items-center gap-1 bg-[#1f1f1f] p-1 rounded-lg border border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'code'
                ? 'bg-gray-800 text-white shadow-2xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Code ({lineCount})</span>
          </button>

          {isPreviewable && (
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'preview'
                  ? 'bg-gray-800 text-white shadow-2xs'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Preview</span>
            </button>
          )}

          {isPreviewable && (
            <button
              type="button"
              onClick={() => setActiveTab('split')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'split'
                  ? 'bg-gray-800 text-white shadow-2xs'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Side-by-side Code & Live Preview"
            >
              <Columns className="h-3.5 w-3.5 text-indigo-400" />
              <span>Split</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('run')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'run'
                ? 'bg-gray-800 text-white shadow-2xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Console</span>
          </button>
        </div>

        {/* Viewport Toggles (When Preview active) or Run Button */}
        {activeTab === 'preview' && artifact.type === 'html' ? (
          <div className="flex items-center gap-1 bg-[#1f1f1f] p-1 rounded-lg border border-gray-800">
            <button
              type="button"
              onClick={() => setPreviewViewport('desktop')}
              className={`p-1 rounded ${previewViewport === 'desktop' ? 'bg-gray-800 text-white' : 'text-gray-400'}`}
              title="Desktop view"
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewViewport('tablet')}
              className={`p-1 rounded ${previewViewport === 'tablet' ? 'bg-gray-800 text-white' : 'text-gray-400'}`}
              title="Tablet view (768px)"
            >
              <Tablet className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewViewport('mobile')}
              className={`p-1 rounded ${previewViewport === 'mobile' ? 'bg-gray-800 text-white' : 'text-gray-400'}`}
              title="Mobile view (375px)"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-2xs"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>{isRunning ? 'Running...' : 'Run Simulation'}</span>
          </button>
        )}
      </div>

      {/* Tab Contents Area */}
      <div className="flex-1 overflow-hidden bg-[#0f0f0f]">
        {/* Tab 1: Source Code Editor */}
        {activeTab === 'code' && (
          <div className="h-full p-4 overflow-auto">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-full w-full resize-none font-mono text-xs sm:text-sm leading-relaxed text-gray-100 bg-transparent focus:outline-hidden"
              spellCheck={false}
            />
          </div>
        )}

        {/* Tab 2: Interactive Live Preview */}
        {activeTab === 'preview' && (
          <div className="h-full w-full p-4 overflow-auto flex items-center justify-center bg-[#0d0d0d]">
            {renderPreviewElement(false)}
          </div>
        )}

        {/* Tab 3: Split View (Side-by-side Code + Live Preview) */}
        {activeTab === 'split' && (
          <div className="h-full w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-800 overflow-hidden">
            {/* Left: Code Editor */}
            <div className="flex-1 h-full p-4 overflow-auto flex flex-col bg-[#0f0f0f]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800 text-[11px] text-gray-400 font-mono">
                <span>Source Editor</span>
                <span>{lineCount} lines</span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full resize-none font-mono text-xs leading-relaxed text-gray-100 bg-transparent focus:outline-hidden"
                spellCheck={false}
              />
            </div>

            {/* Right: Live Preview */}
            <div className="flex-1 h-full p-4 overflow-auto flex flex-col bg-[#0d0d0d]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800 text-[11px] text-gray-400 font-mono">
                <span>Interactive Live Preview</span>
                <span className="text-emerald-400">● Live Sync</span>
              </div>
              <div className="flex-1 h-full overflow-hidden flex items-center justify-center">
                {renderPreviewElement(true)}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Console / Runner Output */}
        {activeTab === 'run' && (
          <div className="h-full p-4 font-mono text-xs bg-[#0b0b0b] text-gray-200 overflow-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-gray-800 text-gray-400">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Sandbox Terminal Output</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Status: {isRunning ? 'Executing...' : 'Idle'}</span>
                  {terminalOutput && (
                    <button
                      type="button"
                      onClick={() => setTerminalOutput('')}
                      className="text-gray-500 hover:text-gray-300"
                      title="Clear terminal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <pre className="pt-3 whitespace-pre-wrap leading-relaxed text-gray-300 font-mono text-[12px]">
                {terminalOutput ||
                  'Click "Run Simulation" above to execute or test this code in the sandbox.'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
