/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useTransition } from 'react';
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
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isArtifactPanelOpen, setIsArtifactPanelOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);

  // Modals state
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [activeProjectIdForModal, setActiveProjectIdForModal] = useState<string | undefined>();

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
  const chatContainerRef = useRef<HTMLDivElement>(null);

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
          setAvailableModels(data.models);
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
      // System preference
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

  // Keyboard shortcut for Cmd+K (New Chat)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleNewConversation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Actions
  const handleNewConversation = (projectId?: string) => {
    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: 'New conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      projectId,
      model: preferences.defaultModel || 'gemini-3.7-flash',
      thinkingLevel: preferences.defaultThinkingLevel || 'none',
      enableWebSearch: preferences.defaultWebSearch || false,
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
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
        model: preferences.defaultModel,
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
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId ? { ...c, model: modelId } : c
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
      const sender = msg.role === 'user' ? '### User' : '### My AI Model';
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

  // Main chat sending & streaming method
  const handleSendMessage = async (
    text: string,
    files: FileAttachment[] = []
  ) => {
    // Guest Restriction: Redirect guests and unauthenticated users to login
    if (!user || isAnonymous) {
      setAuthModalMode('signin');
      setIsAuthModalOpen(true);
      return;
    }

    if ((!text.trim() && files.length === 0) || isStreaming) return;

    // 1. Create User Message
    const userMessage: Message = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      files: files.length > 0 ? files : undefined,
    };

    // Update conversation title if it's the first user message
    const isFirstUserMessage = currentConversation.messages.length === 0;
    const newTitle = isFirstUserMessage
      ? text.slice(0, 36) || 'New Conversation'
      : currentConversation.title;

    const updatedMessages = [...currentConversation.messages, userMessage];

    // Optimistically update conversation
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              title: newTitle,
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
    setStreamingModel(currentConversation.model);
    const startTime = Date.now();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          model: currentConversation.model,
          enableWebSearch: currentConversation.enableWebSearch,
          thinkingLevel: currentConversation.thinkingLevel,
          systemInstruction,
          projectKnowledge,
          tone: preferences.tone,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to connect to My AI Model stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let collectedSources: GroundingSource[] = [];
      let streamError: string | null = null;
      let effectiveModelUsed = currentConversation.model;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        const lines = raw.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'chunk') {
                accumulatedText += event.text;
                setStreamingContent(accumulatedText);
              } else if (event.type === 'done') {
                accumulatedText = event.fullText || accumulatedText;
                if (event.modelUsed) {
                  effectiveModelUsed = event.modelUsed;
                }
                if (event.groundingSources && Array.isArray(event.groundingSources)) {
                  collectedSources = event.groundingSources;
                  setStreamingGrounding(collectedSources);
                }
              } else if (event.type === 'error') {
                console.error('Stream returned error:', event.error);
                streamError = event.error || 'The model is currently experiencing high demand. Please try again.';
              }
            } catch (e) {
              // Ignore line parse errors
            }
          }
        }
      }

      // If stream had an error and no text was produced
      if (streamError && !accumulatedText.trim()) {
        const errorMessage: Message = {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          content: streamError,
          timestamp: Date.now(),
          modelUsed: currentConversation.model,
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
        // Still save partial output if any
        if (streamingContent.trim()) {
          const assistantMessage: Message = {
            id: `msg_asst_${Date.now()}`,
            role: 'assistant',
            content: `${streamingContent} *(Generation stopped)*`,
            timestamp: Date.now(),
            modelUsed: currentConversation.model,
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
          modelUsed: currentConversation.model,
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

    const msgs = currentConversation.messages;
    if (msgs.length === 0) return;

    // Find last user message
    let lastUserMsgIndex = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUserMsgIndex = i;
        break;
      }
    }

    if (lastUserMsgIndex !== -1) {
      const userMsg = msgs[lastUserMsgIndex];
      // Trim messages to before this user message and re-send
      const trimmed = msgs.slice(0, lastUserMsgIndex);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId ? { ...c, messages: trimmed } : c
        )
      );
      handleSendMessage(userMsg.content, userMsg.files || []);
    }
  };

  // Text-to-Speech audio reader
  const handleSpeakText = async (text: string) => {
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
      // First try high-quality Neural Gemini TTS
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
          await playPcmAudio(data.audioBase64, data.sampleRate || 24000);
          setIsPlayingAudio(false);
          return;
        }
      }
      throw new Error('Fallback to Web Speech');
    } catch (e) {
      // Fallback to Native Web Speech
      const cancelNative = speakTextNative(text, () => {
        setIsPlayingAudio(false);
      });
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d0d0d] text-gray-200">
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
        />

        {/* Middle Scrollable Chat Messages Container */}
        <main
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col"
        >
          {isCurrentConversationEmpty ? (
            <WelcomeView
              userName={preferences.userName}
              onSelectPrompt={(prompt, thinking, search) => {
                if (!user || isAnonymous) {
                  setAuthModalMode('signin');
                  setIsAuthModalOpen(true);
                  return;
                }
                if (thinking !== undefined) {
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === activeConversationId
                        ? { ...c, thinkingLevel: thinking ? 'high' : 'none' }
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
                handleSendMessage(prompt, []);
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
                />
              ))}

              {/* Live Streaming Message Item */}
              {isStreaming && (
                <MessageItem
                  message={{
                    id: 'streaming_msg',
                    role: 'assistant',
                    content: streamingContent || 'Thinking and generating...',
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
            selectedModelName={currentConversation.model}
            isAuthenticated={!!user && !isAnonymous}
            onRequireAuth={() => {
              setAuthModalMode('signin');
              setIsAuthModalOpen(true);
            }}
          />
        </footer>
      </div>

      {/* 3. Right Artifacts & Canvas Panel */}
      <ArtifactPanel
        artifact={activeArtifact}
        isOpen={isArtifactPanelOpen}
        onClose={() => setIsArtifactPanelOpen(false)}
      />

      {/* 4. Modals */}
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
        onSavePreferences={(newPrefs) => setPreferences(newPrefs)}
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
