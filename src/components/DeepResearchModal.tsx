import React, { useEffect, useRef, useState } from 'react';
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
  Filter,
  GraduationCap,
  Cpu,
  TrendingUp,
  Globe2,
} from 'lucide-react';
import { DeepResearchResult } from '../types';
import { getResearchStepState, normalizeResearchSources } from '../utils/researchPresentation';

interface DeepResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueInChat: (report: string) => void;
}

const RESEARCH_SCOPES = [
  { id: 'general', label: 'All Web Sources', desc: 'Comprehensive multi-domain web search', icon: Globe2 },
  { id: 'academic', label: 'Academic & Science', desc: 'Prioritize arXiv, peer-reviewed literature, Nature, IEEE', icon: GraduationCap },
  { id: 'tech', label: 'Tech & Engineering', desc: 'Prioritize GitHub, developer docs, RFCs, StackOverflow', icon: Cpu },
  { id: 'finance', label: 'Business & Markets', desc: 'Prioritize financial reports, SEC filings, economic data', icon: TrendingUp },
];

const RESEARCH_SUGGESTIONS = [
  'Comparative study of modern Vector Databases (Pinecone vs Milvus vs Qdrant vs pgvector) for 10M+ scale',
  'Comprehensive analysis of commercial Nuclear Fusion milestones, venture funding, and magnet breakthroughs',
  'Technical evaluation of Next.js App Router vs Remix/React Router v7 for enterprise applications',
  'Global semiconductor supply chain dynamics, EUV lithography advances, and geopolitical risk factors',
];

const STEPS = [
  { id: 'planning' as const, label: 'Formulating inquiry plan & search strategy' },
  { id: 'searching' as const, label: 'Searching web & grounding authoritative sources' },
  { id: 'synthesizing' as const, label: 'Synthesizing deep executive briefing' },
];

