import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  ArrowDown, ArrowUp, AudioLines, Check, ChevronDown, CircleHelp, Command, Compass,
  Copy, Ellipsis, FileText, Globe2, ImagePlus, Layers3, Menu, MessageSquare, Moon,
  MoreHorizontal, PanelLeftClose, PanelLeftOpen, Paperclip, Plus, Search, Send, Settings2,
  Sparkles, SquarePen, Sun, ThumbsDown, ThumbsUp, X, Zap,
} from 'lucide-react';

type ModelId =
  | 'moonex-lite-1.5' | 'moonex-fast-1.5' | 'moonex-pro-1.5'
  | 'moonex-pro-max-1.5' | 'moonex-ultra-1.5' | 'moonex-reasoning-1.5'
  | 'moonex-code-1.5' | 'moonex-vision-1.5' | 'moonex-research-1.5';
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: number };
type Conversation = { id: string; title: string; messages: ChatMessage[]; updatedAt: number };

const MODELS: { id: ModelId; name: string; detail: string; icon: typeof Sparkles }[] = [
  { id: 'moonex-lite-1.5', name: 'Moonex Lite', detail: 'Everyday questions, quick answers', icon: Sparkles },
  { id: 'moonex-fast-1.5', name: 'Moonex Fast', detail: 'Speed for everyday work', icon: Zap },
  { id: 'moonex-pro-1.5', name: 'Moonex Pro', detail: 'A balanced, capable assistant', icon: Layers3 },
  { id: 'moonex-pro-max-1.5', name: 'Moonex Pro Max', detail: 'More depth for complex tasks', icon: Sparkles },
  { id: 'moonex-ultra-1.5', name: 'Moonex Ultra', detail: 'Your most capable general model', icon: Sparkles },
  { id: 'moonex-reasoning-1.5', name: 'Moonex Reasoning', detail: 'Step-by-step problem solving', icon: Compass },
  { id: 'moonex-code-1.5', name: 'Moonex Code', detail: 'Software engineering and debugging', icon: Command },
  { id: 'moonex-vision-1.5', name: 'Moonex Vision', detail: 'Work with images and visual input', icon: ImagePlus },
  { id: 'moonex-research-1.5', name: 'Moonex Research', detail: 'Explore topics in depth', icon: Globe2 },
];

const STARTERS = [
  { icon: Compass, title: 'Explore an idea', prompt: 'Help me explore an idea and turn it into a practical plan.' },
  { icon: FileText, title: 'Write something', prompt: 'Help me write a clear, compelling piece. Ask me what it is for.' },
  { icon: Command, title: 'Build with code', prompt: 'Help me design and build a reliable software feature.' },
  { icon: Globe2, title: 'Learn something new', prompt: 'Teach me a useful topic from the ground up with examples.' },
];

const newConversation = (): Conversation => ({
  id: crypto.randomUUID(),
  title: 'New chat',
  messages: [],
  updatedAt: Date.now(),
});

