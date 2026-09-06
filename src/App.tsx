/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Conversation,
  Message,
  Project,
  UserPreferences,
  ModelInfo,
  Artifact,
  FileAttachment,
  GroundingSource,
} from './types';
import {
  getSavedConversations,
  saveConversations,
  getSavedProjects,
  saveProjects,
  getSavedPreferences,
  savePreferences,
  DEFAULT_PREFERENCES,
  INITIAL_CONVERSATION,
  extractArtifactsFromText,
} from './utils/storage';
import {
  fetchUserConversations,
  syncConversationToCloud,
  deleteConversationFromCloud,
  fetchUserProjects,
  syncProjectToCloud,
  deleteProjectFromCloud,
  fetchUserPreferences,
  syncPreferencesToCloud,
} from './utils/cloudSync';
import { useAuth } from './context/AuthContext';
import { playPcmAudio, speakTextNative, stopAllSpeech } from './utils/audio';
import { normalizeMoonexModelId } from '../lib/moonex-models';
import {
  prepareMessageEdit,
  prepareMessageRegeneration,
} from './utils/conversationActions';
import {
  STATIC_MOONEX_MODEL_CATALOG,
  getMoonexDisplayName,
  mergeAvailableMoonexModels,
} from './utils/modelPresentation';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MessageItem } from './components/MessageItem';
import { ChatInput } from './components/ChatInput';
import { ArtifactPanel } from './components/ArtifactPanel';
import { WelcomeView } from './components/WelcomeView';
import { ProjectsModal } from './components/ProjectsModal';
import { DeepResearchModal } from './components/DeepResearchModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsModal } from './components/ShortcutsModal';
import { PromptLibraryModal } from './components/PromptLibraryModal';

