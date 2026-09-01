import React, { useState } from 'react';
import {
  Menu,
  Sparkles,
  Search,
  BrainCircuit,
  Globe,
  SlidersHorizontal,
  Download,
  Trash2,
  Folder,
  Layers,
  ChevronDown,
  Compass,
  LogIn,
  LogOut,
  User as UserIcon,
  Cloud,
  CheckCircle2,
  BookOpen,
  Keyboard,
  Command,
} from 'lucide-react';
import { Conversation, Project, ModelInfo, UserPreferences } from '../types';
import { useAuth } from '../context/AuthContext';
import { getMoonexDisplayName, getMoonexModelInfo } from '../utils/modelPresentation';

interface HeaderProps {
  currentConversation: Conversation;
  projects: Project[];
  availableModels: ModelInfo[];
  preferences: UserPreferences;
  isSidebarOpen: boolean;
  isArtifactPanelOpen: boolean;
  onToggleSidebar: () => void;
  onToggleArtifactPanel: () => void;
  onSelectModel: (modelId: string) => void;
  onToggleThinking: () => void;
  onToggleSearch: () => void;
  onOpenSettings: () => void;
  onOpenResearch: () => void;
  onClearConversation: () => void;
  onExportConversation: () => void;
  onOpenProject: (projectId: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenCommandPalette?: () => void;
  onOpenPromptLibrary?: () => void;
  onOpenShortcuts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentConversation,
  projects,
  availableModels,
  preferences,
  isSidebarOpen,
  isArtifactPanelOpen,
  onToggleSidebar,
  onToggleArtifactPanel,
  onSelectModel,
  onToggleThinking,
  onToggleSearch,
  onOpenSettings,
  onOpenResearch,
  onClearConversation,
  onExportConversation,
  onOpenProject,
  onOpenAuth,
  onOpenCommandPalette,
  onOpenPromptLibrary,
  onOpenShortcuts,
}) => {
  const { user, isAnonymous, logout } = useAuth();
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const activeProject = currentConversation.projectId
    ? projects.find((p) => p.id === currentConversation.projectId)
    : null;

  const currentModelInfo = getMoonexModelInfo(currentConversation.model, availableModels);

  const isThinkingActive = currentConversation.thinkingLevel !== 'none';

  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-gray-800 bg-[#0d0d0d]/95 px-3 sm:px-4 backdrop-blur-md text-gray-200"
    >
      {/* Left section: Sidebar toggle & Title / Project badge */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
        <button
          type="button"
          id="btn-toggle-sidebar"
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800/80 hover:text-white transition-colors"
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar (⌘B)'}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Model Selector Pill */}
        <div className="relative">
          <button
            type="button"
            id="btn-model-selector"
            onClick={() => setShowModelMenu(!showModelMenu)}
            className="flex items-center gap-2 rounded-lg border border-gray-800 bg-[#171717] px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-200 hover:bg-gray-800 transition-all shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span className="truncate max-w-[130px] sm:max-w-[190px]">
              {getMoonexDisplayName(currentConversation.model)}
            </span>
            {currentModelInfo.badge && (
              <span className="hidden sm:inline-block rounded-md bg-indigo-950/80 border border-indigo-800 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                {currentModelInfo.badge}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>

          {/* Model Selection Dropdown */}
          {showModelMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowModelMenu(false)}
              />
              <div
                id="model-dropdown-menu"
                className="absolute left-0 mt-2 w-72 sm:w-80 rounded-xl border border-gray-800 bg-[#171717] p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Select Moonex Model
                </div>
                <div className="space-y-1">
                  {availableModels.map((m) => {
                    const isSelected = currentConversation.model === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onSelectModel(m.id);
                          setShowModelMenu(false);
                        }}
                        className={`w-full text-left rounded-lg p-2.5 transition-colors flex flex-col gap-0.5 ${
                          isSelected
                            ? 'bg-indigo-950/60 border border-indigo-800 text-white'
                            : 'hover:bg-gray-800/70 text-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-semibold text-gray-100">
                            {m.name}
                          </span>
                          {m.badge && (
                            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-300">
                              {m.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-snug">
                          {m.tagline}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Command Palette Quick Search Button */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden lg:flex items-center gap-2 rounded-lg border border-gray-800/80 bg-[#141414] px-2.5 py-1 text-xs text-gray-400 hover:border-gray-700 hover:text-gray-200 transition-colors"
            title="Search conversations, models, actions (⌘K)"
          >
            <Search className="h-3.5 w-3.5 text-gray-500" />
            <span>Quick search...</span>
            <kbd className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono text-gray-400">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Project Link Badge if in project */}
        {activeProject && (
          <button
            type="button"
            onClick={() => onOpenProject(activeProject.id)}
            className="hidden md:flex items-center gap-1.5 rounded-md bg-amber-950/40 border border-amber-900/50 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-950/70 transition-colors"
          >
            <Folder className="h-3 w-3 text-amber-400" />
            <span className="truncate max-w-[120px]">{activeProject.name}</span>
          </button>
        )}
      </div>

      {/* Right section: Quick feature toggles, auth & actions */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Thinking Mode Toggle Pill */}
        <button
          type="button"
          id="btn-toggle-thinking"
          onClick={onToggleThinking}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
            isThinkingActive
              ? 'bg-purple-950/70 text-purple-300 border border-purple-800 shadow-xs'
              : 'text-gray-400 hover:bg-gray-800/80 hover:text-gray-200'
          }`}
          title="Deep Thinking reasoning mode"
        >
          <BrainCircuit className="h-3.5 w-3.5" />
          <span className="hidden md:inline">
            {isThinkingActive ? `Thinking · ${getMoonexDisplayName(currentConversation.model)}` : 'Thinking'}
          </span>
        </button>

        {/* Web Search Toggle Pill */}
        <button
          type="button"
          id="btn-toggle-web-search"
          onClick={onToggleSearch}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
            currentConversation.enableWebSearch
              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800 shadow-xs'
              : 'text-gray-400 hover:bg-gray-800/80 hover:text-gray-200'
          }`}
          title="Ground responses with Google Web Search"
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search</span>
        </button>

        {/* Deep Research Button */}
        <button
          type="button"
          id="btn-open-deep-research"
          onClick={onOpenResearch}
          className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-400 hover:bg-indigo-950/50 transition-colors"
          title="Launch Multi-Stage Deep Research workflow"
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Research</span>
        </button>

        {/* Prompt Library */}
        {onOpenPromptLibrary && (
          <button
            type="button"
            id="btn-open-prompts"
            onClick={onOpenPromptLibrary}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800/80 hover:text-white transition-colors"
            title="Prompt Library & Snippets (⌘P)"
          >
            <BookOpen className="h-4 w-4" />
          </button>
        )}

        {/* Canvas / Artifacts Panel Toggle */}
        <button
          type="button"
          id="btn-toggle-artifacts-panel"
          onClick={onToggleArtifactPanel}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            isArtifactPanelOpen
              ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800'
              : 'text-gray-400 hover:bg-gray-800/80 hover:text-white'
          }`}
          title="Toggle Artifacts Canvas panel"
        >
          <Layers className="h-4 w-4" />
        </button>

        {/* Export Chat */}
        <button
          type="button"
          id="btn-export-chat"
          onClick={onExportConversation}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800/80 hover:text-white transition-colors"
          title="Export conversation as Markdown"
        >
          <Download className="h-4 w-4" />
        </button>

        {/* Clear / New Chat */}
        <button
          type="button"
          id="btn-clear-chat"
          onClick={onClearConversation}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-950/60 hover:text-rose-400 transition-colors"
          title="Clear current messages"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Settings button */}
        <button
          type="button"
          id="btn-open-settings"
          onClick={onOpenSettings}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800/80 hover:text-white transition-colors"
          title="Settings & Preferences (,)"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        {/* User Account / Sign In */}
        {user && !isAnonymous ? (
          <div className="relative ml-1">
            <button
              type="button"
              id="btn-user-header-menu"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-950/40 p-1 hover:border-indigo-400 transition-all"
              title={user.email || user.displayName || 'User profile'}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div
                  id="user-dropdown-menu"
                  className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-800 bg-[#171717] p-2.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 text-xs"
                >
                  <div className="border-b border-gray-800 pb-2 mb-2 px-1">
                    <div className="font-semibold text-white truncate">
                      {user.displayName || 'My Account'}
                    </div>
                    <div className="text-gray-400 text-[11px] truncate">
                      {user.email}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400">
                      <Cloud className="h-3 w-3" />
                      <span>Cloud Sync Active (Firestore)</span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    {onOpenShortcuts && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenShortcuts();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                      >
                        <Keyboard className="h-3.5 w-3.5" />
                        <span>Keyboard Shortcuts</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenSettings();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                    >
                      <UserIcon className="h-3.5 w-3.5" />
                      <span>Account Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setShowUserMenu(false);
                        await logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-400 hover:bg-rose-950/40 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            id="btn-header-signin"
            onClick={() => onOpenAuth('signin')}
            className="ml-1 flex items-center gap-1.5 rounded-lg border border-indigo-600/60 bg-indigo-600/20 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all shadow-xs"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