function localReply(prompt: string, model: ModelId): string {
  const name = MODELS.find((item) => item.id === model)?.name ?? 'Moonex';
  return `I have your message. The Moonex chat interface is now in its frontend-foundation stage.

**Your request**
> ${prompt.length > 500 ? `${prompt.slice(0, 500)}…` : prompt}

**What happens next**

- The selected profile is **${name}**.
- The next integration step connects this conversation to the server-side AI orchestration API.
- Provider credentials will stay on the server; this interface does not expose or request API secrets.

This response is a local interface preview, not a live model response. The AI backend will be connected in a later implementation step.`;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timestamp);
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('moonex:conversations:v1');
      return saved ? JSON.parse(saved) as Conversation[] : [newConversation()];
    } catch {
      return [newConversation()];
    }
  });
  const [activeId, setActiveId] = useState(() => conversations[0]?.id ?? '');
  const [model, setModel] = useState<ModelId>('moonex-pro-1.5');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const activeModel = MODELS.find((item) => item.id === model) ?? MODELS[2];
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...conversations]
      .filter((item) => !q || item.title.toLowerCase().includes(q) || item.messages.some((m) => m.content.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [conversations, searchQuery]);

  useEffect(() => {
    try { localStorage.setItem('moonex:conversations:v1', JSON.stringify(conversations)); } catch { /* Storage may be unavailable. */ }
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeConversation?.messages.length, sending]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        startNewChat();
      }
      if (event.key === 'Escape') {
        setModelMenuOpen(false);
        setSearchOpen(false);
        setMobileSidebarOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function startNewChat() {
    const next = newConversation();
    setConversations((current) => [next, ...current]);
    setActiveId(next.id);
    setComposer('');
    setAttachmentName('');
    setMobileSidebarOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function updateConversation(id: string, updater: (conversation: Conversation) => Conversation) {
    setConversations((current) => current.map((conversation) => conversation.id === id ? updater(conversation) : conversation));
  }

  function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const prompt = composer.trim();
    if ((!prompt && !attachmentName) || sending || !activeConversation) return;
    const messageText = attachmentName ? (prompt ? `${prompt}\n\n[Attached file: ${attachmentName}]` : `[Attached file: ${attachmentName}]`) : prompt;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: messageText, createdAt: Date.now() };
    const conversationId = activeConversation.id;
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      title: conversation.messages.length === 0 ? (prompt || attachmentName).slice(0, 44) : conversation.title,
      messages: [...conversation.messages, userMessage],
      updatedAt: Date.now(),
    }));
    setComposer('');
    setAttachmentName('');
    setSending(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    window.setTimeout(() => {
      const reply: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: localReply(messageText, model), createdAt: Date.now() };
      updateConversation(conversationId, (conversation) => ({ ...conversation, messages: [...conversation.messages, reply], updatedAt: Date.now() }));
      setSending(false);
    }, 450);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(''), 1600);
    } catch { setCopiedId(''); }
  }

  function deleteConversation(id: string) {
    const remaining = conversations.filter((item) => item.id !== id);
    if (remaining.length === 0) {
      const next = newConversation();
      setConversations([next]);
      setActiveId(next.id);
    } else {
      setConversations(remaining);
      if (activeId === id) setActiveId(remaining[0].id);
    }
  }

  return (
    <div className={`moonex-app ${darkMode ? 'theme-dark' : 'theme-light'}`}>
      {mobileSidebarOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'} ${mobileSidebarOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-top">
          <button className="brand-mark" aria-label="Moonex home" onClick={startNewChat}>
            <span className="brand-symbol"><Sparkles size={20} strokeWidth={2.1} /></span>
            {sidebarOpen && <span className="brand-word">moonex<span className="brand-dot">.</span></span>}
          </button>
          <button className="icon-button sidebar-collapse" aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} onClick={() => setSidebarOpen((value) => !value)}>
            {sidebarOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
          </button>
        </div>

        <div className="sidebar-actions">
          <button className="sidebar-action primary-action" onClick={startNewChat} title="New chat">
            <SquarePen size={18} />{sidebarOpen && <><span>New chat</span><kbd>⌘ K</kbd></>}
          </button>
          <button className="sidebar-action" onClick={() => { setSearchOpen(true); setMobileSidebarOpen(false); }} title="Search chats">
            <Search size={18} />{sidebarOpen && <><span>Search chats</span><kbd>⌘ K</kbd></>}
          </button>
          <button className="sidebar-action" onClick={() => { setSettingsOpen(true); setMobileSidebarOpen(false); }} title="Settings">
            <Settings2 size={18} />{sidebarOpen && <span>Settings</span>}
          </button>
        </div>

        {sidebarOpen && (
          <div className="history-area">
            <div className="history-heading"><span>YOUR CHATS</span><button className="tiny-icon" aria-label="New chat" onClick={startNewChat}><Plus size={15} /></button></div>
            <div className="conversation-list">
              {filteredConversations.length === 0 ? <p className="empty-history">No matching conversations</p> : filteredConversations.map((conversation) => (
                <div className={`history-item ${conversation.id === activeId ? 'history-item-active' : ''}`} key={conversation.id}>
                  <button className="history-select" onClick={() => { setActiveId(conversation.id); setMobileSidebarOpen(false); }}>
                    <MessageSquare size={16} /><span>{conversation.title}</span>
                  </button>
                  <button className="history-delete" title="Delete conversation" aria-label={`Delete ${conversation.title}`} onClick={() => deleteConversation(conversation.id)}><MoreHorizontal size={17} /></button>
                </div>
              ))}
            </div>
            <div className="sidebar-spacer" />
            <div className="sidebar-promo">
              <div className="promo-icon"><Sparkles size={17} /></div>
              <div><strong>More room to think.</strong><p>Explore the Moonex experience.</p></div>
              <button aria-label="Learn more" onClick={() => setSettingsOpen(true)}><ArrowUp size={16} /></button>
            </div>
          </div>
        )}
        {!sidebarOpen && <div className="collapsed-spacer" />}
        <button className="profile-button" onClick={() => setSettingsOpen(true)} title="Account and settings">
          <span className="avatar">M</span>
          {sidebarOpen && <><span className="profile-copy"><strong>Moonex</strong><small>Personal workspace</small></span><Ellipsis size={18} className="profile-more" /></>}
        </button>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileSidebarOpen(true)}><Menu size={20} /></button>
            <div className="model-picker-wrap">
              <button className={`model-picker ${modelMenuOpen ? 'model-picker-open' : ''}`} onClick={() => setModelMenuOpen((value) => !value)} aria-expanded={modelMenuOpen}>
                <span className="model-picker-name">{activeModel.name}</span><span className="model-version">1.5</span><ChevronDown size={15} />
              </button>
              {modelMenuOpen && <>
                <button className="popover-dismiss" aria-label="Close model menu" onClick={() => setModelMenuOpen(false)} />
                <div className="model-menu">
                  <div className="model-menu-heading"><span>Choose a model</span><span className="model-count">9 profiles</span></div>
                  {MODELS.map((item) => {
                    const Icon = item.icon;
                    return <button className={`model-option ${model === item.id ? 'model-option-active' : ''}`} key={item.id} onClick={() => { setModel(item.id); setModelMenuOpen(false); }}>
                      <span className="model-option-icon"><Icon size={17} /></span><span className="model-option-copy"><strong>{item.name}</strong><small>{item.detail}</small></span>{model === item.id && <Check size={17} className="model-check" />}
                    </button>;
                  })}
                  <div className="model-menu-foot">Model availability depends on your workspace configuration.</div>
                </div>
              </>}
            </div>
          </div>
          <div className="topbar-right">
            <span className="beta-label"><span /> Preview</span>
            <button className="icon-button theme-toggle" aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="share-button" onClick={() => setSettingsOpen(true)}><Sparkles size={15} /> <span>Explore Moonex</span></button>
          </div>
        </header>

        <section className="chat-scroll-area" aria-label="Conversation">
          {!activeConversation?.messages.length ? (
            <div className="welcome-layout">
              <div className="welcome-orb"><div className="orb-ring orb-ring-one" /><div className="orb-ring orb-ring-two" /><div className="orb-core"><Sparkles size={30} strokeWidth={1.5} /></div><span className="orb-star orb-star-one">✳</span><span className="orb-star orb-star-two">✦</span></div>
              <div className="welcome-eyebrow"><span className="eyebrow-line" /> YOUR SPACE TO THINK <span className="eyebrow-line" /></div>
              <h1>Good to see you.<br /><span>What’s on your mind?</span></h1>
              <p className="welcome-description">A little clarity can change everything.<br className="desktop-break" /> Start with a question, an idea, or a challenge.</p>
              <div className="starter-grid">
                {STARTERS.map(({ icon: Icon, title, prompt }) => <button className="starter-card" key={title} onClick={() => { setComposer(prompt); textareaRef.current?.focus(); }}>
                  <span className="starter-icon"><Icon size={18} /></span><span className="starter-title">{title}</span><span className="starter-arrow"><ArrowDown size={15} /></span>
                </button>)}
              </div>
              <div className="welcome-footnote"><span className="footnote-spark"><Sparkles size={13} /></span> Thoughtful tools for the way you think.</div>
            </div>
          ) : (
            <div className="messages-wrap">
              <div className="conversation-context"><span className="context-dot" /> CONVERSATION <span className="context-separator">/</span> {activeModel.name.toUpperCase()}</div>
              {activeConversation.messages.map((message) => (
                <article className={`message-row message-${message.role}`} key={message.id}>
                  {message.role === 'assistant' && <div className="assistant-avatar"><Sparkles size={17} /></div>}
                  <div className="message-main">
                    {message.role === 'user' && <div className="message-role">You <span>{formatTime(message.createdAt)}</span></div>}
                    <div className={`message-content ${message.role === 'user' ? 'user-message-content' : 'assistant-message-content'}`}>
                      {message.role === 'assistant' ? <div className="markdown-preview">{message.content.split('\n').map((line, index) => {
                        if (line.startsWith('**') && line.endsWith('**')) return <h3 key={index}>{line.slice(2, -2)}</h3>;
                        if (line.startsWith('> ')) return <blockquote key={index}>{line.slice(2)}</blockquote>;
                        if (line.startsWith('- ')) return <p className="response-bullet" key={index}><span>•</span>{line.slice(2)}</p>;
                        return line ? <p key={index}>{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p> : <div className="response-gap" key={index} />;
                      })}</div> : message.content}
                    </div>
                    {message.role === 'assistant' && <div className="message-tools">
                      <button className="tool-button" onClick={() => copyMessage(message)} title="Copy response">{copiedId === message.id ? <Check size={15} /> : <Copy size={15} />}{copiedId === message.id && <span>Copied</span>}</button>
                      <button className="tool-button" title="Good response" onClick={(event) => { event.currentTarget.classList.toggle('tool-button-selected'); }}><ThumbsUp size={15} /></button>
                      <button className="tool-button" title="Needs improvement" onClick={(event) => { event.currentTarget.classList.toggle('tool-button-selected'); }}><ThumbsDown size={15} /></button>
                    </div>}
                  </div>
                </article>
              ))}
              {sending && <div className="typing-row"><div className="assistant-avatar"><Sparkles size={17} /></div><div className="typing-indicator"><span /><span /><span /></div></div>}
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        <div className="composer-dock">
          <form className="composer-shell" id="chat-input-box" onSubmit={sendMessage}>
            {attachmentName && <div className="attachment-chip"><FileText size={14} /><span>{attachmentName}</span><button type="button" aria-label="Remove attachment" onClick={() => setAttachmentName('')}><X size={13} /></button></div>}
            <textarea ref={textareaRef} id="chat-textarea" rows={1} value={composer} onChange={(event) => { setComposer(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`; }} onKeyDown={onComposerKeyDown} placeholder="Message Moonex..." aria-label="Message Moonex" />
            <div className="composer-controls">
              <div className="composer-tools">
                <input ref={fileRef} type="file" className="visually-hidden" onChange={(event) => setAttachmentName(event.target.files?.[0]?.name ?? '')} />
                <button type="button" className="composer-tool-button" title="Attach a file" onClick={() => fileRef.current?.click()}><Paperclip size={17} /><span className="tool-label">Attach</span></button>
                <span className="composer-divider" />
                <button type="button" className="composer-model-tag" onClick={() => setModelMenuOpen(true)}><Sparkles size={14} /><span>{activeModel.name}</span><ChevronDown size={13} /></button>
              </div>
              <div className="composer-submit-group">
                <span className="enter-hint">↵ <span>to send</span></span>
                <button type="submit" className="send-button" disabled={sending || (!composer.trim() && !attachmentName)} aria-label="Send message">{sending ? <AudioLines size={17} /> : <Send size={16} />}</button>
              </div>
            </div>
          </form>
          <p className="composer-disclaimer">Moonex can make mistakes. Check important information. <button onClick={() => setSettingsOpen(true)}>Learn more</button></p>
        </div>
      </main>

      {searchOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
        <section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search conversations">
          <div className="search-dialog-input"><Search size={19} /><input autoFocus placeholder="Search your conversations..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /><kbd>ESC</kbd><button className="tiny-icon" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={17} /></button></div>
          <div className="search-results-label">CONVERSATIONS</div>
          <div className="search-results">{filteredConversations.map((conversation) => <button key={conversation.id} onClick={() => { setActiveId(conversation.id); setSearchOpen(false); setSearchQuery(''); }}><MessageSquare size={17} /><span>{conversation.title}</span><span className="search-result-count">{conversation.messages.length} messages</span></button>)}
            {filteredConversations.length === 0 && <div className="search-empty">No conversations found. Try another search.</div>}
          </div>
          <div className="search-dialog-footer"><span><kbd>↵</kbd> Open conversation</span><span><kbd>ESC</kbd> Close</span></div>
        </section>
      </div>}

      {settingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
        <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Moonex settings">
          <div className="settings-header"><div><span className="settings-kicker">WORKSPACE</span><h2>Settings &amp; preferences</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={19} /></button></div>
          <div className="settings-profile"><span className="avatar avatar-large">M</span><div><strong>Moonex workspace</strong><p>Frontend preview · account integration pending</p></div></div>
          <div className="settings-section"><span className="settings-section-label">APPEARANCE</span><button className="settings-row" onClick={() => setDarkMode((value) => !value)}><span className="settings-row-icon">{darkMode ? <Moon size={18} /> : <Sun size={18} />}</span><span><strong>Theme</strong><small>{darkMode ? 'Dark mode' : 'Light mode'}</small></span><span className="settings-row-end">{darkMode ? 'Switch to light' : 'Switch to dark'} <ChevronDown size={14} /></span></button></div>
          <div className="settings-section"><span className="settings-section-label">AI MODELS</span><div className="settings-row"><span className="settings-row-icon"><Sparkles size={18} /></span><span><strong>Current model</strong><small>{activeModel.name}</small></span><span className="settings-row-end">{MODELS.length} profiles</span></div><div className="settings-note">Provider routing and live AI responses will be enabled when the server API is connected. API keys will never be stored in this browser interface.</div></div>
          <div className="settings-section"><span className="settings-section-label">SUPPORT</span><button className="settings-row" onClick={() => setSettingsOpen(false)}><span className="settings-row-icon"><CircleHelp size={18} /></span><span><strong>About this preview</strong><small>Moonex interface foundation</small></span><span className="settings-row-end">v0.1</span></button></div>
          <div className="settings-footer"><span className="settings-status-dot" /> Secure-by-design architecture planned <span className="settings-footer-brand">MOONEX</span></div>
        </section>
      </div>}
    </div>
  );
}
