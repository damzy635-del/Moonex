import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, Check, ChevronDown, LogIn, LogOut, Menu, MessageSquarePlus, Moon, PanelLeftClose, Search, Settings2, Sparkles, Sun, UserRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { MODEL_PROFILES } from "../packages/model-catalog/index";
import { supabase, supabaseConfigured } from "./lib/supabase";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Message[]; updated: number; model: string; persisted?: boolean };
type AuthMode = "signin" | "signup";

const starters = [
  ["✳", "Explore an idea", "Help me explore an idea and turn it into a practical plan."],
  ["⌘", "Write something", "Help me write something clear and well structured."],
  ["⌁", "Understand a topic", "Explain a complex topic in a simple, intuitive way."],
  ["↗", "Build a project", "Help me plan and build a software project step by step."],
];

const previewReply = "Your message is saved. Live AI responses are not connected yet; the next milestone is the server-side provider router.";

export default function App() {
  const { t } = useTranslation();
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(supabaseConfigured);
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState<string>(MODEL_PROFILES[2].id);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dataError, setDataError] = useState("");

  const loadChats = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from("conversations")
      .select("id,title,model_profile,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) { setDataError(error.message); return; }
    const ids = (rows ?? []).map((row) => row.id);
    const messagesResult = ids.length
      ? await supabase.from("messages").select("id,conversation_id,role,content,created_at").in("conversation_id", ids).order("created_at", { ascending: true })
      : { data: [], error: null };
    if (messagesResult.error) { setDataError(messagesResult.error.message); return; }
    const byConversation = new Map<string, Message[]>();
    for (const message of messagesResult.data ?? []) {
      const group = byConversation.get(message.conversation_id) ?? [];
      group.push({ id: message.id, role: message.role as Message["role"], content: message.content });
      byConversation.set(message.conversation_id, group);
    }
    const loaded: Chat[] = (rows ?? []).map((row) => ({
      id: row.id, title: row.title, model: row.model_profile, updated: new Date(row.updated_at).getTime(),
      messages: byConversation.get(row.id) ?? [], persisted: true,
    }));
    setChats((current) => [...loaded, ...current.filter((chat) => !chat.persisted)]);
    setDataError("");
  }, []);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let alive = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthError(error.message);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
      if (data.session?.user) void loadChats(data.session.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (event === "SIGNED_IN" && nextUser) void loadChats(nextUser.id);
      if (event === "SIGNED_OUT") {
        setChats((current) => current.filter((chat) => !chat.persisted));
        setActiveId(null);
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [loadChats]);

  const active = chats.find((chat) => chat.id === activeId);
  const filtered = useMemo(() => chats.filter((chat) => chat.title.toLowerCase().includes(query.toLowerCase())), [chats, query]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true); setAuthError(""); setAuthNotice("");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setAuthNotice("Account created. Check your email to confirm your address, then sign in.");
        else { setAuthNotice("Account created successfully."); setAuthOpen(false); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
        setAuthOpen(false); setAuthPassword("");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
    else { setSettingsOpen(false); setAuthError(""); }
  }

  async function sendMessage(value = draft) {
    const content = value.trim();
    if (!content) return;
    setDataError("");
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content };
    const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: previewReply };
    let conversationId = active?.id ?? crypto.randomUUID();
    let persisted = Boolean(user && supabase && active?.persisted);
    if (user && supabase) {
      try {
        if (!persisted) {
          const { data, error } = await supabase.from("conversations").insert({
            user_id: user.id, title: content.slice(0, 48) || "New chat", model_profile: model,
          }).select("id,title,model_profile,updated_at").single();
          if (error) throw error;
          conversationId = data.id;
        } else {
          const { error } = await supabase.from("conversations").update({
            title: active?.messages.length ? active.title : content.slice(0, 48),
            model_profile: model, updated_at: new Date().toISOString(),
          }).eq("id", conversationId).eq("user_id", user.id);
          if (error) throw error;
        }
        const { error: insertError } = await supabase.from("messages").insert([
          { conversation_id: conversationId, user_id: user.id, role: "user", content },
          { conversation_id: conversationId, user_id: user.id, role: "assistant", content: previewReply },
        ]);
        if (insertError) throw insertError;
        persisted = true;
      } catch (error) {
        setDataError(error instanceof Error ? error.message : "Could not save this conversation.");
        return;
      }
    }
    setChats((current) => {
      const old = current.find((chat) => chat.id === conversationId);
      const next: Chat = old
        ? { ...old, title: old.messages.length ? old.title : content.slice(0, 48), messages: [...old.messages, userMessage, assistantMessage], updated: Date.now(), model, persisted }
        : { id: conversationId, title: content.slice(0, 48), messages: [userMessage, assistantMessage], updated: Date.now(), model, persisted };
      return [next, ...current.filter((chat) => chat.id !== conversationId)];
    });
    setActiveId(conversationId); setDraft(""); setMobileNav(false);
  }

  const sidebar = <aside className="sidebar">
    <div className="brand-row"><div className="brand-mark"><Sparkles size={18} /></div><span className="brand-name">moonex</span><button className="icon-button sidebar-collapse" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"><PanelLeftClose size={17} /></button></div>
    <button className="new-chat" onClick={() => { setActiveId(null); setDraft(""); setMobileNav(false); }}><MessageSquarePlus size={17} /><span>{t("newChat")}</span><span className="shortcut">⌘ K</span></button>
    <label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} /></label>
    <div className="section-label">{t("recent")}</div>
    <nav className="chat-list">{filtered.map((chat) => <button key={chat.id} className={chat.id === activeId ? "chat-link active" : "chat-link"} onClick={() => { setActiveId(chat.id); setMobileNav(false); }}>{chat.title}</button>)}</nav>
    <div className="sidebar-bottom"><div className="profile"><div className="avatar">{user?.email?.[0]?.toUpperCase() ?? "M"}</div><div className="profile-copy"><strong>{user?.email ?? "Moonex"}</strong><small>{user ? "Synced workspace" : "Local preview"}</small></div><button className="icon-button" onClick={() => user ? setSettingsOpen(true) : (setAuthOpen(true), setAuthNotice(""), setAuthError(""))} aria-label={user ? "Settings" : "Sign in"}>{user ? <Settings2 size={17} /> : <LogIn size={17} />}</button></div></div>
  </aside>;

  return <div className={dark ? "app-shell dark" : "app-shell"}>
    {mobileNav && <div className="mobile-backdrop" onClick={() => setMobileNav(false)} />}
    {sidebarOpen && <div className={mobileNav ? "sidebar-wrap mobile-visible" : "sidebar-wrap"}>{sidebar}</div>}
    <main className="main-panel">
      <header className="topbar"><div className="topbar-left">
        <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button>
        {!sidebarOpen && <button className="icon-button desktop-menu" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><PanelLeftClose size={18} /></button>}
        <button className="model-picker" onClick={() => setModelOpen(!modelOpen)}><span>{MODEL_PROFILES.find((item) => item.id === model)?.label}</span><span className="model-version">1.5</span><ChevronDown size={15} /></button>
        {modelOpen && <div className="model-menu">{MODEL_PROFILES.map((item) => <button key={item.id} onClick={() => { setModel(item.id); setModelOpen(false); }}><span><strong>{item.label}</strong><small>{item.description}</small></span>{model === item.id && <Check size={16} />}</button>)}</div>}
      </div><div className="topbar-right">
        <button className="icon-button" onClick={() => user ? setSettingsOpen(true) : setAuthOpen(true)} aria-label={user ? "Settings" : "Sign in"}>{user ? <Settings2 size={17} /> : <UserRound size={17} />}</button>
        {!user && <button className="upgrade-button" onClick={() => { setAuthMode("signin"); setAuthOpen(true); }}>Sign in</button>}
        {user && <button className="upgrade-button" onClick={() => setSettingsOpen(true)}>Account ↗</button>}
      </div></header>
      <section className="conversation">
        {active ? <div className="messages">{active.messages.map((message) => <article key={message.id} className={message.role === "user" ? "message user-message" : "message assistant-message"}>{message.role === "assistant" && <div className="assistant-mark"><Sparkles size={15} /></div>}<div className="message-content">{message.content}</div></article>)}</div>
          : <div className="welcome"><div className="welcome-symbol"><Sparkles size={23} /></div><h1>{t("welcome")}</h1><p>{t("welcomeHint")}</p><div className="starter-grid">{starters.map(([icon, title, prompt]) => <button key={title} className="starter-card" onClick={() => void sendMessage(prompt)}><span className="starter-icon">{icon}</span><span><strong>{title}</strong><small>{prompt}</small></span><ArrowUp size={15} /></button>)}</div></div>}
      </section>
      {dataError && <div role="alert" className="inline-alert">{dataError}</div>}
      <footer className="composer-area"><div className="composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={t("placeholder")} rows={2} /><div className="composer-tools"><div className="composer-hint">＋ <span>Ask, create, explore</span></div><div className="composer-actions"><span className="selected-model">{MODEL_PROFILES.find((item) => item.id === model)?.label}</span><button className="send-button" disabled={!draft.trim()} onClick={() => void sendMessage()} aria-label={t("send")}><ArrowUp size={18} /></button></div></div></div><p className="disclaimer">{t("disclaimer")} · {user ? "Conversation history syncs to your account." : "Sign in to sync history across devices."} Live AI responses are not connected yet.</p></footer>
    </main>
    {settingsOpen && <div className="dialog-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-dialog" onClick={(event) => event.stopPropagation()}><header><div><h2>Account & settings</h2><p>{user?.email ?? "Workspace preferences"}</p></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button></header>
      <div className="settings-row"><div><strong>Appearance</strong><small>Choose your workspace theme</small></div><div className="theme-switch"><button className={!dark ? "chosen" : ""} onClick={() => setDark(false)}><Sun size={15} /> Light</button><button className={dark ? "chosen" : ""} onClick={() => setDark(true)}><Moon size={15} /> Dark</button></div></div>
      <div className="settings-row"><div><strong>Model profile</strong><small>{MODEL_PROFILES.find((item) => item.id === model)?.id}</small></div><span className="ready-label">UI preview</span></div>
      <div className="settings-note"><Settings2 size={16} /><span>{supabaseConfigured ? "Your account and chat history use Supabase Auth and row-level security." : "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable accounts and synced history."}</span></div>
      {user && <button className="new-chat account-signout" onClick={() => void signOut()}><LogOut size={16} /> Sign out</button>}
      {authError && <p className="auth-error" role="alert">{authError}</p>}
    </section></div>}
    {authOpen && <div className="dialog-backdrop" onClick={() => { setAuthOpen(false); setAuthError(""); }}><section className="settings-dialog auth-dialog" onClick={(event) => event.stopPropagation()}><header><div><h2>{authMode === "signin" ? "Sign in to Moonex" : "Create your account"}</h2><p>Keep your conversations synced across devices.</p></div><button className="icon-button" onClick={() => setAuthOpen(false)} aria-label="Close sign in"><X size={18} /></button></header>
      {!supabaseConfigured ? <div className="settings-note"><Settings2 size={16} /><span>Authentication is not configured yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to your environment, then redeploy.</span></div> : <>
        <form className="auth-form" onSubmit={(event) => void submitAuth(event)}><label>Email address<input type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={8} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 8 characters" /></label><button className="auth-submit" type="submit" disabled={authBusy || authLoading}>{authBusy ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"}</button></form>
        <p className="auth-toggle">{authMode === "signin" ? "New to Moonex?" : "Already have an account?"} <button onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); setAuthNotice(""); }}>{authMode === "signin" ? "Create account" : "Sign in"}</button></p>
      </>}
      {authNotice && <p className="auth-notice" role="status">{authNotice}</p>}{authError && <p className="auth-error" role="alert">{authError}</p>}
    </section></div>}
  </div>;
}
