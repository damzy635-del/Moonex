import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  Sparkles,
  Code,
  LineChart,
  PenTool,
  BrainCircuit,
  ShieldCheck,
  Cpu,
  Copy,
  Check,
  CornerDownLeft,
  Plus,
  Trash2,
} from 'lucide-react';

export interface PromptTemplate {
  id: string;
  title: string;
  category: 'code' | 'analysis' | 'writing' | 'reasoning' | 'architecture' | 'custom';
  description: string;
  prompt: string;
  recommendedModel?: string;
  enableThinking?: boolean;
  enableSearch?: boolean;
}

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'code-review-refactor',
    title: 'Senior Code Review & Optimization',
    category: 'code',
    description: 'Comprehensive code analysis for performance, security vulnerabilities, edge cases, and architectural cleanups.',
    prompt: `Act as a Principal Software Engineer. Conduct a rigorous, production-grade code review on the following snippet:
- Identify any hidden edge cases, memory leaks, or race conditions.
- Highlight time and space algorithmic complexity (Big-O).
- Propose modern TypeScript / idiomatic refactoring with cleaner modularity.
- Provide the optimized complete implementation with comments.

Code:
`,
    enableThinking: true,
  },
  {
    id: 'system-design-architect',
    title: 'Distributed System Design & Scalability Blueprint',
    category: 'architecture',
    description: 'Design robust, fault-tolerant microservices, database schemas, and caching tiers for high traffic.',
    prompt: `Act as a Lead Infrastructure Architect. Design a resilient, highly available distributed architecture for the following system requirement:
1. High-Level Architecture & Component Flow
2. Data Storage Strategy (SQL vs NoSQL, Sharding, Replication, Indexing)
3. Caching Strategy (Redis / CDN cache invalidation policies)
4. Failure Handling, Circuit Breakers, & Graceful Degradation
5. Latency & Throughput Trade-offs with Bottleneck Analysis

System Requirements:
`,
    enableThinking: true,
  },
  {
    id: 'data-sql-insights',
    title: 'Data & SQL Query Optimizer',
    category: 'analysis',
    description: 'Formulate advanced SQL queries, window functions, and extract actionable business intelligence metrics.',
    prompt: `Act as a Staff Data Engineer & Business Analyst. Analyze the dataset/schema provided below:
1. Formulate clean, index-optimized SQL queries with window functions where applicable.
2. Provide key business intelligence metrics and trends to monitor.
3. Suggest indexing strategies or schema normalizations to speed up query execution time.

Schema / Data Problem:
`,
    enableThinking: true,
  },
  {
    id: 'executive-synthesis',
    title: 'Executive Brief & Strategy Synthesis',
    category: 'writing',
    description: 'Distill technical or business documents into high-impact executive summaries with decision matrices.',
    prompt: `Synthesize the provided notes into an Executive Brief for leadership:
- **Executive Summary**: 3 bullet points with core takeaway and strategic impact.
- **Key Findings & Evidence**: Hard numbers, pros/cons, and risks.
- **Decision Matrix**: Prioritized options with effort vs impact assessment.
- **Next 30-60-90 Day Milestones**: Immediate action items and owners.

Context / Notes:
`,
  },
  {
    id: 'security-audit',
    title: 'Cybersecurity Threat & Vulnerability Audit',
    category: 'reasoning',
    description: 'Assess authentication, RBAC, input sanitization, and API security threats against OWASP Top 10.',
    prompt: `Act as a Lead Application Security Auditor. Perform a thorough security assessment for the following API/workflow:
1. OWASP Top 10 Threat Analysis (Injection, Broken Auth, SSRF, IDOR, CSRF)
2. Token Lifecycle & Secret Management Audit
3. Rate Limiting, CORS, & Input Validation Defense Recommendations
4. Exact Remediation Snippets

API / Code Context:
`,
    enableThinking: true,
  },
  {
    id: 'deep-problem-solving',
    title: 'First-Principles Technical Breakdown',
    category: 'reasoning',
    description: 'Deconstruct complex, ambiguous bugs or mathematical dilemmas using first-principles reasoning.',
    prompt: `Analyze the following ambiguous problem using first-principles reasoning:
1. Break the problem into its fundamental axioms and assumptions.
2. Formulate 3 distinct hypotheses for why the unexpected behavior is occurring.
3. Devise falsification tests to verify each hypothesis step-by-step.
4. Conclude with the highest probability root cause and definitive fix.

Problem:
`,
    enableThinking: true,
  },
  {
    id: 'web-research-brief',
    title: 'Market & Competitive Intelligence Scanner',
    category: 'analysis',
    description: 'Perform grounded market research and competitive landscape analysis with verified sources.',
    prompt: `Conduct a market and competitive intelligence analysis on the following industry or product domain:
1. Current Market Landscape & Top 3 Dominant Players
2. Emerging Trends, Technological Shifts, & Disruptions
3. Feature Comparison Matrix & Strategic Gaps
4. Verified Sources & Citations

Domain / Topic:
`,
    enableSearch: true,
  },
];