export default function App() {
  const { user, isAnonymous } = useAuth();

  // State initialization from local storage
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    getSavedConversations()
  );
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const saved = getSavedConversations();
    return saved[0]?.id || INITIAL_CONVERSATION.id;
  });

  const [projects, setProjects] = useState<Project[]>(() => getSavedProjects());
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    getSavedPreferences()
  );
  // Keep the client usable and label-stable before /api/models responds.
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>(STATIC_MOONEX_MODEL_CATALOG);

  // UI state - initialize closed on mobile/tablet (< 1024px), open on desktop (>= 1024px)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  const [isArtifactPanelOpen, setIsArtifactPanelOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);

  // Auto-adapt sidebar on window resize
  useEffect(() => {
    const handleResize = () => {
      // If resizing across breakpoint, ensure proper overlay vs static behavior
      if (window.innerWidth < 768 && isSidebarOpen) {
        // Can stay as toggled by user
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  // Modals state
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [activeProjectIdForModal, setActiveProjectIdForModal] = useState<string | undefined>();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);

  // Streaming & Generation state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingGrounding, setStreamingGrounding] = useState<GroundingSource[]>([]);
  const [streamingModel, setStreamingModel] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio Playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const stopAudioCallbackRef = useRef<(() => void) | null>(null);

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cloud Sync on Authenticated User
  useEffect(() => {
    if (!user || isAnonymous) return;

    let isMounted = true;

    async function loadCloudData() {
      try {
        const [cloudConvs, cloudProjs, cloudPrefs] = await Promise.all([
          fetchUserConversations(user!.uid),
          fetchUserProjects(user!.uid),
          fetchUserPreferences(user!.uid),
        ]);

        if (!isMounted) return;

        if (cloudConvs.length > 0) {
          setConversations(cloudConvs);
          setActiveConversationId(cloudConvs[0].id);
        } else {
          // Sync existing local conversations to cloud if cloud is empty
          const localConvs = getSavedConversations();
          for (const conv of localConvs) {
            await syncConversationToCloud(user!.uid, conv);
          }
        }

        if (cloudProjs.length > 0) {
          setProjects(cloudProjs);
        } else {
          const localProjs = getSavedProjects();
          for (const proj of localProjs) {
            await syncProjectToCloud(user!.uid, proj);
          }
        }

        if (cloudPrefs) {
          setPreferences(cloudPrefs);
        } else {
          await syncPreferencesToCloud(user!.uid, preferences);
        }
      } catch (err) {
        console.error('Error synchronizing cloud data:', err);
      }
    }

    loadCloudData();

    return () => {
      isMounted = false;
    };
  }, [user, isAnonymous]);

  // Fetch available models from backend on mount
  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => {
        if (data.models && Array.isArray(data.models)) {
          setAvailableModels(mergeAvailableMoonexModels(data.models));
        }
      })
      .catch((err) => {
        console.warn('Could not fetch models catalog from backend:', err);
      });
  }, []);

  // Sync theme with HTML document element
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else if (preferences.theme === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [preferences.theme]);

  // Save conversations to localStorage and Cloud Firestore whenever they change
  useEffect(() => {
    saveConversations(conversations);
    if (user && !isAnonymous && conversations.length > 0) {
      conversations.forEach((conv) => {
        syncConversationToCloud(user.uid, conv).catch(() => {});
      });
    }
  }, [conversations, user, isAnonymous]);

  // Save projects to localStorage and Cloud Firestore whenever they change
  useEffect(() => {
    saveProjects(projects);
    if (user && !isAnonymous && projects.length > 0) {
      projects.forEach((proj) => {
        syncProjectToCloud(user.uid, proj).catch(() => {});
      });
    }
  }, [projects, user, isAnonymous]);

  // Save preferences
  useEffect(() => {
    savePreferences(preferences);
    if (user && !isAnonymous) {
      syncPreferencesToCloud(user.uid, preferences).catch(() => {});
    }
  }, [preferences, user, isAnonymous]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea (unless meta/ctrl key is pressed)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd+K / Ctrl+K: Open Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Cmd+P / Ctrl+P: Open Prompt Library
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setIsPromptLibraryOpen((prev) => !prev);
        return;
      }

      // Cmd+B / Ctrl+B: Toggle Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // Cmd+/ / Ctrl+/: Keyboard Shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Cmd+Shift+O: New Conversation
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault();
        handleNewConversation();
        return;
      }

      // Cmd+Shift+R: Deep Research
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        if (!user || isAnonymous) {
          setAuthModalMode('signin');
          setIsAuthModalOpen(true);
        } else {
          setIsResearchModalOpen(true);
        }
        return;
      }

      // Cmd+,: Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsModalOpen((prev) => !prev);
        return;
      }

      // Escape: Close any open modal
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsShortcutsModalOpen(false);
        setIsPromptLibraryOpen(false);
        setIsProjectsModalOpen(false);
        setIsResearchModalOpen(false);
        setIsSettingsModalOpen(false);
        setIsAuthModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, isAnonymous]);

  // Get current active conversation
  const currentConversation =
    conversations.find((c) => c.id === activeConversationId) ||
    conversations[0] ||
    INITIAL_CONVERSATION;

  // Auto scroll to bottom during streaming or new message
  const scrollToBottom = (smooth = true) => {
    if (preferences.autoScroll) {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [currentConversation.messages.length, streamingContent]);

  // Actions
  const handleNewConversation = (projectId?: string) => {
    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: 'New conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      projectId,
      model: normalizeMoonexModelId(preferences.defaultModel),
      thinkingLevel: preferences.defaultThinkingLevel || 'none',
      enableWebSearch: preferences.defaultWebSearch || false,
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    if (user && !isAnonymous) {
      deleteConversationFromCloud(user.uid, id).catch(console.error);
    }
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      const freshConv: Conversation = {
        id: `conv_${Date.now()}`,
        title: 'New conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: normalizeMoonexModelId(preferences.defaultModel),
        thinkingLevel: preferences.defaultThinkingLevel,
        enableWebSearch: preferences.defaultWebSearch,
      };
      setConversations([freshConv]);
      setActiveConversationId(freshConv.id);
    } else {
      setConversations(remaining);
      if (activeConversationId === id) {
        setActiveConversationId(remaining[0].id);
      }
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
    );
  };

  const handleTogglePinConversation = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c))
    );
  };

  const handleSelectModel = (modelId: string) => {
    const canonicalModelId = normalizeMoonexModelId(modelId);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId ? { ...c, model: canonicalModelId } : c
      )
    );
  };

  const handleToggleThinking = () => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConversationId) return c;
        const nextLevel = c.thinkingLevel === 'none' ? 'high' : 'none';
        return { ...c, thinkingLevel: nextLevel };
      })
    );
  };

  const handleToggleSearch = () => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, enableWebSearch: !c.enableWebSearch }
          : c
      )
    );
  };

  const handleChangeTone = (tone: UserPreferences['tone']) => {
    setPreferences((prev) => ({ ...prev, tone }));
  };

  const handleClearConversation = () => {
    if (confirm('Clear all messages in this conversation?')) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? { ...c, messages: [], updatedAt: Date.now() }
            : c
        )
      );
    }
  };

  const handleExportConversation = () => {
    const title = currentConversation.title || 'conversation';
    let md = `# ${title}\n\nDate: ${new Date(currentConversation.createdAt).toLocaleString()}\nModel: ${currentConversation.model}\n\n---\n\n`;

    currentConversation.messages.forEach((msg) => {
      const sender = msg.role === 'user' ? '### User' : '### Moonex';
      md += `${sender} (${new Date(msg.timestamp).toLocaleTimeString()})\n\n${msg.content}\n\n`;
      if (msg.groundingSources && msg.groundingSources.length > 0) {
        md += `**Sources:**\n${msg.groundingSources.map((s) => `- [${s.title}](${s.url})`).join('\n')}\n\n`;
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Pin message in current conversation
  const handleTogglePinMessage = (messageId: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConversationId) return c;
        const updatedMsgs = c.messages.map((m) =>
          m.id === messageId ? { ...m, isPinned: !m.isPinned } : m
        );
        return { ...c, messages: updatedMsgs };
      })
    );
  };

  // Fork / Branch conversation at specific message
  const handleBranchConversation = (messageId: string) => {
    const msgIndex = currentConversation.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const branchedMessages = currentConversation.messages.slice(0, msgIndex + 1);
    const branchedConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: `Branch: ${currentConversation.title.slice(0, 24)}`,
      messages: branchedMessages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      projectId: currentConversation.projectId,
      model: currentConversation.model,
      thinkingLevel: currentConversation.thinkingLevel,
      enableWebSearch: currentConversation.enableWebSearch,
    };

    setConversations((prev) => [branchedConv, ...prev]);
    setActiveConversationId(branchedConv.id);
  };

  // Edit an earlier user message & resubmit from that point
  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!user || isAnonymous) {
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      return;
    }

    const mutation = prepareMessageEdit(currentConversation.messages, messageId, newContent);
    if (!mutation || !mutation.targetMessage) return;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, messages: mutation.messages }
          : c
      )
    );

    // Pass the exact pre-edit prefix so React state timing cannot reintroduce stale history.
    handleSendMessage(
      mutation.targetMessage.content,
      mutation.targetMessage.files || [],
      undefined,
      mutation.messages,
    );
  };

  // Main chat sending & streaming method
  const handleSendMessage = async (
    text: string,
    files: FileAttachment[] = [],
    modelOverride?: string,
    baseMessages?: Message[],
  ) => {
    // Guest Restriction: Redirect guests and unauthenticated users to login
    if (!user || isAnonymous) {
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      return;
    }

    if ((!text.trim() && files.length === 0) || isStreaming) return;

    const conversationMessages = baseMessages ?? currentConversation.messages;
    const selectedModelId = normalizeMoonexModelId(modelOverride || currentConversation.model);

    // 1. Create User Message
    const userMessage: Message = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      files: files.length > 0 ? files : undefined,
    };

    // Update conversation title if it's the first user message
    const isFirstUserMessage = conversationMessages.length === 0;
    const newTitle = isFirstUserMessage
      ? text.slice(0, 36) || 'New Conversation'
      : currentConversation.title;

    const updatedMessages = [...conversationMessages, userMessage];

    // Optimistically update conversation
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              title: newTitle,
              model: selectedModelId,
              messages: updatedMessages,
              updatedAt: Date.now(),
            }
          : c
      )
    );

    // 2. Prepare payload for SSE streaming call
    const activeProject = currentConversation.projectId
      ? projects.find((p) => p.id === currentConversation.projectId)
      : null;

    const systemInstruction = activeProject
      ? `${preferences.customSystemInstructions}\n\nProject Instructions:\n${activeProject.customInstructions}`
      : preferences.customSystemInstructions;

    const projectKnowledge = activeProject?.knowledgeBase || [];

    setIsStreaming(true);
    setStreamingContent('');
    setStreamingGrounding([]);
    // Manual selections appear immediately. Auto is replaced by a resolved
    // Moonex profile when the server emits its route event.
    setStreamingModel(selectedModelId);
    const startTime = Date.now();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let effectiveModelUsed = selectedModelId;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          model: selectedModelId,
          enableWebSearch: currentConversation.enableWebSearch,
          thinkingLevel: currentConversation.thinkingLevel,
          systemInstruction,
          projectKnowledge,
          tone: preferences.tone,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        let detail = `HTTP ${response.status}`;
        try {
          const raw = await response.text();
          if (raw) detail += `: ${raw.slice(0, 800)}`;
        } catch {
          // Ignore body-read failures.
        }
        throw new Error(`Failed to connect to Moonex stream (${detail}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let accumulatedText = '';
      let collectedSources: GroundingSource[] = [];
      let streamError: string | null = null;

      const processSSELine = (line: string) => {
        const trimmed = line.trimEnd();
        if (!trimmed.startsWith('data:')) return;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') return;

        try {
          const event = JSON.parse(payload);
          if (event.type === 'route') {
            effectiveModelUsed = normalizeMoonexModelId(event.moonexModel, effectiveModelUsed);
            setStreamingModel(effectiveModelUsed);
          } else if (event.type === 'chunk') {
            accumulatedText += event.text || '';
            setStreamingContent(accumulatedText);
          } else if (event.type === 'done') {
            accumulatedText = event.fullText || accumulatedText;
            if (event.modelUsed) {
              effectiveModelUsed = normalizeMoonexModelId(event.modelUsed, effectiveModelUsed);
              setStreamingModel(effectiveModelUsed);
            }
            if (event.groundingSources && Array.isArray(event.groundingSources)) {
              collectedSources = event.groundingSources;
              setStreamingGrounding(collectedSources);
            }
          } else if (event.type === 'error') {
            console.error('Stream returned error:', event.error);
            streamError = event.error || 'The AI service returned an error. Please try again.';
          }
        } catch (e) {
          console.warn('Ignoring malformed SSE event:', payload.slice(0, 200), e);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split(/\r?\n/);
        sseBuffer = lines.pop() || '';

        for (const line of lines) processSSELine(line);
      }

      sseBuffer += decoder.decode();
      if (sseBuffer.trim()) processSSELine(sseBuffer);

      // If stream had an error and no text was produced
      if (streamError && !accumulatedText.trim()) {
        const errorMessage: Message = {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          content: streamError,
          timestamp: Date.now(),
          modelUsed: effectiveModelUsed,
          isError: true,
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? {
                  ...c,
                  messages: [...updatedMessages, errorMessage],
                  updatedAt: Date.now(),
                }
              : c
          )
        );
        return;
      }

      // Finalize message
      const durationMs = Date.now() - startTime;
      const extractedArtifacts = extractArtifactsFromText(accumulatedText);

      const assistantMessage: Message = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: accumulatedText || 'I am ready to assist you.',
        timestamp: Date.now(),
        thinkingTimeMs:
          currentConversation.thinkingLevel !== 'none' ? durationMs : undefined,
        groundingSources:
          collectedSources.length > 0 ? collectedSources : undefined,
        artifacts: extractedArtifacts.length > 0 ? extractedArtifacts : undefined,
        modelUsed: effectiveModelUsed,
        isError: !!streamError,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                messages: [...updatedMessages, assistantMessage],
                updatedAt: Date.now(),
              }
            : c
        )
      );

      // Auto open side canvas if significant new code/HTML artifact was generated
      if (extractedArtifacts.length > 0 && !isArtifactPanelOpen) {
        setActiveArtifact(extractedArtifacts[0]);
        setIsArtifactPanelOpen(true);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream generation aborted by user.');
        if (streamingContent.trim()) {
          const assistantMessage: Message = {
            id: `msg_asst_${Date.now()}`,
            role: 'assistant',
            content: `${streamingContent} *(Generation stopped)*`,
            timestamp: Date.now(),
            modelUsed: effectiveModelUsed,
          };
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConversationId
                ? { ...c, messages: [...updatedMessages, assistantMessage] }
                : c
            )
          );
        }
      } else {
        console.error('Error generating AI response:', err);
        const errorContent = err.message?.includes('503') || err.message?.includes('UNAVAILABLE')
          ? 'The AI model is currently experiencing high demand. Please try again or switch to another model.'
          : (err.message || 'Please check your connection and try again.');

        const errorMessage: Message = {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          content: errorContent,
          timestamp: Date.now(),
          modelUsed: effectiveModelUsed,
          isError: true,
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages: [...updatedMessages, errorMessage] }
              : c
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingGrounding([]);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRegenerate = () => {
    if (!user || isAnonymous) {
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      return;
    }

    const mutation = prepareMessageRegeneration(currentConversation.messages);
    if (!mutation || !mutation.targetMessage) return;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, messages: mutation.messages }
          : c
      )
    );

    // Reuse the exact prefix and original user turn; do not duplicate the turn.
    handleSendMessage(
      mutation.targetMessage.content,
      mutation.targetMessage.files || [],
      undefined,
      mutation.messages,
    );
  };

  // Text-to-Speech audio reader
  const handleSpeakText = async (text: string, playbackRate: number = 1) => {
    if (!user || isAnonymous) {
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      return;
    }

    stopAllSpeech();
    if (stopAudioCallbackRef.current) {
      stopAudioCallbackRef.current();
    }

    setIsPlayingAudio(true);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: preferences.voiceName || 'Kore',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          await playPcmAudio(data.audioBase64, data.sampleRate || 24000, playbackRate);
          setIsPlayingAudio(false);
          return;
        }
      }
      throw new Error('Fallback to Web Speech');
    } catch (e) {
      const cancelNative = speakTextNative(
        text,
        () => {
          setIsPlayingAudio(false);
        },
        playbackRate
      );
      stopAudioCallbackRef.current = cancelNative;
    }
  };

  const handleStopAudio = () => {
    stopAllSpeech();
    if (stopAudioCallbackRef.current) {
      stopAudioCallbackRef.current();
    }
    setIsPlayingAudio(false);
  };

  const handleOpenArtifact = (artifact: Artifact) => {
    setActiveArtifact(artifact);
    setIsArtifactPanelOpen(true);
  };

  const handleToggleTheme = () => {
    const next = preferences.theme === 'dark' ? 'light' : 'dark';
    setPreferences({ ...preferences, theme: next });
  };

  const isCurrentConversationEmpty = currentConversation.messages.length === 0;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#0d0d0d] text-gray-200">
      {/* 1. Left Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        conversations={conversations}
        activeConversationId={activeConversationId}
        projects={projects}
        preferences={preferences}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onTogglePinConversation={handleTogglePinConversation}
        onOpenProjectsModal={() => {
          setActiveProjectIdForModal(undefined);
          setIsProjectsModalOpen(true);
        }}
        onSelectProject={(projectId) => {
          setActiveProjectIdForModal(projectId);
          setIsProjectsModalOpen(true);
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenResearch={() => {
          if (!user || isAnonymous) {
            setAuthModalMode('signin');
            setIsAuthModalOpen(true);
            return;
          }
          setIsResearchModalOpen(true);
        }}
        onToggleTheme={handleToggleTheme}
        onCloseMobileSidebar={() => setIsSidebarOpen(false)}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode || 'signin');
          setIsAuthModalOpen(true);
        }}
        onOpenPromptLibrary={() => setIsPromptLibraryOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* 2. Main Chat / Workspace Column */}
      <div className="flex flex-1 flex-col h-full overflow-hidden bg-[#0d0d0d]">
        {/* Top Header */}
        <Header
          currentConversation={currentConversation}
          projects={projects}
          availableModels={availableModels}
          preferences={preferences}
          isSidebarOpen={isSidebarOpen}
          isArtifactPanelOpen={isArtifactPanelOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onToggleArtifactPanel={() => setIsArtifactPanelOpen(!isArtifactPanelOpen)}
          onSelectModel={handleSelectModel}
          onToggleThinking={handleToggleThinking}
          onToggleSearch={handleToggleSearch}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenResearch={() => {
            if (!user || isAnonymous) {
              setAuthModalMode('signin');
              setIsAuthModalOpen(true);
              return;
            }
            setIsResearchModalOpen(true);
          }}
          onClearConversation={handleClearConversation}
          onExportConversation={handleExportConversation}
          onOpenProject={(projId) => {
            setActiveProjectIdForModal(projId);
            setIsProjectsModalOpen(true);
          }}
          onOpenAuth={(mode) => {
            setAuthModalMode(mode || 'signin');
            setIsAuthModalOpen(true);
          }}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenPromptLibrary={() => setIsPromptLibraryOpen(true)}
          onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        />

        {/* Chat Scroll Area or Welcome Hero */}
        <main
          id="chat-scroll-container"
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-between"
        >
          {isCurrentConversationEmpty ? (
            <WelcomeView
              preferences={preferences}
              onSelectPrompt={(prompt, model, thinking, search) => {
                if (model) handleSelectModel(model);
                if (thinking) {
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === activeConversationId
                        ? { ...c, thinkingLevel: 'high' }
                        : c
                    )
                  );
                }
                if (search !== undefined) {
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === activeConversationId
                        ? { ...c, enableWebSearch: search }
                        : c
                    )
                  );
                }
                handleSendMessage(prompt, [], model);
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col justify-start">
              {currentConversation.messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  onRegenerate={handleRegenerate}
                  onOpenArtifact={handleOpenArtifact}
                  onSpeak={handleSpeakText}
                  isPlayingAudio={isPlayingAudio}
                  onStopAudio={handleStopAudio}
                  onEditMessage={handleEditMessage}
                  onTogglePinMessage={handleTogglePinMessage}
                  onBranchConversation={handleBranchConversation}
                />
              ))}

              {/* Live Streaming Message Item */}
              {isStreaming && (
                <MessageItem
                  message={{
                    id: 'streaming_msg',
                    role: 'assistant',
                    content:
                      streamingContent ||
                      `Thinking with ${getMoonexDisplayName(streamingModel)}...`,
                    timestamp: Date.now(),
                    modelUsed: streamingModel,
                    groundingSources: streamingGrounding,
                  }}
                  isStreaming={true}
                />
              )}

              <div ref={messagesEndRef} className="h-4 shrink-0" />
            </div>
          )}
        </main>

        {/* Bottom Chat Input Bar */}
        <footer className="shrink-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/90 to-transparent pt-2">
          <ChatInput
            onSendMessage={handleSendMessage}
            isStreaming={isStreaming}
            onStopStreaming={handleStopStreaming}
            enableThinking={currentConversation.thinkingLevel !== 'none'}
            onToggleThinking={handleToggleThinking}
            enableWebSearch={currentConversation.enableWebSearch}
            onToggleWebSearch={handleToggleSearch}
            selectedModelName={getMoonexDisplayName(currentConversation.model)}
            isAuthenticated={!!user && !isAnonymous}
            onRequireAuth={() => {
              setAuthModalMode('signin');
              setIsAuthModalOpen(true);
            }}
            onOpenPromptLibrary={() => setIsPromptLibraryOpen(true)}
            currentTone={preferences.tone}
            onChangeTone={handleChangeTone}
          />
        </footer>
      </div>

      {/* 3. Right Artifacts & Canvas Panel */}
      <ArtifactPanel
        artifact={activeArtifact}
        isOpen={isArtifactPanelOpen}
        onClose={() => setIsArtifactPanelOpen(false)}
        onSendRefactorPrompt={(prompt) => {
          handleSendMessage(prompt, []);
        }}
      />

      {/* 4. Global Modals */}
      {/* Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        conversations={conversations}
        availableModels={availableModels}
        projects={projects}
        currentModel={currentConversation.model}
        enableThinking={currentConversation.thinkingLevel !== 'none'}
        enableSearch={currentConversation.enableWebSearch}
        onSelectConversation={(id) => {
          handleSelectConversation(id);
          setIsCommandPaletteOpen(false);
        }}
        onSelectModel={(modelId) => {
          handleSelectModel(modelId);
          setIsCommandPaletteOpen(false);
        }}
        onNewChat={() => {
          handleNewConversation();
          setIsCommandPaletteOpen(false);
        }}
        onToggleThinking={handleToggleThinking}
        onToggleSearch={handleToggleSearch}
        onOpenSettings={() => {
          setIsCommandPaletteOpen(false);
          setIsSettingsModalOpen(true);
        }}
        onOpenResearch={() => {
          setIsCommandPaletteOpen(false);
          if (!user || isAnonymous) {
            setAuthModalMode('signin');
            setIsAuthModalOpen(true);
          } else {
            setIsResearchModalOpen(true);
          }
        }}
        onOpenProjects={() => {
          setIsCommandPaletteOpen(false);
          setIsProjectsModalOpen(true);
        }}
        onOpenPromptLibrary={() => {
          setIsCommandPaletteOpen(false);
          setIsPromptLibraryOpen(true);
        }}
        onOpenShortcuts={() => {
          setIsCommandPaletteOpen(false);
          setIsShortcutsModalOpen(true);
        }}
        onToggleTheme={handleToggleTheme}
        onExportChat={handleExportConversation}
        onClearChat={handleClearConversation}
      />

      {/* Shortcuts Modal (⌘/) */}
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Prompt Library Modal (⌘P) */}
      <PromptLibraryModal
        isOpen={isPromptLibraryOpen}
        onClose={() => setIsPromptLibraryOpen(false)}
        onSelectPrompt={(promptText) => {
          setIsPromptLibraryOpen(false);
          handleSendMessage(promptText, []);
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Projects Modal */}
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        projects={projects}
        activeProjectId={activeProjectIdForModal}
        onClose={() => setIsProjectsModalOpen(false)}
        onSaveProject={(updatedProj) => {
          setProjects((prev) => {
            const index = prev.findIndex((p) => p.id === updatedProj.id);
            if (index >= 0) {
              const copy = [...prev];
              copy[index] = updatedProj;
              return copy;
            }
            return [...prev, updatedProj];
          });
        }}
        onDeleteProject={(projId) => {
          if (user && !isAnonymous) {
            deleteProjectFromCloud(user.uid, projId).catch(console.error);
          }
          setProjects((prev) => prev.filter((p) => p.id !== projId));
        }}
        onSelectProjectAndChat={(projId) => {
          handleNewConversation(projId);
        }}
      />

      {/* Deep Research Modal */}
      <DeepResearchModal
        isOpen={isResearchModalOpen}
        onClose={() => setIsResearchModalOpen(false)}
        onContinueInChat={(reportText) => {
          handleNewConversation();
          handleSendMessage(
            `Here is my research briefing to analyze:\n\n${reportText}\n\nPlease provide key tactical insights and next steps based on this research.`
          );
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        preferences={preferences}
        availableModels={availableModels}
        onClose={() => setIsSettingsModalOpen(false)}
        onSavePreferences={(newPrefs) =>
          setPreferences({
            ...newPrefs,
            defaultModel: normalizeMoonexModelId(newPrefs.defaultModel),
          })
        }
        onReloadData={() => {
          setConversations(getSavedConversations());
          setProjects(getSavedProjects());
          setPreferences(getSavedPreferences());
        }}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode || 'signin');
          setIsAuthModalOpen(true);
        }}
      />
    </div>
  );
}
