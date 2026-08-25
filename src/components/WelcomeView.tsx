import React from 'react';
import {
  Code,
  BrainCircuit,
  PenTool,
  Search,
  BookOpen,
  FileSpreadsheet,
  Cpu,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface WelcomeViewProps {
  onSelectPrompt: (prompt: string, enableThinking?: boolean, enableWebSearch?: boolean) => void;
  userName: string;
}

const STARTER_PROMPTS = [
  {
    category: 'Coding & Architecture',
    icon: Code,
    color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400',
    title: 'Full-Stack React & Node App',
    prompt: 'Write a complete, responsive TypeScript React component for an interactive real-time data table with sorting, search filtering, and CSV export.',
    enableThinking: false,
    enableWebSearch: false,
  },
  {
    category: 'Deep Reasoning',
    icon: BrainCircuit,
    color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400',
    title: 'Algorithm & Math Logic',
    prompt: 'Provide a rigorous step-by-step mathematical proof and algorithmic analysis of the Floyd-Warshall shortest path algorithm with time complexity breakdowns.',
    enableThinking: true,
    enableWebSearch: false,
  },
  {
    category: 'Real-time Web Search',
    icon: Search,
    color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400',
    title: 'Market Trends & Live Facts',
    prompt: 'What are the most significant recent breakthroughs in solid-state battery technology and commercialization timelines?',
    enableThinking: false,
    enableWebSearch: true,
  },
  {
    category: 'Writing & Synthesis',
    icon: PenTool,
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400',
    title: 'Executive Briefing',
    prompt: 'Draft an executive briefing and strategic risk analysis on migrating legacy enterprise architectures to event-driven serverless systems.',
    enableThinking: false,
    enableWebSearch: false,
  },
];

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  onSelectPrompt,
  userName,
}) => {
  return (
    <div
      id="welcome-view"
      className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-3xl mx-auto w-full text-center"
    >
      {/* Brand Hero Symbol */}
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg mb-4 ring-4 ring-gray-800/80">
        <Sparkles className="h-6 w-6 text-white" />
      </div>

      {/* Greeting Title */}
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
        What would you like to build or explore, {userName || 'friend'}?
      </h1>
      <p className="mt-1.5 text-xs sm:text-sm text-gray-400 max-w-lg">
        My AI Model assists with coding, multimodal reasoning, live web research, document analysis, and creative synthesis.
      </p>

      {/* Prompt Starter Cards Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
        {STARTER_PROMPTS.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={() =>
                onSelectPrompt(item.prompt, item.enableThinking, item.enableWebSearch)
              }
              className="group flex flex-col justify-between rounded-xl border border-gray-800 bg-[#171717] p-3.5 hover:border-gray-700 hover:bg-[#1c1c1c] hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${item.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    {item.category}
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </div>

              <div className="font-medium text-xs sm:text-sm text-gray-200 mb-1">
                {item.title}
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                {item.prompt}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