const LOCAL_STORAGE_CUSTOM_PROMPTS_KEY = 'myaimodel_custom_prompt_templates';

interface PromptLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (promptText: string, thinking?: boolean, search?: boolean) => void;
}

export const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectPrompt,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customTemplates, setCustomTemplates] = useState<PromptTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CUSTOM_PROMPTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const allTemplates = useMemo(() => {
    return [...customTemplates, ...DEFAULT_TEMPLATES];
  }, [customTemplates]);

  const categories = [
    { id: 'all', label: 'All Templates' },
    { id: 'code', label: 'Coding & Refactoring' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'analysis', label: 'Data & Analytics' },
    { id: 'reasoning', label: 'Reasoning & Logic' },
    { id: 'writing', label: 'Writing & Strategy' },
    { id: 'custom', label: `Custom (${customTemplates.length})` },
  ];

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      const matchCat =
        selectedCategory === 'all' || t.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.prompt.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [allTemplates, selectedCategory, searchQuery]);

  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() || !customPrompt.trim()) return;

    const newTemplate: PromptTemplate = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim(),
      category: 'custom',
      description: customDescription.trim() || 'Custom user prompt template',
      prompt: customPrompt.trim(),
      enableThinking: true,
    };

    const updated = [newTemplate, ...customTemplates];
    setCustomTemplates(updated);
    localStorage.setItem(LOCAL_STORAGE_CUSTOM_PROMPTS_KEY, JSON.stringify(updated));

    setCustomTitle('');
    setCustomPrompt('');
    setCustomDescription('');
    setIsCreatingCustom(false);
    setSelectedCategory('custom');
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem(LOCAL_STORAGE_CUSTOM_PROMPTS_KEY, JSON.stringify(updated));
  };

  if (!isOpen) return null;

  return (
    <div
      id="prompt-library-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="prompt-library-modal"
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-gray-800 bg-[#171717] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4 bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Prompt Templates & Snippet Library
              </h3>
              <p className="text-[11px] text-gray-400">
                Instantly apply expert-crafted prompts to solve complex tasks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreatingCustom(!isCreatingCustom)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Snippet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Create Custom Template Drawer */}
        {isCreatingCustom && (
          <form
            onSubmit={handleSaveCustom}
            className="border-b border-gray-800 bg-[#141419] p-4 space-y-3 animate-in slide-in-from-top duration-150"
          >
            <div className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Create Custom Prompt Template
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. React Component Architect"
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="e.g. Generates production React TypeScript components"
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Prompt Content</label>
              <textarea
                required
                rows={3}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Type your system prompt or task prompt template here..."
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingCustom(false)}
                className="rounded-xl px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-xs"
              >
                Save Template
              </button>
            </div>
          </form>
        )}

        {/* Filter bar & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3 border-b border-gray-800 p-3 sm:px-5 bg-[#171717]">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates & keywords..."
              className="w-full rounded-xl border border-gray-800 bg-[#121212] pl-8.5 pr-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-800/60 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredTemplates.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-gray-500">
              No matching prompt templates found.
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const isCustom = template.category === 'custom';
              return (
                <div
                  key={template.id}
                  onClick={() => {
                    onSelectPrompt(
                      template.prompt,
                      template.enableThinking,
                      template.enableSearch
                    );
                    onClose();
                  }}
                  className="group relative flex flex-col justify-between rounded-xl border border-gray-800 bg-[#141414] p-4 text-left hover:border-indigo-500/50 hover:bg-[#18181c] cursor-pointer transition-all shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-100 group-hover:text-indigo-300 transition-colors">
                        {template.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {template.enableThinking && (
                          <span className="rounded bg-purple-950/80 px-1.5 py-0.5 text-[9px] font-mono text-purple-300 border border-purple-800/60">
                            Reasoning
                          </span>
                        )}
                        {template.enableSearch && (
                          <span className="rounded bg-emerald-950/80 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300 border border-emerald-800/60">
                            Search
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>

                    <div className="rounded-lg bg-gray-900/90 p-2 text-[10px] font-mono text-gray-300 line-clamp-2 border border-gray-800/70">
                      {template.prompt}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-gray-800/60 text-xs">
                    <span className="text-[10px] font-medium text-indigo-400 group-hover:underline flex items-center gap-1">
                      <span>Use in Chat</span>
                      <CornerDownLeft className="h-3 w-3" />
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleCopy(template.id, template.prompt, e)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                        title="Copy prompt text"
                      >
                        {copiedId === template.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustom(template.id, e)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-800/80 text-rose-400 hover:text-rose-300 hover:bg-rose-950 transition-colors"
                          title="Delete custom template"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#141414] px-5 py-2.5 flex items-center justify-between text-xs text-gray-500">
          <span>Click any card to load it directly into your chat prompt</span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
