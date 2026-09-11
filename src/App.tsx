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
  STATIC_MOONEX_MODEL_CATALOG,
  getMoonexDisplayName,
  mergeAvailableMoonexModels,
} from './utils/modelPresentation';
import {
  prepareMessageEdit,
  prepareMessageRegeneration,
} from './utils/conversationActions';
import { prepareMessageRetry } from './utils/conversationRetry';

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
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>(STATIC_MOONEX_MODEL_CATALOG);

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  const [isArtifactPanelOpen, setIsArtifactPanelOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isSidebarOpen) {
        // Can stay as toggled by user
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [activeProjectIdForModal, setActiveProjectIdForModal] = useState<string | undefined>();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingGrounding, setStreamingGrounding] = useState<GroundingSource[]>([]);
  const [streamingModel, setStreamingModel] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const stopAudioCallbackRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          const localConvs = getSavedConversations();
          for (const conv of localConvs) await syncConversationToCloud(user!.uid, conv);
        }
        if (cloudProjs.length > 0) {
          setProjects(cloudProjs);
        } else {
          const localProjs = getSavedProjects();
          for (const proj of localProjs) await syncProjectToCloud(user!.uid, proj);
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

  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') root.classList.add('dark');
    else if (preferences.theme === 'light') root.classList.remove('dark');
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [preferences.theme]);

  useEffect(() => {
    saveConversations(conversations);
    if (user && !isAnonymous && conversations.length > 0) {
      conversations.forEach((conv) => syncConversationToCloud(user.uid, conv).catch(() => {}));
    }
  }, [conversations, user, isAnonymous]);

  useEffect(() => {
    saveProjects(projects);
    if (user && !isAnonymous && projects.length > 0) {
      projects.forEach((proj) => syncProjectToCloud(user.uid, proj).catch(() => {}));
    }
  }, [projects, user, isAnonymous]);

  useEffect(() => {
    savePreferences(preferences);
    if (user && !isAnonymous) syncPreferencesToCloud(user.uid, preferences).catch(() => {});
  }, [preferences, user, isAnonymous]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setIsCommandPaletteOpen((prev) => !prev); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault(); setIsPromptLibraryOpen((prev) => !prev); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault(); setIsSidebarOpen((prev) => !prev); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault(); setIsShortcutsModalOpen((prev) => !prev); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault(); handleNewConversation(); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        if (!user || isAnonymous) {
          setAuthModalMode('signin'); setIsAuthModalOpen(true);
        } else setIsResearchModalOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault(); setIsSettingsModalOpen((prev) => !prev); return;
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsShortcutsModalOpen(false);
        setIsPromptLibraryOpen(false);
        setIsProjectsModalOpen(false);
        setIsResearchModalOpen(false);
        setIsSettingsModalOpen(false);
        setIsAuthModalOpen(false);
      }
      void isInput;
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, isAnonymous]);

  const currentConversation =
    conversations.find((c) => c.id === activeConversationId) || conversations[0] || INITIAL_CONVERSATION;

  const scrollToBottom = (smooth = true) => {
    if (preferences.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [currentConversation.messages.length, streamingContent]);

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
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleDeleteConversation = (id: string) => {
    if (user && !isAnonymous) deleteConversationFromCloud(user.uid, id).catch(console.error);
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      const freshConv: Conversation = {
        id: `conv_${Date.now()}`,
        title: 'New conversation', messages: [], createdAt: Date.now(), updatedAt: Date.now(),
        model: normalizeMoonexModelId(preferences.defaultModel),
        thinkingLevel: preferences.defaultThinkingLevel,
        enableWebSearch: preferences.defaultWebSearch,
      };
      setConversations([freshConv]); setActiveConversationId(freshConv.id);
    } else {
      setConversations(remaining);
      if (activeConversationId === id) setActiveConversationId(remaining[0].id);
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c)));
  };

  const handleTogglePinConversation = (id: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c)));
  };

  const handleSelectModel = (modelId: string) => {
    const canonicalModelId = normalizeMoonexModelId(modelId);
    setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, model: canonicalModelId } : c));
  };

  const handleToggleThinking = () => {
    setConversations((prev) => prev.map((c) => {
      if (c.id !== activeConversationId) return c;
      return { ...c, thinkingLevel: c.thinkingLevel === 'none' ? 'high' : 'none' };
    }));
  };

  const handleToggleSearch = () => {
    setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, enableWebSearch: !c.enableWebSearch } : c));
  };

  const handleChangeTone = (tone: UserPreferences['tone']) => setPreferences((prev) => ({ ...prev, tone }));

  const handleClearConversation = () => {
    if (confirm('Clear all messages in this conversation?')) {
      setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, messages: [], updatedAt: Date.now() } : c));
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
    const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleTogglePinMessage = (messageId: string) => {
    setConversations((prev) => prev.map((c) => {
      if (c.id !== activeConversationId) return c;
      return { ...c, messages: c.messages.map((m) => m.id === messageId ? { ...m, isPinned: !m.isPinned } : m) };
    }));
  };

  const handleBranchConversation = (messageId: string) => {
    const msgIndex = currentConversation.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;
    const branchedMessages = currentConversation.messages.slice(0, msgIndex + 1);
    const branchedConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: `Branch: ${currentConversation.title.slice(0, 24)}`,
      messages: branchedMessages, createdAt: Date.now(), updatedAt: Date.now(),
      projectId: currentConversation.projectId, model: currentConversation.model,
      thinkingLevel: currentConversation.thinkingLevel, enableWebSearch: currentConversation.enableWebSearch,
    };
    setConversations((prev) => [branchedConv, ...prev]); setActiveConversationId(branchedConv.id);
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!user || isAnonymous) {
      setAuthModalMode('signin'); setIsAuthModalOpen(true); return;
    }
    const mutation = prepareMessageEdit(currentConversation.messages, messageId, newContent.trim());
    if (!mutation?.targetMessage) return;
    setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, messages: mutation.messages } : c));
    handleSendMessage(
      mutation.targetMessage.content,
      mutation.targetMessage.files || [],
      undefined,
      mutation.messages,
    );
  };

  const handleSendMessage = async (
    text: string,
    files: FileAttachment[] = [],
    modelOverride?: string,
    baseMessages?: Message[],
  ) => {
    if (!user || isAnonymous) {
      setAuthModalMode('signin'); setIsAuthModalOpen(true); return;
    }
    if ((!text.trim() && files.length === 0) || isStreaming) return;

    const conversationMessages = baseMessages ?? currentConversation.messages;
    const selectedModelId = normalizeMoonexModelId(modelOverride || currentConversation.model);
    const userMessage: Message = {
      id: `msg_user_${Date.now()}`, role: 'user', content: text, timestamp: Date.now(),
      files: files.length > 0 ? files : undefined,
    };
    const isFirstUserMessage = conversationMessages.length === 0;
    const newTitle = isFirstUserMessage ? text.slice(0, 36) || 'New Conversation' : currentConversation.title;
    const updatedMessages = [...conversationMessages, userMessage];

    setConversations((prev) => prev.map((c) => c.id === activeConversationId ? {
      ...c, title: newTitle, model: selectedModelId, messages: updatedMessages, updatedAt: Date.now(),
    } : c));

    const activeProject = currentConversation.projectId ? projects.find((p) => p.id === currentConversation.projectId) : null;
    const systemInstruction = activeProject
      ? `${preferences.customSystemInstructions}\n\nProject Instructions:\n${activeProject.customInstructions}`
      : preferences.customSystemInstructions;
    const projectKnowledge = activeProject?.knowledgeBase || [];

    setIsStreaming(true); setStreamingContent(''); setStreamingGrounding([]); setStreamingModel(selectedModelId);
    const startTime = Date.now();
    const controller = new AbortController(); abortControllerRef.current = controller;
    let effectiveModelUsed = selectedModelId;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages, model: selectedModelId,
          enableWebSearch: currentConversation.enableWebSearch,
          thinkingLevel: currentConversation.thinkingLevel,
          systemInstruction, projectKnowledge, tone: preferences.tone,
        }), signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        let detail = `HTTP ${response.status}`;
        try { const raw = await response.text(); if (raw) detail += `: ${raw.slice(0, 800)}`; } catch {}
        throw new Error(`Failed to connect to Moonex stream (${detail}).`);
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      let sseBuffer = ''; let accumulatedText = ''; let collectedSources: GroundingSource[] = []; let streamError: string | null = null;
      const processSSELine = (line: string) => {
        const trimmed = line.trimEnd(); if (!trimmed.startsWith('data:')) return;
        const payload = trimmed.slice(5).trim(); if (!payload || payload === '[DONE]') return;
        try {
          const event = JSON.parse(payload);
          if (event.type === 'route') {
            effectiveModelUsed = normalizeMoonexModelId(event.moonexModel, effectiveModelUsed); setStreamingModel(effectiveModelUsed);
          } else if (event.type === 'chunk') {
            accumulatedText += event.text || ''; setStreamingContent(accumulatedText);
          } else if (event.type === 'done') {
            accumulatedText = event.fullText || accumulatedText;
            if (event.modelUsed) { effectiveModelUsed = normalizeMoonexModelId(event.modelUsed, effectiveModelUsed); setStreamingModel(effectiveModelUsed); }
            if (event.groundingSources && Array.isArray(event.groundingSources)) { collectedSources = event.groundingSources; setStreamingGrounding(collectedSources); }
          } else if (event.type === 'error') {
            console.error('Stream returned error:', event.error); streamError = event.error || 'The AI service returned an error. Please try again.';
          }
        } catch (e) { console.warn('Ignoring malformed SSE event:', payload.slice(0, 200), e); }
      };
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        sseBuffer += decoder.decode(value, { stream: true }); const lines = sseBuffer.split(/\r?\n/); sseBuffer = lines.pop() || '';
        for (const line of lines) processSSELine(line);
      }
      sseBuffer += decoder.decode(); if (sseBuffer.trim()) processSSELine(sseBuffer);

      if (streamError && !accumulatedText.trim()) {
        const errorMessage: Message = { id: `msg_err_${Date.now()}`, role: 'assistant', content: streamError, timestamp: Date.now(), modelUsed: effectiveModelUsed, isError: true };
        setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, messages: [...updatedMessages, errorMessage], updatedAt: Date.now() } : c));
        return;
      }

      const durationMs = Date.now() - startTime; const extractedArtifacts = extractArtifactsFromText(accumulatedText);
      const assistantMessage: Message = {
        id: `msg_asst_${Date.now()}`, role: 'assistant', content: accumulatedText || 'I am ready to assist you.', timestamp: Date.now(),
        thinkingTimeMs: currentConversation.thinkingLevel !== 'none' ? durationMs : undefined,
        groundingSources: collectedSources.length > 0 ? collectedSources : undefined,
        artifacts: extractedArtifacts.length > 0 ? extractedArtifacts : undefined,
        modelUsed: effectiveModelUsed, isError: !!streamError,
      };
      setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, messages: [...updatedMessages, assistantMessage], updatedAt: Date.now() } : c));
      if (extractedArtifacts.length > 0 && !isArtifactPanelOpen) { setActiveArtifact(extractedArtifacts[0]); setIsArtifactPanelOpen(true); }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream generation aborted by user.');
        if (streamingContent.trim()) {
          const assistantMessage: Message = { id: `msg_asst_${Date.now()}`, role: 'assistant', content: `${streamingContent} *(Generation stopped)*`, timestamp: Date.now(), modelUsed: effectiveModelUsed };
          setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, messages: [...updatedMessages, assistantMessage] } : c));
        }
      } else {
        console.error('Error generating AI response:', err);
        const errorContent = err.message?.includes('503') || err.message?.includes('UNAVAILABLE')
          ? 'The AI model is currently experiencing high demand. Please try again or switch to another model.'
          : (err.message || 'Please check your connection and try again.');
        const errorMessage: Message = { id: `msg_err_${Date.now()}`, role: 'assistant', content: errorContent, timestamp: Date.now(), modelUsed: effectiveModelUsed, isError: true };
        setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, messages: [...updatedMessages, errorMessage] } : c));
      }
    } finally {
      setIsStreaming(false); setStreamingContent(''); setStreamingGrounding([]); abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  const handleRegenerate = () => {
    if (!user || isAnonymous) {
      setAuthModalMode('signin'); setIsAuthModalOpen(true); return;
    }
    const mutation = prepareMessageRegeneration(currentConversation.messages);
    if (!mutation?.targetMessage) return;
    setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, messages: mutation.messages } : c));
    handleSendMessage(
      mutation.targetMessage.content,
      mutation.targetMessage.files || [],
      undefined,
      mutation.messages,
    );
  };

  const handleRetryMessage = (messageId: string) => {
    if (!user || isAnonymous) {
      setAuthModalMode('signin'); setIsAuthModalOpen(true); return;
    }
    const errorIndex = currentConversation.messages.findIndex((message) => message.id === messageId);
    if (errorIndex < 0 || !currentConversation.messages[errorIndex].isError) return;
    const mutation = prepareMessageRetry(currentConversation.messages.slice(0, errorIndex + 1));
    if (!mutation) return;
    setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, messages: mutation.messages } : c));
    handleSendMessage(
      mutation.targetMessage.content,
      mutation.targetMessage.files || [],
      undefined,
      mutation.messages,
    );
  };

  const handleSpeakText = async (text: string, playbackRate: number = 1) => {
    if (!user || isAnonymous) { setAuthModalMode('signin'); setIsAuthModalOpen(true); return; }
    stopAllSpeech(); if (stopAudioCallbackRef.current) stopAudioCallbackRef.current(); setIsPlayingAudio(true);
    try {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: preferences.voiceName || 'Kore' }) });
      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) { await playPcmAudio(data.audioBase64, data.sampleRate || 24000, playbackRate); setIsPlayingAudio(false); return; }
      }
      throw new Error('Fallback to Web Speech');
    } catch (e) {
      const cancelNative = speakTextNative(text, () => setIsPlayingAudio(false), playbackRate); stopAudioCallbackRef.current = cancelNative;
    }
  };

  const handleStopAudio = () => {
    stopAllSpeech(); if (stopAudioCallbackRef.current) stopAudioCallbackRef.current(); setIsPlayingAudio(false);
  };

  const handleOpenArtifact = (artifact: Artifact) => { setActiveArtifact(artifact); setIsArtifactPanelOpen(true); };
  const handleToggleTheme = () => setPreferences({ ...preferences, theme: preferences.theme === 'dark' ? 'light' : 'dark' });
  const isCurrentConversationEmpty = currentConversation.messages.length === 0;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#0d0d0d] text-gray-200">
      <Sidebar
        isOpen={isSidebarOpen} conversations={conversations} activeConversationId={activeConversationId} projects={projects} preferences={preferences}
        onSelectConversation={handleSelectConversation} onNewConversation={handleNewConversation} onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation} onTogglePinConversation={handleTogglePinConversation}
        onOpenProjectsModal={() => { setActiveProjectIdForModal(undefined); setIsProjectsModalOpen(true); }}
        onSelectProject={(projectId) => { setActiveProjectIdForModal(projectId); setIsProjectsModalOpen(true); }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenResearch={() => { if (!user || isAnonymous) { setAuthModalMode('signin'); setIsAuthModalOpen(true); return; } setIsResearchModalOpen(true); }}
        onToggleTheme={handleToggleTheme} onCloseMobileSidebar={() => setIsSidebarOpen(false)}
        onOpenAuth={(mode) => { setAuthModalMode(mode || 'signin'); setIsAuthModalOpen(true); }}
        onOpenPromptLibrary={() => setIsPromptLibraryOpen(true)} onOpenShortcuts={() => setIsShortcutsModalOpen(true)} onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      <div className="flex flex-1 flex-col h-full overflow-hidden bg-[#0d0d0d]">
        <Header
          currentConversation={currentConversation} projects={projects} availableModels={availableModels} preferences={preferences}
          isSidebarOpen={isSidebarOpen} isArtifactPanelOpen={isArtifactPanelOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onToggleArtifactPanel={() => setIsArtifactPanelOpen(!isArtifactPanelOpen)}
          onSelectModel={handleSelectModel} onToggleThinking={handleToggleThinking} onToggleSearch={handleToggleSearch}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenResearch={() => { if (!user || isAnonymous) { setAuthModalMode('signin'); setIsAuthModalOpen(true); return; } setIsResearchModalOpen(true); }}
          onClearConversation={handleClearConversation} onExportConversation={handleExportConversation}
          onOpenProject={(projId) => { setActiveProjectIdForModal(projId); setIsProjectsModalOpen(true); }}
          onOpenAuth={(mode) => { setAuthModalMode(mode || 'signin'); setIsAuthModalOpen(true); }}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} onOpenPromptLibrary={() => setIsPromptLibraryOpen(true)} onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        />

        <main id="chat-scroll-container" className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col justify-between">
          {isCurrentConversationEmpty ? (
            <WelcomeView
              preferences={preferences}
              onSelectPrompt={(prompt, model, thinking, search) => {
                if (model) handleSelectModel(model);
                if (thinking) setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, thinkingLevel: 'high' } : c));
                if (search !== undefined) setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, enableWebSearch: search } : c));
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
                  onRetry={handleRetryMessage}
                  onOpenArtifact={handleOpenArtifact}
                  onSpeak={handleSpeakText}
                  isPlayingAudio={isPlayingAudio}
                  onStopAudio={handleStopAudio}
                  onEditMessage={handleEditMessage}
                  onTogglePinMessage={handleTogglePinMessage}
                  onBranchConversation={handleBranchConversation}
                />
              ))}
              {isStreaming && (
                <MessageItem
                  message={{ id: 'streaming_msg', role: 'assistant', content: streamingContent || `Thinking with ${getMoonexDisplayName(streamingModel)}...`, timestamp: Date.now(), modelUsed: streamingModel, groundingSources: streamingGrounding }}
                  isStreaming={true}
                />
              )}
              <div ref={messagesEndRef} className="h-4 shrink-0" />
            </div>
          )}

          <div className="shrink-0">
            <ChatInput
              onSend={handleSendMessage}
              isStreaming={isStreaming}
              onStop={handleStopStreaming}
              preferences={preferences}
              currentConversation={currentConversation}
              projects={projects}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              onOpenResearch={() => { if (!user || isAnonymous) { setAuthModalMode('signin'); setIsAuthModalOpen(true); return; } setIsResearchModalOpen(true); }}
              onToggleThinking={handleToggleThinking}
              onToggleSearch={handleToggleSearch}
              onChangeTone={handleChangeTone}
              onNewConversation={handleNewConversation}
              onOpenAuth={(mode) => { setAuthModalMode(mode || 'signin'); setIsAuthModalOpen(true); }}
            />
          </div>
        </main>
      </div>

      {isArtifactPanelOpen && activeArtifact && (
        <ArtifactPanel artifact={activeArtifact} onClose={() => setIsArtifactPanelOpen(false)} />
      )}

      {isProjectsModalOpen && (
        <ProjectsModal
          projects={projects}
          activeProjectId={activeProjectIdForModal}
          onClose={() => setIsProjectsModalOpen(false)}
          onSave={(project) => {
            setProjects((prev) => {
              const exists = prev.some((p) => p.id === project.id);
              return exists ? prev.map((p) => p.id === project.id ? project : p) : [...prev, project];
            });
          }}
          onDelete={(projectId) => setProjects((prev) => prev.filter((p) => p.id !== projectId))}
        />
      )}

      {isResearchModalOpen && (
        <DeepResearchModal
          onClose={() => setIsResearchModalOpen(false)}
          onComplete={(result) => {
            const researchMessage: Message = {
              id: `msg_research_${Date.now()}`, role: 'assistant', content: result.report, timestamp: Date.now(), groundingSources: result.sources,
            };
            setConversations((prev) => prev.map((c) => c.id === activeConversationId ? { ...c, messages: [...c.messages, researchMessage] } : c));
            setIsResearchModalOpen(false);
          }}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          preferences={preferences}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={(next) => { setPreferences(next); setIsSettingsModalOpen(false); }}
        />
      )}

      {isAuthModalOpen && (
        <AuthModal
          mode={authModalMode}
          onClose={() => setIsAuthModalOpen(false)}
          onSwitchMode={(mode) => setAuthModalMode(mode)}
        />
      )}

      {isCommandPaletteOpen && (
        <CommandPalette
          onClose={() => setIsCommandPaletteOpen(false)}
          onNewConversation={handleNewConversation}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenResearch={() => setIsResearchModalOpen(true)}
          onOpenProjects={() => setIsProjectsModalOpen(true)}
        />
      )}

      {isShortcutsModalOpen && <ShortcutsModal onClose={() => setIsShortcutsModalOpen(false)} />}

      {isPromptLibraryOpen && (
        <PromptLibraryModal
          onClose={() => setIsPromptLibraryOpen(false)}
          onSelectPrompt={(prompt, model) => { if (model) handleSelectModel(model); handleSendMessage(prompt, [], model); }}
        />
      )}
    </div>
  );
}
