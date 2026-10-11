import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  MessageSquare,
  Sparkles,
  Compass,
  FolderPlus,
  Moon,
  Sun,
  Settings,
  BrainCircuit,
  Globe,
  Download,
  Trash2,
  BookOpen,
  Keyboard,
  ArrowRight,
  Plus,
  CornerDownLeft,
  History,
  X,
} from 'lucide-react';
import { Conversation, ModelInfo, Project } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  availableModels: ModelInfo[];
  projects: Project[];
  currentModel: string;
  enableThinking: boolean;
  enableSearch: boolean;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onSelectModel: (modelId: string) => void;
  onToggleThinking: () => void;
  onToggleSearch: () => void;
  onOpenResearch: () => void;
  onOpenProjects: () => void;
  onOpenPromptLibrary: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onToggleTheme: () => void;
  onExportChat: () => void;
  onClearChat: () => void;
}

const RECENT_COMMANDS_KEY = 'myaimodel_recent_commands';

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  conversations,
  availableModels,
  projects,
  currentModel,
  enableThinking,
  enableSearch,
  onSelectConversation,
  onNewChat,
  onSelectModel,
  onToggleThinking,
  onToggleSearch,
  onOpenResearch,
  onOpenProjects,
  onOpenPromptLibrary,
  onOpenSettings,
  onOpenShortcuts,
  onToggleTheme,
  onExportChat,
  onClearChat,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_COMMANDS_KEY);
      return saved ? JSON.parse(saved) : ['new-chat', 'deep-research', 'prompt-library'];
    } catch {
      return ['new-chat', 'deep-research', 'prompt-library'];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const recordRecentCommand = (id: string) => {
    setRecentIds((prev) => {
      const updated = [id, ...prev.filter((item) => item !== id)].slice(0, 6);
      try {
        localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearRecentHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentIds([]);
    try {
      localStorage.removeItem(RECENT_COMMANDS_KEY);
    } catch {}
  };

  // Build items based on query
  const items = useMemo(() => {
    const q = query.toLowerCase().trim();

    const quickActions = [
      {
        id: 'new-chat',
        title: 'New Conversation',
        subtitle: 'Start a clean chat thread',
        category: 'Actions',
        icon: Plus,
        action: () => {
          recordRecentCommand('new-chat');
          onNewChat();
          onClose();
        },
      },
      {
        id: 'deep-research',
        title: 'Deep Research Agent',
        subtitle: 'Execute multi-angle investigation & report synthesis',
        category: 'Actions',
        icon: Compass,
        action: () => {
          recordRecentCommand('deep-research');
          onOpenResearch();
          onClose();
        },
      },
      {
        id: 'prompt-library',
        title: 'Prompt Templates & Snippets',
        subtitle: 'Browse curated prompts for coding, analysis, and writing',
        category: 'Actions',
        icon: BookOpen,
        action: () => {
          recordRecentCommand('prompt-library');
          onOpenPromptLibrary();
          onClose();
        },
      },
      {
        id: 'toggle-thinking',
        title: enableThinking ? 'Disable Reasoning / Thinking' : 'Enable Deep Reasoning / Thinking',
        subtitle: 'Toggle step-by-step chain of thought reasoning',
        category: 'Toggles',
        icon: BrainCircuit,
        action: () => {
          recordRecentCommand('toggle-thinking');
          onToggleThinking();
          onClose();
        },
      },
      {
        id: 'toggle-search',
        title: enableSearch ? 'Disable Google Web Grounding' : 'Enable Google Web Grounding',
        subtitle: 'Ground responses with live Google web search results',
        category: 'Toggles',
        icon: Globe,
        action: () => {
          recordRecentCommand('toggle-search');
          onToggleSearch();
          onClose();
        },
      },
      {
        id: 'toggle-theme',
        title: 'Toggle Theme (Light / Dark)',
        subtitle: 'Switch between light and dark workspace theme',
        category: 'Workspace',
        icon: Sun,
        action: () => {
          recordRecentCommand('toggle-theme');
          onToggleTheme();
          onClose();
        },
      },
      {
        id: 'projects-modal',
        title: 'Manage Projects & Knowledge Base',
        subtitle: 'Organize chats into dedicated project workspaces',
        category: 'Workspace',
        icon: FolderPlus,
        action: () => {
          recordRecentCommand('projects-modal');
          onOpenProjects();
          onClose();
        },
      },
      {
        id: 'settings-modal',
        title: 'Open Settings & Preferences',
        subtitle: 'Manage custom system instructions, persona, and voice',
        category: 'Workspace',
        icon: Settings,
        action: () => {
          recordRecentCommand('settings-modal');
          onOpenSettings();
          onClose();
        },
      },
      {
        id: 'shortcuts-modal',
        title: 'Keyboard Shortcuts Cheatsheet',
        subtitle: 'View all keyboard navigation shortcuts',
        category: 'Help',
        icon: Keyboard,
        action: () => {
          recordRecentCommand('shortcuts-modal');
          onOpenShortcuts();
          onClose();
        },
      },
      {
        id: 'export-chat',
        title: 'Export Current Transcript',
        subtitle: 'Download current conversation as Markdown file',
        category: 'Chat',
        icon: Download,
        action: () => {
          recordRecentCommand('export-chat');
          onExportChat();
          onClose();
        },
      },
      {
        id: 'clear-chat',
        title: 'Clear Messages in Current Chat',
        subtitle: 'Reset conversation messages while keeping thread',
        category: 'Chat',
        icon: Trash2,
        action: () => {
          recordRecentCommand('clear-chat');
          onClearChat();
          onClose();
        },
      },
    ];

    // AI Model choices
    const modelActions = availableModels.map((m) => ({
      id: `model-${m.id}`,
      title: `Switch Model: ${m.name}`,
      subtitle: m.tagline,
      category: 'Models',
      icon: Sparkles,
      action: () => {
        recordRecentCommand(`model-${m.id}`);
        onSelectModel(m.id);
        onClose();
      },
      isCurrent: currentModel === m.id,
    }));

    // Chat search results
    const chatResults = conversations
      .filter((c) => {
        if (!q) return false;
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchContent = c.messages.some((m) =>
          m.content.toLowerCase().includes(q)
        );
        return matchTitle || matchContent;
      })
      .slice(0, 8)
      .map((c) => ({
        id: `chat-${c.id}`,
        title: c.title,
        subtitle: `${c.messages.length} messages • ${new Date(
          c.updatedAt || c.createdAt
        ).toLocaleDateString()}`,
        category: 'Conversations',
        icon: MessageSquare,
        action: () => {
          recordRecentCommand(`chat-${c.id}`);
          onSelectConversation(c.id);
          onClose();
        },
      }));

    const all = [...quickActions, ...modelActions, ...chatResults];

    if (!q) {
      return all;
    }

    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [
    query,
    conversations,
    availableModels,
    currentModel,
    enableThinking,
    enableSearch,
    onNewChat,
    onOpenResearch,
    onOpenPromptLibrary,
    onToggleThinking,
    onToggleSearch,
    onToggleTheme,
    onOpenProjects,
    onOpenSettings,
    onOpenShortcuts,
    onExportChat,
    onClearChat,
    onSelectModel,
    onSelectConversation,
    onClose,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (items.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % (items.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  // Find recent item objects
  const recentItems = recentIds
    .map((id) => items.find((it) => it.id === id))
    .filter(Boolean) as typeof items;

  return (
    <div
      id="command-palette-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 sm:pt-20 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="command-palette-modal"
        className="w-full max-w-xl flex flex-col rounded-2xl border border-gray-800 bg-[#171717] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3.5 bg-[#141414]">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            id="command-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, model name, or search your chats..."
            className="w-full bg-transparent text-sm text-gray-100 placeholder:text-gray-500 focus:outline-hidden"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-gray-800 px-2 py-0.5 text-[11px] font-mono text-gray-400 border border-gray-700">
            ESC
          </kbd>
        </div>

        {/* Recent Quick Actions Chips (when query is empty) */}
        {!query && recentItems.length > 0 && (
          <div className="border-b border-gray-800 bg-[#141414]/90 px-3 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 overflow-x-auto">
              <History className="h-3 w-3 text-indigo-400 shrink-0" />
              <span className="font-medium shrink-0">Recent:</span>
              <div className="flex items-center gap-1">
                {recentItems.slice(0, 4).map((it) => (
                  <button
                    key={`rec-${it.id}`}
                    type="button"
                    onClick={it.action}
                    className="rounded bg-[#202020] px-2 py-0.5 text-[11px] text-gray-300 hover:bg-indigo-600 hover:text-white border border-gray-700/60 transition-colors shrink-0"
                  >
                    {it.title}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearRecentHistory}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors shrink-0 ml-2"
              title="Clear recent history"
            >
              Clear
            </button>
          </div>
        )}

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              No matching commands or conversations found.
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600/15 border border-indigo-500/30 text-white'
                      : 'hover:bg-gray-800/60 text-gray-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-xs sm:text-sm font-medium text-gray-100 truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {(item as any).isCurrent && (
                          <span className="rounded bg-indigo-950 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-400 border border-indigo-800">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                      {item.category}
                    </span>
                    {isSelected && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-indigo-400" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="flex items-center justify-between border-t border-gray-800/80 bg-[#141414] px-4 py-2 text-[11px] text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 border border-gray-700">↑</kbd>
              <kbd className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 border border-gray-700">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 border border-gray-700">↵</kbd>
              to select
            </span>
          </div>
          <span className="text-gray-400 font-medium">
            Press <kbd className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono border border-gray-700">⌘K</kbd> anytime
          </span>
        </div>
      </div>
    </div>
  );
};
