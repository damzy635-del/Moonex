import React from 'react';
import {
  Code,
  BrainCircuit,
  PenTool,
  Search,
  Sparkles,
  ArrowRight,
  Database,
  ShieldCheck,
  Cpu,
  BarChart3,
} from 'lucide-react';
import { UserPreferences } from '../types';

interface WelcomeViewProps {
  preferences?: UserPreferences;
  userName?: string;
  onSelectPrompt: (prompt: string, model?: string, enableThinking?: boolean, enableWebSearch?: boolean) => void;
}

const STARTER_PROMPTS = [
  {
    category: 'Coding & Full-Stack',
    icon: Code,
    color: 'text-indigo-400 bg-indigo-950/60 border border-indigo-900/50',
    title: 'Interactive Dashboard Component',
    description: 'Create a responsive React TypeScript chart dashboard with filter controls',
    prompt: 'Write a complete, responsive TypeScript React component for an interactive analytics dashboard featuring KPI metric summary cards, a timeline chart, and filtering controls.',
    enableThinking: false,
    enableWebSearch: false,
  },
  {
    category: 'Deep Reasoning',
    icon: BrainCircuit,
    color: 'text-purple-400 bg-purple-950/60 border border-purple-900/50',
    title: 'Algorithm Proof & Analysis',
    description: 'Rigorous mathematical proof & time complexity breakdown',
    prompt: 'Provide a rigorous step-by-step mathematical proof and algorithmic analysis of Dijkstra vs Floyd-Warshall for shortest path search with time complexity comparison.',
    enableThinking: true,
    enableWebSearch: false,
  },
  {
    category: 'Live Web Grounding',
    icon: Search,
    color: 'text-emerald-400 bg-emerald-950/60 border border-emerald-900/50',
    title: 'Market Research & Tech Breakthroughs',
    description: 'Current real-world updates grounded by Google Web Search',
    prompt: 'What are the latest significant breakthroughs in humanoid robotics and embodied AI models in 2025/2026?',
    enableThinking: false,
    enableWebSearch: true,
  },
  {
    category: 'System Architecture',
    icon: Database,
    color: 'text-amber-400 bg-amber-950/60 border border-amber-900/50',
    title: 'Distributed System Design',
    description: 'Scalable cloud infrastructure design with fault tolerance',
    prompt: 'Design an ultra-high-throughput event ingestion architecture handling 1M events/sec with Apache Kafka, PostgreSQL partitioning, and Redis caching tiers.',
    enableThinking: true,
    enableWebSearch: false,
  },
];

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  onSelectPrompt,
  userName = 'there',
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-4xl mx-auto w-full text-center">
      {/* Brand Icon & Welcome Tag */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-600/20 ring-4 ring-indigo-500/10">
          <Sparkles className="h-7 w-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          How can I help you today?
        </h1>
        <p className="text-sm text-gray-400 max-w-md">
          Explore reasoning models, full-stack coding canvases, deep research workflows, and web-grounded analysis.
        </p>
      </div>

      {/* Starter Prompts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
        {STARTER_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() =>
                onSelectPrompt(
                  item.prompt,
                  undefined,
                  item.enableThinking,
                  item.enableWebSearch
                )
              }
              className="group relative flex flex-col justify-between p-4 rounded-xl border border-gray-800 bg-[#161616] hover:bg-[#1c1c1c] hover:border-gray-700 transition-all text-left shadow-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${item.color}`}>
                    <Icon className="h-3 w-3" />
                    <span>{item.category}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="font-medium text-xs sm:text-sm text-gray-100 group-hover:text-white">
                  {item.title}
                </div>
                <div className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
