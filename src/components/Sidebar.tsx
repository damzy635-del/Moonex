import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Folder,
  FolderPlus,
  Pin,
  Trash2,
  Edit2,
  Compass,
  Settings,
  Sun,
  Moon,
  Check,
  X,
  ChevronRight,
  Sparkles,
  LogIn,
  Cloud,
  BookOpen,
  Keyboard,
} from 'lucide-react';
import { Conversation, Project, UserPreferences } from '../types';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  conversations: Conversation[];
  activeConversationId: string;
  projects: Project[];
  preferences: UserPreferences;
  onSelectConversation: (id: string) => void;
  onNewConversation: (projectId?: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onTogglePinConversation: (id: string) => void;
  onOpenProjectsModal: () => void;
  onSelectProject: (projectId: string) => void;
  onOpenSettings: () => void;
  onOpenResearch: () => void;
  onToggleTheme: () => void;
  onCloseMobileSidebar: () => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
  onOpenPromptLibrary?: () => void;
  onOpenShortcuts?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  conversations,
  activeConversationId,
  projects,
  preferences,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePinConversation,
  onOpenProjectsModal,
  onSelectProject,
  onOpenSettings,
  onOpenResearch,
  onToggleTheme,
  onCloseMobileSidebar,
  onOpenAuth,
  onOpenPromptLibrary,
  onOpenShortcuts,
  onOpenCommandPalette,
}) => {
  const { user, isAnonymous } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showProjectsList, setShowProjectsList] = useState(true);

  // Filter conversations by search term
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const matchTitle = c.title.toLowerCase().includes(query);
      const matchContent = c.messages.some((m) =>
        m.content.toLowerCase().includes(query)
      );
      return matchTitle || matchContent;
    });
  }, [conversations, searchQuery]);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const pinned: Conversation[] = [];
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const previous7Days: Conversation[] = [];
    const older: Conversation[] = [];

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart - oneDay;
    const sevenDaysAgo = todayStart - 7 * oneDay;

    filteredConversations.forEach((conv) => {
      if (conv.isPinned) {
        pinned.push(conv);
        return;
      }
      const time = conv.updatedAt || conv.createdAt;
      if (time >= todayStart) {
        today.push(conv);
      } else if (time >= yesterdayStart) {
        yesterday.push(conv);
      } else if (time >= sevenDaysAgo) {
        previous7Days.push(conv);
      } else {
        older.push(conv);
      }
    });

    return { pinned, today, yesterday, previous7Days, older };
  }, [filteredConversations]);

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobileSidebar}
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        id="app-sidebar"
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col w-72 bg-[#171717] border-r border-gray-800 backdrop-blur-md transition-transform duration-200 ease-in-out text-gray-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full md:hidden'
        }`}
      >
        {/* Brand & New Chat Header */}
        <div className="p-3 pb-2 flex flex-col gap-2 border-b border-gray-800">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight text-white">
                My AI Model
              </span>
            </div>
            <span className="text-[10px] font-mono font-medium text-gray-300 bg-[#262626] px-1.5 py-0.5 rounded border border-gray-700/50">
              v3.7
            </span>
          </div>

          {/* New Chat Primary Action Button */}
          <button
            type="button"
            id="btn-new-chat"
            onClick={() => {
              onNewConversation();
              onCloseMobileSidebar();
            }}
            className="flex w-full items-center justify-between rounded-xl bg-gray-100 px-3.5 py-2 text-xs font-semibold text-gray-900 hover:bg-white shadow-sm transition-all"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>New conversation</span>
            </span>
            <kbd className="hidden sm:inline-block rounded bg-gray-200 px-1 text-[10px] text-gray-700">
              ⌘K
            </kbd>
          </button>

          {/* Search Bar / Command Palette launcher */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-[#1f1f1f] pl-8 pr-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Scrollable Middle Content: Projects & History */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 text-xs">
          {/* Quick Tools Bar */}
          <div className="space-y-1 px-1">
            <button
              type="button"
              onClick={() => {
                onOpenResearch();
                onCloseMobileSidebar();
              }}
              className="flex w-full items-center gap-2 rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-2.5 py-1.5 text-indigo-300 hover:bg-indigo-950/50 transition-colors font-medium"
            >
              <Compass className="h-3.5 w-3.5 text-indigo-400" />
              <span>Deep Research Agent</span>
            </button>

            {onOpenPromptLibrary && (
              <button
                type="button"
                onClick={() => {
                  onOpenPromptLibrary();
                  onCloseMobileSidebar();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-gray-300 hover:bg-gray-800/70 hover:text-white transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                <span>Prompt Library</span>
              </button>
            )}
          </div>

          {/* Projects Section */}
          <div>
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <button
                type="button"
                onClick={() => setShowProjectsList(!showProjectsList)}
                className="flex items-center gap-1 hover:text-gray-200"
              >
                <span>Projects</span>
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${
                    showProjectsList ? 'rotate-90' : ''
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={onOpenProjectsModal}
                className="hover:text-gray-200 p-0.5 rounded"
                title="Manage projects"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>

            {showProjectsList && (
              <div className="mt-1 space-y-0.5">
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      onSelectProject(proj.id);
                      onCloseMobileSidebar();
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-gray-300 hover:bg-gray-800/70 hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{proj.name}</span>
                    </span>
                    <span className="rounded bg-gray-800 px-1.5 py-0.2 text-[10px] text-gray-400">
                      {proj.knowledgeBase.length} docs
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History Groups */}
          <div className="space-y-3">
            {/* Pinned Group */}
            {groupedConversations.pinned.length > 0 && (
              <ConversationGroup
                title="Pinned"
                conversations={groupedConversations.pinned}
                activeId={activeConversationId}
                editingId={editingId}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                onSelect={(id) => {
                  onSelectConversation(id);
                  onCloseMobileSidebar();
                }}
                onStartRename={handleStartRename}
                onSaveRename={handleSaveRename}
                onDelete={onDeleteConversation}
                onTogglePin={onTogglePinConversation}
              />
            )}

            {/* Today Group */}
            {groupedConversations.today.length > 0 && (
              <ConversationGroup
                title="Today"
                conversations={groupedConversations.today}
                activeId={activeConversationId}
                editingId={editingId}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                onSelect={(id) => {
                  onSelectConversation(id);
                  onCloseMobileSidebar();
                }}
                onStartRename={handleStartRename}
                onSaveRename={handleSaveRename}
                onDelete={onDeleteConversation}
                onTogglePin={onTogglePinConversation}
              />
            )}

            {/* Yesterday Group */}
            {groupedConversations.yesterday.length > 0 && (
              <ConversationGroup
                title="Yesterday"
                conversations={groupedConversations.yesterday}
                activeId={activeConversationId}
                editingId={editingId}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                onSelect={(id) => {
                  onSelectConversation(id);
                  onCloseMobileSidebar();
                }}
                onStartRename={handleStartRename}
                onSaveRename={handleSaveRename}
                onDelete={onDeleteConversation}
                onTogglePin={onTogglePinConversation}
              />
            )}

            {/* Previous 7 Days Group */}
            {groupedConversations.previous7Days.length > 0 && (
              <ConversationGroup
                title="Previous 7 Days"
                conversations={groupedConversations.previous7Days}
                activeId={activeConversationId}
                editingId={editingId}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                onSelect={(id) => {
                  onSelectConversation(id);
                  onCloseMobileSidebar();
                }}
                onStartRename={handleStartRename}
                onSaveRename={handleSaveRename}
                onDelete={onDeleteConversation}
                onTogglePin={onTogglePinConversation}
              />
            )}

            {/* Older Group */}
            {groupedConversations.older.length > 0 && (
              <ConversationGroup
                title="Older"
                conversations={groupedConversations.older}
                activeId={activeConversationId}
                editingId={editingId}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                onSelect={(id) => {
                  onSelectConversation(id);
                  onCloseMobileSidebar();
                }}
                onStartRename={handleStartRename}
                onSaveRename={handleSaveRename}
                onDelete={onDeleteConversation}
                onTogglePin={onTogglePinConversation}
              />
            )}

            {filteredConversations.length === 0 && (
              <div className="py-8 text-center text-gray-500 text-xs">
                No conversations found.
              </div>
            )}
          </div>
        </div>

        {/* Footer: User profile or Sign in, theme toggle, and settings */}
        <div className="p-2 border-t border-gray-800 flex flex-col gap-1 text-xs">
          {user && !isAnonymous ? (
            <button
              type="button"
              id="btn-user-profile-settings"
              onClick={() => {
                onOpenSettings();
                onCloseMobileSidebar();
              }}
              className="flex items-center gap-2 rounded-lg p-1.5 text-gray-200 hover:bg-gray-800/80 transition-colors w-full text-left"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="h-6 w-6 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white font-medium text-[11px] shrink-0">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-gray-200 leading-tight">
                  {user.displayName || user.email?.split('@')[0] || 'Account'}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <Cloud className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">Cloud Synced</span>
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              id="btn-sidebar-signin"
              onClick={() => {
                onOpenAuth('signin');
                onCloseMobileSidebar();
              }}
              className="flex items-center justify-between rounded-lg bg-indigo-950/40 border border-indigo-800/50 p-2 text-indigo-300 hover:bg-indigo-900/40 transition-colors w-full"
            >
              <div className="flex items-center gap-2">
                <LogIn className="h-4 w-4 text-indigo-400" />
                <span className="font-semibold text-xs text-white">Sign In / Sign Up</span>
              </div>
              <span className="text-[10px] text-indigo-300/80">Sync cloud</span>
            </button>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  onCloseMobileSidebar();
                }}
                className="flex items-center gap-1.5 p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800/80 transition-colors text-xs"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Settings</span>
              </button>

              {onOpenShortcuts && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenShortcuts();
                    onCloseMobileSidebar();
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800/80 transition-colors"
                  title="Keyboard Shortcuts"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              id="btn-toggle-theme"
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800/80 transition-colors"
              title="Toggle Theme"
            >
              {preferences.theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

interface ConversationGroupProps {
  title: string;
  conversations: Conversation[];
  activeId: string;
  editingId: string | null;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSelect: (id: string) => void;
  onStartRename: (conv: Conversation, e: React.MouseEvent) => void;
  onSaveRename: (id: string, e: React.MouseEvent | React.FormEvent) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

const ConversationGroup: React.FC<ConversationGroupProps> = ({
  title,
  conversations,
  activeId,
  editingId,
  editTitle,
  setEditTitle,
  onSelect,
  onStartRename,
  onSaveRename,
  onDelete,
  onTogglePin,
}) => {
  return (
    <div className="space-y-0.5">
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </div>
      {conversations.map((conv) => {
        const isActive = conv.id === activeId;
        const isEditing = editingId === conv.id;

        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`group relative flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
              isActive
                ? 'bg-gray-800/90 font-medium text-white'
                : 'text-gray-300 hover:bg-gray-800/50 hover:text-gray-100'
            }`}
          >
            {isEditing ? (
              <form
                onSubmit={(e) => onSaveRename(conv.id, e)}
                className="flex items-center gap-1 w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded border border-indigo-500 bg-[#1f1f1f] px-1.5 py-0.5 text-xs text-gray-100 focus:outline-hidden"
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1 text-emerald-400 hover:bg-emerald-950 rounded"
                >
                  <Check className="h-3 w-3" />
                </button>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-2 truncate pr-2">
                  <MessageSquare className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </div>

                {/* Hover action buttons */}
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(conv.id);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-200 rounded"
                    title={conv.isPinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin
                      className={`h-3 w-3 ${
                        conv.isPinned ? 'fill-current text-indigo-400' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onStartRename(conv, e)}
                    className="p-1 text-gray-400 hover:text-gray-200 rounded"
                    title="Rename"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="p-1 text-gray-400 hover:text-rose-400 rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