export const DeepResearchModal: React.FC<DeepResearchModalProps> = ({ isOpen, onClose, onContinueInChat }) => {
  const [topic, setTopic] = useState('');
  const [selectedScope, setSelectedScope] = useState('general');
  const [focusAreaInput, setFocusAreaInput] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'planning' | 'searching' | 'synthesizing' | 'completed'>('idle');
  const [result, setResult] = useState<DeepResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => () => { requestIdRef.current += 1; }, []);

  if (!isOpen) return null;

  const handleAddFocusArea = () => {
    const value = focusAreaInput.trim();
    if (value && !focusAreas.includes(value)) {
      setFocusAreas((current) => [...current, value]);
      setFocusAreaInput('');
    }
  };

  const handleRemoveFocusArea = (tag: string) => setFocusAreas((current) => current.filter((t) => t !== tag));

  const handleStartResearch = async () => {
    const researchTopic = topic.trim();
    if (!researchTopic) return;

    const requestId = ++requestIdRef.current;
    setError(null);
    setStatus('planning');
    setResult(null);
    setIsRetrying(true);

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: researchTopic, focusAreas, searchScope: selectedScope }),
      });

      if (!res.ok) throw new Error('Failed to complete deep research analysis.');
      const data = (await res.json()) as DeepResearchResult;
      if (requestId !== requestIdRef.current) return;

      setResult({ ...data, sources: normalizeResearchSources(data.sources || []) });
      setStatus('completed');
    } catch (e: unknown) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'An error occurred during deep research.');
      setStatus('idle');
    } finally {
      if (requestId === requestIdRef.current) setIsRetrying(false);
    }
  };

  const handleDownloadReport = () => {
    if (!result) return;
    const sources = normalizeResearchSources(result.sources || []);
    const content = `# Deep Research Briefing: ${result.topic}\n\nDate: ${new Date(result.timestamp).toLocaleString()}\n\n## 1. Research Plan & Strategy\n${result.plan}\n\n## 2. Comprehensive Findings & Report\n${result.report}\n\n## 3. Sources & Citations\n${sources.map((s) => `- [${s.title}](${s.url})`).join('\n')}\n`;
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
    <div id="deep-research-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs" onClick={onClose}>
      <div id="deep-research-dialog" role="dialog" aria-modal="true" aria-labelledby="deep-research-title" className="relative flex h-[90vh] max-h-[760px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-[#171717] shadow-2xl text-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-14 items-center justify-between border-b border-gray-800 px-4 sm:px-6 bg-[#141414] shrink-0">
          <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs"><Compass className="h-4 w-4" /></div><h2 id="deep-research-title" className="text-sm font-bold text-white">Deep Research Agent</h2></div>
          <button type="button" aria-label="Close research" onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs sm:text-sm">
          {status === 'idle' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/30 p-3.5 text-indigo-200"><p className="text-xs leading-relaxed">The Deep Research Agent formulates structured inquiries, performs grounded multi-query web searches, extracts authoritative findings, and synthesizes publication-grade executive briefings with citations.</p></div>
              <div><label className="block text-xs font-semibold text-gray-300 mb-1" htmlFor="research-topic">Research Topic or Question</label><textarea id="research-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter a deep topic, comparison, technical investigation, or market question..." rows={3} className="w-full rounded-xl border border-gray-800 bg-[#1f1f1f] p-3 text-xs sm:text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden" /></div>
              <div><label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1"><Filter className="h-3 w-3 text-indigo-400" /><span>Domain Scope & Focus</span></label><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{RESEARCH_SCOPES.map((scope) => { const IconComp = scope.icon; const selected = selectedScope === scope.id; return <button key={scope.id} type="button" aria-pressed={selected} onClick={() => setSelectedScope(scope.id)} className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${selected ? 'border-indigo-500/80 bg-indigo-950/40 text-white shadow-xs' : 'border-gray-800 bg-[#1f1f1f] text-gray-300 hover:bg-gray-800'}`}><div className={`p-1.5 rounded-lg ${selected ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}><IconComp className="h-3.5 w-3.5" /></div><div className="truncate"><div className="font-semibold text-xs text-gray-100">{scope.label}</div><div className="text-[10px] text-gray-400 truncate">{scope.desc}</div></div></button>; })}</div></div>
              <div><label className="block text-xs font-semibold text-gray-300 mb-1">Key Angles / Specific Sub-Topics (Optional)</label><div className="flex gap-2 mb-2"><input type="text" value={focusAreaInput} onChange={(e) => setFocusAreaInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFocusArea(); } }} placeholder="e.g. Cost efficiency, Security implications, Latency benchmarks" className="flex-1 rounded-lg border border-gray-800 bg-[#1f1f1f] px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden" /><button type="button" onClick={handleAddFocusArea} className="rounded-lg border border-gray-700 bg-[#1f1f1f] px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800">Add</button></div>{focusAreas.length > 0 && <div className="flex flex-wrap gap-1.5">{focusAreas.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-gray-800 border border-gray-700/60 px-2 py-0.5 text-xs text-gray-200">{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => handleRemoveFocusArea(tag)} className="hover:text-rose-400"><X className="h-3 w-3" /></button></span>)}</div>}</div>
              <div className="pt-1"><span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Example Research Queries</span><div className="mt-2 space-y-1.5">{RESEARCH_SUGGESTIONS.map((sug, i) => <button key={i} type="button" onClick={() => setTopic(sug)} className="w-full text-left rounded-lg border border-gray-800/80 bg-[#1f1f1f] p-2.5 text-xs text-gray-300 hover:bg-[#252525] hover:text-white transition-colors">{sug}</button>)}</div></div>
              {error && <div role="alert" className="rounded-lg bg-rose-950/50 border border-rose-900/60 p-3 text-xs text-rose-300">{error}<button type="button" onClick={handleStartResearch} disabled={isRetrying} className="ml-3 underline hover:text-white disabled:opacity-50">Retry</button></div>}
              <button type="button" onClick={handleStartResearch} disabled={!topic.trim() || isRetrying} className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none"><Sparkles className="h-4 w-4" />{isRetrying ? 'Researching…' : 'Start Deep Research'}<ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {['planning', 'searching', 'synthesizing'].includes(status) && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl animate-pulse"><Compass className="h-8 w-8 animate-spin" /></div>
              <div className="space-y-1"><h3 className="text-base font-semibold text-white">Conducting Deep Multi-Stage Research</h3><p className="text-xs text-gray-400 max-w-sm">Investigating: <span className="font-medium text-gray-200">"{topic}"</span></p><span className="inline-block rounded bg-indigo-950/80 border border-indigo-800 px-2 py-0.5 text-[10px] font-mono text-indigo-300 uppercase">Scope: {selectedScope}</span></div>
              <div className="w-full max-w-md space-y-3 pt-2 text-left">{STEPS.map((step, index) => { const state = getResearchStepState(status, step.id); return <div key={step.id} className="flex items-center gap-3 rounded-lg border border-gray-800 p-2.5 bg-[#121212]"><div className="flex h-4 w-4 shrink-0 items-center justify-center">{state === 'active' ? <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" /> : state === 'complete' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <div className="h-4 w-4 rounded-full border border-gray-600" />}</div><span className={`text-xs font-medium ${state === 'active' ? 'text-white' : 'text-gray-300'}`}>{index + 1}. {step.label}</span></div>; })}</div>
            </div>
          )}

          {status === 'completed' && result && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-800 bg-[#141414] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold text-white">{result.topic}</h3><button type="button" onClick={handleDownloadReport} className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-white shadow-xs"><Download className="h-3.5 w-3.5" /><span>Download Report</span></button></div><div className="mt-3 flex flex-wrap gap-2 text-[10px] text-gray-400"><span>{normalizeResearchSources(result.sources || []).length} verified sources</span><span>•</span><span>{new Date(result.timestamp).toLocaleString()}</span></div></div>
              <div className="prose prose-invert max-w-none text-xs sm:text-sm"><h4 className="text-sm font-bold text-indigo-300">Research Plan</h4><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.plan}</ReactMarkdown><h4 className="mt-5 text-sm font-bold text-indigo-300">Comprehensive Findings</h4><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.report}</ReactMarkdown></div>
              <div className="rounded-xl border border-gray-800 bg-[#141414] p-4"><div className="flex items-center gap-2 mb-3"><BookOpen className="h-4 w-4 text-indigo-400" /><h4 className="text-sm font-semibold text-white">Sources & Citations</h4></div><div className="space-y-2">{normalizeResearchSources(result.sources || []).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-lg border border-gray-800 p-2.5 hover:bg-[#1f1f1f]"><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" /><span className="text-xs text-gray-300 break-words">{source.title}</span></a>)}{normalizeResearchSources(result.sources || []).length === 0 && <p className="text-xs text-gray-500">No verified web sources were returned.</p>}</div></div>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onContinueInChat(result.report)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"><MessageSquare className="h-3.5 w-3.5" />Continue in chat</button><button type="button" onClick={() => { setResult(null); setError(null); setStatus('idle'); }} className="flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800"><Search className="h-3.5 w-3.5" />New research</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};