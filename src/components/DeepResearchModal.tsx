import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Compass,
  X,
  Sparkles,
  Search,
  BookOpen,
  ArrowRight,
  Download,
  ExternalLink,
  CheckCircle2,
  Loader2,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { DeepResearchResult } from '../types';

interface DeepResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueInChat: (report: string) => void;
}

const RESEARCH_SUGGESTIONS = [
  'Comparative study of modern Vector Databases (Pinecone vs Milvus vs Qdrant vs pgvector) for 10M+ scale',
  'Comprehensive analysis of commercial Nuclear Fusion milestones, venture funding, and magnet breakthroughs',
  'Technical evaluation of Next.js App Router vs Remix/React Router v7 for enterprise applications',
  'Global semiconductor supply chain dynamics, EUV lithography advances, and geopolitical risk factors',
];

export const DeepResearchModal: React.FC<DeepResearchModalProps> = ({
  isOpen,
  onClose,
  onContinueInChat,
}) => {
  const [topic, setTopic] = useState('');
  const [focusAreaInput, setFocusAreaInput] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'planning' | 'searching' | 'synthesizing' | 'completed'>('idle');
  const [result, setResult] = useState<DeepResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddFocusArea = () => {
    if (focusAreaInput.trim() && !focusAreas.includes(focusAreaInput.trim())) {
      setFocusAreas([...focusAreas, focusAreaInput.trim()]);
      setFocusAreaInput('');
    }
  };

  const handleRemoveFocusArea = (tag: string) => {
    setFocusAreas(focusAreas.filter((t) => t !== tag));
  };

  const handleStartResearch = async () => {
    if (!topic.trim()) return;

    setError(null);
    setStatus('planning');
    setResult(null);

    try {
      // Simulate live stage progression for UI responsiveness
      setTimeout(() => {
        setStatus('searching');
      }, 1500);

      setTimeout(() => {
        setStatus('synthesizing');
      }, 3500);

      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          focusAreas,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to complete deep research analysis.');
      }

      const data = await res.json();
      setResult(data);
      setStatus('completed');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An error occurred during deep research.');
      setStatus('idle');
    }
  };

  const handleDownloadReport = () => {
    if (!result) return;
    const content = `# Deep Research Briefing: ${result.topic}\n\nDate: ${new Date(result.timestamp).toLocaleString()}\n\n## 1. Research Plan & Strategy\n${result.plan}\n\n## 2. Comprehensive Findings & Report\n${result.report}\n\n## 3. Sources & Citations\n${result.sources.map((s) => `- [${s.title}](${s.url})`).join('\n')}\n`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Research_Briefing_${result.topic.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="deep-research-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="deep-research-dialog"
        className="relative flex h-[90vh] max-h-[760px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-[#171717] shadow-2xl text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-gray-800 px-4 sm:px-6 bg-[#141414] shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Deep Research Agent
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs sm:text-sm">
          {status === 'idle' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/30 p-3.5 text-indigo-200">
                <p className="text-xs leading-relaxed">
                  The Deep Research Agent formulates structured inquiries, performs grounded multi-query web searches, extracts authoritative findings, and synthesizes publication-grade executive briefings with citations.
                </p>
              </div>

              {/* Topic Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Research Topic or Question
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter a deep topic, comparison, technical investigation, or market question..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-800 bg-[#1f1f1f] p-3 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Focus Areas */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Key Angles / Focus Areas (Optional)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={focusAreaInput}
                    onChange={(e) => setFocusAreaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFocusArea();
                      }
                    }}
                    placeholder="e.g. Cost efficiency, Security implications, Latency"
                    className="flex-1 rounded-lg border border-gray-800 bg-[#1f1f1f] px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddFocusArea}
                    className="rounded-lg border border-gray-700 bg-[#1f1f1f] px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800"
                  >
                    Add
                  </button>
                </div>

                {focusAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {focusAreas.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-md bg-gray-800 border border-gray-700/60 px-2 py-0.5 text-xs text-gray-200"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveFocusArea(tag)}
                          className="hover:text-rose-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggested Topics */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Example Research Queries
                </span>
                <div className="mt-2 space-y-1.5">
                  {RESEARCH_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => setTopic(sug)}
                      className="w-full text-left rounded-lg border border-gray-800/80 bg-[#1f1f1f] p-2.5 text-xs text-gray-300 hover:bg-[#252525] hover:text-white transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-rose-950/50 border border-rose-900/60 p-3 text-xs text-rose-300">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Running Progress View */}
          {['planning', 'searching', 'synthesizing'].includes(status) && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl animate-pulse">
                <Compass className="h-8 w-8 animate-spin" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">
                  Conducting Deep Multi-Stage Research
                </h3>
                <p className="text-xs text-gray-400 max-w-sm">
                  Investigating: <span className="font-medium text-gray-200">"{topic}"</span>
                </p>
              </div>

              {/* 3 Step Visual Pipeline */}
              <div className="w-full max-w-md space-y-3 pt-2 text-left">
                <div className="flex items-center gap-3 rounded-lg border border-gray-800 p-2.5 bg-[#121212]">
                  {status === 'planning' ? (
                    <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  <span className="text-xs font-medium text-gray-200">
                    1. Formulating Inquiry Plan & Search Queries
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-gray-800 p-2.5 bg-[#121212]">
                  {status === 'searching' ? (
                    <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                  ) : status === 'synthesizing' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-gray-600" />
                  )}
                  <span className="text-xs font-medium text-gray-200">
                    2. Searching Web & Grounding Live Data Sources
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-gray-800 p-2.5 bg-[#121212]">
                  {status === 'synthesizing' ? (
                    <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-gray-600" />
                  )}
                  <span className="text-xs font-medium text-gray-200">
                    3. Synthesizing Deep Publication Briefing
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Completed Report View */}
          {status === 'completed' && result && (
            <div className="space-y-6">
              {/* Report Header */}
              <div className="rounded-xl border border-gray-800 bg-[#141414] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">
                    {result.topic}
                  </h3>
                  <button
                    onClick={handleDownloadReport}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-white shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Report</span>
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Generated on {new Date(result.timestamp).toLocaleString()}
                </div>
              </div>

              {/* Research Plan */}
              <div className="rounded-xl border border-gray-800 p-4 bg-[#141414]">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Research Plan & Objectives
                </h4>
                <div className="prose prose-invert max-w-none text-xs leading-relaxed text-gray-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.plan}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Main Report */}
              <div className="rounded-xl border border-gray-800 p-4 sm:p-6 bg-[#141414]">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Comprehensive Findings
                </h4>
                <div className="prose prose-invert max-w-none text-sm leading-relaxed text-gray-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.report}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Grounded Sources */}
              {result.sources.length > 0 && (
                <div className="rounded-xl border border-gray-800 p-4 bg-[#121212]">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Verified Citations & Sources
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-[#1f1f1f] px-2.5 py-1.5 text-xs text-gray-300 hover:text-indigo-400 hover:border-gray-600 transition-colors"
                      >
                        <span className="truncate max-w-[200px]">{s.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-gray-800 px-4 sm:px-6 py-3 bg-[#141414] shrink-0">
          {status === 'idle' ? (
            <>
              <button
                onClick={onClose}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleStartResearch}
                disabled={!topic.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-xs transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Launch Research</span>
              </button>
            </>
          ) : status === 'completed' && result ? (
            <>
              <button
                onClick={() => {
                  setStatus('idle');
                  setResult(null);
                }}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                New Research
              </button>
              <button
                onClick={() => {
                  onContinueInChat(result.report);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Discuss in Chat</span>
              </button>
            </>
          ) : (
            <div className="text-xs text-gray-400">Processing inquiry...</div>
          )}
        </div>
      </div>
    </div>
  );
};
