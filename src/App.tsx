import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, Check, ChevronDown, Copy, ImagePlus, LogIn, LogOut, Menu, MessageSquarePlus, Moon, MoreHorizontal, PanelLeftClose, Pin, RotateCw, Search, Settings2, Sparkles, Sun, Trash2, UserRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { MODEL_PROFILES } from "../packages/model-catalog/index";
import { supabase, supabaseConfigured } from "./lib/supabase";

type Message = { id: string; role: "user" | "assistant"; content: string; images?: { id: string; name: string; preview: string }[] };
type Chat = { id: string; title: string; messages: Message[]; updated: number; model: string; persisted?: boolean };
type AuthMode = "signin" | "signup";
type SelectedImage = { id: string; name: string; mimeType: string; data: string; preview: string; bytes: number };
type SettingsTab = "general" | "personalization" | "data" | "notifications" | "about";
type LocalPreferences = {
  nickname: string; instructions: string; responseStyle: string; responseLength: string;
  enterToSend: boolean; compactMode: boolean; showModelInComposer: boolean;
  soundEffects: boolean; desktopNotifications: boolean; saveDrafts: boolean;
};
const DEFAULT_PREFERENCES: LocalPreferences = {
  nickname: "", instructions: "", responseStyle: "balanced", responseLength: "default",
  enterToSend: true, compactMode: false, showModelInComposer: true,
  soundEffects: false, desktopNotifications: false, saveDrafts: true,
};
function readPreferences(): LocalPreferences {
  try {
    const stored = window.localStorage.getItem("moonex-ui-preferences");
    return stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) as Partial<LocalPreferences> } : DEFAULT_PREFERENCES;
  } catch { return DEFAULT_PREFERENCES; }
}

const starters = [
  ["✳", "Explore an idea", "Help me explore an idea and turn it into a practical plan."],
  ["⌘", "Write something", "Help me write something clear and well structured."],
  ["⌁", "Understand a topic", "Explain a complex topic in a simple, intuitive way."],
  ["↗", "Build a project", "Help me plan and build a software project step by step."],
];

const previewReply = "This message is stored locally for preview. Sign in and configure the AI provider to get a live response.";

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(`{3}[\s\S]*?`{3}|`[^\n`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("[") && token.includes("](")) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link) nodes.push(<a key={`${keyPrefix}-${index++}`} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>);
      else nodes.push(token);
    } else if (token.startsWith("```")) {
      const body = token.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, "");
      nodes.push(<code key={`${keyPrefix}-${index++}`}>{body}</code>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={`${keyPrefix}-${index++}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={`${keyPrefix}-${index++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={`${keyPrefix}-${index++}`}>{token.slice(2, -2)}</del>);
    } else {
      nodes.push(<em key={`${keyPrefix}-${index++}`}>{token.slice(1, -1)}</em>);
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { text: string; ordered: boolean }[] = [];
  let code: string[] = [];
  let inCode = false;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={`p-${blocks.length}`}>{paragraph.map((line, i) => <Fragment key={i}>{i > 0 && <br />}{renderInlineMarkdown(line, `p-${blocks.length}-${i}`)}</Fragment>)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const ordered = list[0].ordered;
      const items = list;
      blocks.push(ordered
        ? <ol key={`ol-${blocks.length}`}>{items.map((item, i) => <li key={i}>{renderInlineMarkdown(item.text, `ol-${blocks.length}-${i}`)}</li>)}</ol>
        : <ul key={`ul-${blocks.length}`}>{items.map((item, i) => <li key={i}>{renderInlineMarkdown(item.text, `ul-${blocks.length}-${i}`)}</li>)}</ul>);
      list = [];
    }
  };
  const flushCode = () => {
    blocks.push(<pre key={`code-${blocks.length}`}><code>{code.join("\n")}</code></pre>);
    code = [];
  };
  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      flushParagraph(); flushList();
      if (inCode) { flushCode(); inCode = false; } else { inCode = true; }
      return;
    }
    if (inCode) { code.push(line); return; }
    if (!line.trim()) { flushParagraph(); flushList(); return; }
    if (/^\s*([-*_])(?:\s*\\1){2,}\s*$/.test(line)) { flushParagraph(); flushList(); blocks.push(<hr key={`hr-${blocks.length}`} />); return; }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      const children = renderInlineMarkdown(heading[2], `h-${blocks.length}`);
      if (level === 1) blocks.push(<h1 key={blocks.length}>{children}</h1>);
      else if (level === 2) blocks.push(<h2 key={blocks.length}>{children}</h2>);
      else if (level === 3) blocks.push(<h3 key={blocks.length}>{children}</h3>);
      else if (level === 4) blocks.push(<h4 key={blocks.length}>{children}</h4>);
      else if (level === 5) blocks.push(<h5 key={blocks.length}>{children}</h5>);
      else blocks.push(<h6 key={blocks.length}>{children}</h6>);
      return;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      list.push({ text: (bullet ?? numbered)![1], ordered: Boolean(numbered) });
      return;
    }
    flushList();
    paragraph.push(line);
  });
  flushParagraph(); flushList();
  if (inCode) flushCode();
  return <div className="markdown-content">{blocks}</div>;
}


export default function App() {
  const { t } = useTranslation();
  const [dark, setDark] = useState(() => window.localStorage.getItem("moonex-theme") === "dark");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [preferences, setPreferences] = useState<LocalPreferences>(readPreferences);
  const [settingsNotice, setSettingsNotice] = useState("");
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
  const [draft, setDraft] = useState(() => { try { return window.localStorage.getItem("moonex-draft") ?? ""; } catch { return ""; } });
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [pinnedChats, setPinnedChats] = useState<string[]>(() => { try { return JSON.parse(window.localStorage.getItem("moonex-pinned-chats") ?? "[]") as string[]; } catch { return []; } });
  const [chatMenuId, setChatMenuId] = useState<string | null>(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dataError, setDataError] = useState("");
  const [sending, setSending] = useState(false);
  const requestController = useRef<AbortController | null>(null);

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
    // Restore the last selected conversation for this account after refresh/sign-in.
    const savedActiveId = window.localStorage.getItem(`moonex-active-chat:${userId}`);
    if (savedActiveId === "__new__") {
      setActiveId(null);
    } else if (savedActiveId && loaded.some((chat) => chat.id === savedActiveId)) {
      setActiveId((current) => current && loaded.some((chat) => chat.id === current) ? current : savedActiveId);
    } else if (loaded.length) {
      setActiveId((current) => current && loaded.some((chat) => chat.id === current) ? current : loaded[0].id);
    }
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
  useEffect(() => { window.localStorage.setItem("moonex-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { window.localStorage.setItem("moonex-ui-preferences", JSON.stringify(preferences)); }, [preferences]);
  useEffect(() => { window.localStorage.setItem("moonex-pinned-chats", JSON.stringify(pinnedChats)); }, [pinnedChats]);
  useEffect(() => { document.querySelector(".app-shell")?.classList.toggle("compact-mode", preferences.compactMode); }, [preferences.compactMode]);
  useEffect(() => { if (preferences.saveDrafts) window.localStorage.setItem("moonex-draft", draft); else window.localStorage.removeItem("moonex-draft"); }, [draft, preferences.saveDrafts]);
  const updatePreference = <K extends keyof LocalPreferences>(key: K, value: LocalPreferences[K]) => setPreferences((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    if (user && activeId) window.localStorage.setItem(`moonex-active-chat:${user.id}`, activeId);
  }, [activeId, user]);
  const filtered = useMemo(() => chats.filter((chat) => chat.title.toLowerCase().includes(query.toLowerCase())).sort((a,b) => Number(pinnedChats.includes(b.id))-Number(pinnedChats.includes(a.id)) || b.updated-a.updated), [chats, query, pinnedChats]);

  async function renameChat(chat: Chat) {
    const nextTitle = window.prompt("Rename conversation", chat.title)?.trim();
    if (!nextTitle || nextTitle === chat.title) return;
    if (chat.persisted && user && supabase) {
      const { error } = await supabase.from("conversations").update({ title: nextTitle.slice(0, 120) }).eq("id", chat.id).eq("user_id", user.id);
      if (error) { setDataError(`Could not rename conversation: ${error.message}`); return; }
    }
    setChats((current) => current.map((item) => item.id === chat.id ? { ...item, title: nextTitle.slice(0,120) } : item));
    setChatMenuId(null);
  }

  async function deleteChat(chat: Chat) {
    if (!window.confirm(`Delete “${chat.title}”? This cannot be undone.`)) return;
    if (chat.persisted && user && supabase) {
      const { error } = await supabase.from("conversations").delete().eq("id", chat.id).eq("user_id", user.id);
      if (error) { setDataError(`Could not delete conversation: ${error.message}`); return; }
    }
    setChats((current) => current.filter((item) => item.id !== chat.id));
    setPinnedChats((current) => current.filter((id) => id !== chat.id));
    if (activeId === chat.id) {
      setActiveId(null);
      if (user) window.localStorage.setItem(`moonex-active-chat:${user.id}`, "__new__");
    }
    setChatMenuId(null);
  }

  async function copyMessage(content: string) {
    try { await navigator.clipboard.writeText(content); setMessageNotice("Copied to clipboard"); }
    catch { setMessageNotice("Clipboard access is unavailable in this browser."); }
    window.setTimeout(() => setMessageNotice(""), 2200);
  }

  function retryResponse(chat: Chat, messageIndex: number) {
    if (sending) return;
    const previousUser = [...chat.messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user");
    if (!previousUser) return;
    if (previousUser.images?.length) {
      setMessageNotice("This prompt included images that cannot be restored for regeneration. Edit and reattach the images instead.");
      window.setTimeout(() => setMessageNotice(""), 4500);
      return;
    }
    setActiveId(chat.id);
    setEditingMessageId(previousUser.id);
    setMessageNotice("Regenerating this response and replacing later messages…");
    window.setTimeout(() => setMessageNotice(""), 3500);
    void sendMessage(previousUser.content, previousUser.id);
  }

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

  function editMessage(chat: Chat, message: Message) {
    if (message.role !== "user" || sending) return;
    setActiveId(chat.id);
    setEditingMessageId(message.id);
    setDraft(message.content);
    setMessageNotice("Editing this prompt will replace it and remove the later replies in this conversation.");
    window.setTimeout(() => setMessageNotice(""), 4500);
    document.querySelector(".composer textarea")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function sendMessage(value = draft, editMessageId: string | null = editingMessageId) {
    const content = value.trim();
    if (!content || sending) return;
    if (selectedImages.length && model !== "moonex-vision-1.5") {
      setDataError("Select the Vision 1.5 profile before sending images.");
      return;
    }
    if (model === "moonex-vision-1.5" && selectedImages.length === 0) {
      setDataError("Attach at least one image to use Vision 1.5.");
      return;
    }
    setDataError("");
    setSending(true);
    const controller = new AbortController();
    requestController.current = controller;
    let partialAssistantText = "";
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content, ...(selectedImages.length ? { images: selectedImages.map(({ id, name, preview }) => ({ id, name, preview })) } : {}) };
    const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: user && supabase ? "Thinking…" : previewReply };
    let conversationId = active?.id ?? crypto.randomUUID();
    const editingIndex = editMessageId && active ? active.messages.findIndex((message) => message.id === editMessageId) : -1;
    const isEditing = editingIndex >= 0 && Boolean(active);
    let persisted = Boolean(user && supabase && active?.persisted);
    let assistantSaved = false;
    const persistInterruptedResponse = async (text: string) => {
      const stoppedContent = text.trim() ? `${text}\n\n*Generation stopped.*` : "Generation stopped.";
      if (text.trim() && user && supabase && persisted && !assistantSaved) {
        const { data, error } = await supabase.from("messages").insert({
          conversation_id: conversationId, user_id: user.id, role: "assistant", content: stoppedContent,
        }).select("id").single();
        if (error) throw error;
        assistantSaved = true;
        setChats((current) => current.map((chat) => chat.id !== conversationId ? chat : {
          ...chat, messages: chat.messages.map((item) => item.id === assistantMessage.id ? { ...item, id: data.id, content: stoppedContent } : item),
        }));
      } else {
        setChats((current) => current.map((chat) => chat.id !== conversationId ? chat : {
          ...chat, messages: chat.messages.map((item) => item.id === assistantMessage.id ? { ...item, content: stoppedContent } : item),
        }));
      }
    };

    try {
      if (isEditing && active) {
        if (persisted && user && supabase) {
          const removeIds = active.messages.slice(editingIndex).map((message) => message.id);
          if (removeIds.length) {
            const { error } = await supabase.from("messages").delete().eq("conversation_id", conversationId).eq("user_id", user.id).in("id", removeIds);
            if (error) throw new Error(`Could not replace this prompt: ${error.message}`);
          }
        }
        setChats((current) => current.map((chat) => chat.id !== conversationId ? chat : { ...chat, messages: chat.messages.slice(0, editingIndex) }));
      }

      if (user && supabase) {
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
        const { data: savedUser, error: insertError } = await supabase.from("messages").insert({
          conversation_id: conversationId, user_id: user.id, role: "user", content,
        }).select("id").single();
        if (insertError) throw insertError;
        userMessage.id = savedUser.id;
        persisted = true;
      }

      setChats((current) => {
        const old = current.find((chat) => chat.id === conversationId);
        const baseMessages = old ? (isEditing ? old.messages.slice(0, editingIndex) : old.messages) : [];
        const next: Chat = old
          ? { ...old, title: baseMessages.length ? old.title : content.slice(0, 48), messages: [...baseMessages, userMessage, assistantMessage], updated: Date.now(), model, persisted }
          : { id: conversationId, title: content.slice(0, 48), messages: [userMessage, assistantMessage], updated: Date.now(), model, persisted };
        return [next, ...current.filter((chat) => chat.id !== conversationId)];
      });
      setActiveId(conversationId); setDraft(""); setEditingMessageId(null); setMobileNav(false);

      if (!user || !supabase) return;

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your session expired. Sign in again to continue.");

      const context = (active?.messages.slice(0, isEditing ? editingIndex : undefined) ?? [])
        .filter((message) => message.content !== previewReply && message.content !== "Thinking…")
        .map((message) => ({ role: message.role, content: message.content }));
      context.push(userMessage);

      if (controller.signal.aborted) {
        await persistInterruptedResponse(partialAssistantText);
        return;
      }
      const apiResponse = await fetch("/api/v1/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ modelProfile: model, messages: context, ...(selectedImages.length ? { images: selectedImages.map(({ mimeType, data }) => ({ mimeType, data })) } : {}) }),
      });
      if (!apiResponse.ok) {
        const body = await apiResponse.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Chat request failed (${apiResponse.status}).`);
      }
      if (!apiResponse.body) throw new Error("Streaming is not supported by this response.");

      const reader = apiResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      const updateAssistant = (text: string) => setChats((current) => current.map((chat) => chat.id !== conversationId ? chat : {
        ...chat,
        messages: chat.messages.map((message) => message.id === assistantMessage.id ? { ...message, content: text } : message),
      }));

      try {
        while (true) {
          const { value: chunk, done } = await reader.read();
          buffer += decoder.decode(chunk, { stream: !done });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const eventName = frame.split(/\r?\n/).find((line) => line.startsWith("event:"))?.slice(6).trim();
            const dataLine = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
            if (!dataLine) continue;
            const payload = JSON.parse(dataLine) as { text?: string; message?: string };
            if (eventName === "delta" && typeof payload.text === "string") {
              assistantText += payload.text;
              partialAssistantText = assistantText;
              updateAssistant(assistantText);
            } else if (eventName === "error") {
              throw new Error(payload.message ?? "The AI provider failed.");
            }
          }
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }

      if (controller.signal.aborted) {
        await persistInterruptedResponse(assistantText);
        return;
      }
      if (!assistantText.trim()) throw new Error("The AI provider returned an empty response.");
      setSelectedImages([]);
      const { data: savedAssistant, error: saveAssistantError } = await supabase.from("messages").insert({
        conversation_id: conversationId, user_id: user.id, role: "assistant", content: assistantText,
      }).select("id").single();
      if (saveAssistantError) throw saveAssistantError;
      assistantSaved = true;
      setChats((current) => current.map((chat) => chat.id !== conversationId ? chat : {
        ...chat,
        messages: chat.messages.map((message) => message.id === assistantMessage.id ? { ...message, id: savedAssistant.id, content: assistantText } : message),
      }));
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        try {
          await persistInterruptedResponse(partialAssistantText);
        } catch (saveError) {
          const reason = saveError instanceof Error ? saveError.message : "unknown persistence error";
          setDataError(`Generation stopped, but the partial response could not be saved: ${reason}`);
          setChats((current) => current.map((chat) => chat.id !== conversationId ? chat : {
            ...chat, messages: chat.messages.map((item) => item.id === assistantMessage.id ? { ...item, content: partialAssistantText ? `${partialAssistantText}\n\n*Generation stopped (not saved).*` : "Generation stopped (not saved)." } : item),
          }));
        }
        return;
      }
      const message = error instanceof Error ? error.message : "Could not send this message.";
      setDataError(message);
      setChats((current) => current.map((chat) => chat.id !== conversationId ? chat : {
        ...chat,
        messages: chat.messages.map((item) => item.id === assistantMessage.id ? { ...item, content: `Moonex couldn't complete this response: ${message}` } : item),
      }));
    } finally {
      if (requestController.current === controller) requestController.current = null;
      setSending(false);
    }
  }

  const sidebar = <aside className="sidebar">
    <div className="brand-row"><div className="brand-mark"><Sparkles size={18} /></div><span className="brand-name">moonex</span><button className="icon-button sidebar-collapse" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"><PanelLeftClose size={17} /></button></div>
    <button className="new-chat" onClick={() => { setEditingMessageId(null); setActiveId(null); if (user) window.localStorage.setItem(`moonex-active-chat:${user.id}`, "__new__"); setDraft(""); setMobileNav(false); }}><MessageSquarePlus size={17} /><span>{t("newChat")}</span><span className="shortcut">⌘ K</span></button>
    <label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} /></label>
    <div className="section-label">{t("recent")}</div>
    <nav className="chat-list">{filtered.map((chat) => <div key={chat.id} className={chat.id === activeId ? "chat-row active" : "chat-row"}><button className="chat-link" title={chat.title} onClick={() => { setActiveId(chat.id); setMobileNav(false); setChatMenuId(null); }}>{pinnedChats.includes(chat.id) && <Pin size={12} className="chat-pin-indicator" />}{chat.title}</button><button className="chat-more" aria-label={`Options for ${chat.title}`} aria-expanded={chatMenuId===chat.id} onClick={() => setChatMenuId((current)=>current===chat.id?null:chat.id)}><MoreHorizontal size={16}/></button>{chatMenuId===chat.id && <div className="chat-context-menu"><button onClick={()=>{setPinnedChats((current)=>current.includes(chat.id)?current.filter((id)=>id!==chat.id):[...current,chat.id]);setChatMenuId(null);}}><Pin size={14}/>{pinnedChats.includes(chat.id)?"Unpin conversation":"Pin conversation"}</button><button onClick={()=>void renameChat(chat)}><span className="menu-letter">Aa</span>Rename</button><button className="danger-action" onClick={()=>void deleteChat(chat)}><Trash2 size={14}/>Delete</button></div>}</div>)}</nav>
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
        {active ? <div className="messages">{active.messages.map((message, index) => <article key={message.id} className={message.role === "user" ? "message user-message" : "message assistant-message"}>{message.role === "assistant" && <div className="assistant-mark"><Sparkles size={15} /></div>}<div className="message-column"><div className="message-content">{message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <>{message.images?.length ? <div className="sent-image-list">{message.images.map((image) => <figure className="sent-image" key={image.id}><img src={image.preview} alt={image.name} /><figcaption>{image.name}</figcaption></figure>)}</div> : null}<div>{message.content}</div></>}</div><div className="message-actions"><button title="Copy message" aria-label="Copy message" onClick={()=>void copyMessage(message.content)}><Copy size={14}/></button>{message.role==="assistant" && <button title="Regenerate response" aria-label="Regenerate response" disabled={sending} onClick={()=>retryResponse(active,index)}><RotateCw size={14}/></button>}{message.role==="user" && <button title="Edit and resend" aria-label="Edit and resend" disabled={sending} onClick={()=>editMessage(active,message)}><span className="menu-letter">✎</span></button>}</div></div></article>)}</div>
          : <div className="welcome"><div className="welcome-symbol"><Sparkles size={23} /></div><h1>{t("welcome")}</h1><p>{t("welcomeHint")}</p><div className="starter-grid">{starters.map(([icon, title, prompt]) => <button key={title} className="starter-card" onClick={() => void sendMessage(prompt)}><span className="starter-icon">{icon}</span><span><strong>{title}</strong><small>{prompt}</small></span><ArrowUp size={15} /></button>)}</div></div>}
      </section>
      {dataError && <div role="alert" className="inline-alert">{dataError}</div>}{messageNotice && <div role="status" className="message-notice">{messageNotice}</div>}
      <footer className="composer-area">{editingMessageId && <div className="editing-banner"><span>Editing message — later messages will be replaced when you resend.</span><button type="button" onClick={() => { setEditingMessageId(null); setDraft(""); }} aria-label="Cancel editing"><X size={14}/> Cancel</button></div>}<div className="composer"><input className="image-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden id="moonex-image-upload" disabled={sending} onChange={async (event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (!files.length) return; if (model !== "moonex-vision-1.5") { setDataError("Select the Vision 1.5 profile before attaching images."); return; } if (selectedImages.length + files.length > 4) { setDataError("Attach no more than 4 images."); return; } const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]); const next: SelectedImage[] = []; for (const file of files) { if (!allowed.has(file.type)) { setDataError("Images must be JPEG, PNG, WebP, or GIF."); return; } if (file.size <= 0 || file.size > 1_000_000) { setDataError("Each image must be no larger than 1 MB."); return; } const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image.")); reader.onerror = () => reject(new Error("Could not read image.")); reader.readAsDataURL(file); }); const comma = dataUrl.indexOf(","); next.push({ id: crypto.randomUUID(), name: file.name, mimeType: file.type, data: dataUrl.slice(comma + 1), preview: dataUrl, bytes: file.size }); } if ([...selectedImages, ...next].reduce((sum, item) => sum + item.bytes, 0) > 3_000_000) { setDataError("Combined image size must not exceed 3 MB."); return; } setSelectedImages((current) => [...current, ...next]); setDataError(""); }} /><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (preferences.enterToSend && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={t("placeholder")} rows={2} disabled={sending} />{selectedImages.length > 0 && <div className="image-preview-list" aria-label="Selected images">{selectedImages.map((image) => <div className="image-preview" key={image.id}><img src={image.preview} alt={image.name} /><span title={image.name}>{image.name}</span><button type="button" onClick={() => setSelectedImages((current) => current.filter((item) => item.id !== image.id))} aria-label={`Remove ${image.name}`}><X size={13} /></button></div>)}</div>}<div className="composer-tools"><div className="composer-hint"><label className="attach-image" htmlFor="moonex-image-upload" title={model === "moonex-vision-1.5" ? "Attach images" : "Select Vision 1.5 to attach images"}><ImagePlus size={16} /><span>Images</span></label><span>Ask, create, explore</span></div><div className="composer-actions">{preferences.showModelInComposer && <span className="selected-model">{MODEL_PROFILES.find((item) => item.id === model)?.label}</span>}{sending ? <button className="send-button stop-button" type="button" onClick={() => requestController.current?.abort()} aria-label="Stop generation" title="Stop generation"><X size={17} /></button> : <button className="send-button" disabled={!draft.trim()} onClick={() => void sendMessage()} aria-label={t("send")}><ArrowUp size={18} /></button>}</div></div></div><p className="disclaimer">{t("disclaimer")} · {user ? "Conversation history syncs to your account." : "Sign in to sync history across devices."} {sending ? "Generating a response…" : "Live AI is available for supported profiles when provider credentials are configured."}</p></footer>
    </main>
    {settingsOpen && <div className="dialog-backdrop settings-backdrop" onClick={() => { setSettingsOpen(false); setSettingsNotice(""); }}><section className="settings-dialog settings-workspace" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}>
      <header className="settings-heading"><div><span className="settings-eyebrow">MOONEX WORKSPACE</span><h2 id="settings-title">Settings</h2><p>Make Moonex work the way you do.</p></div><button className="icon-button" onClick={() => { setSettingsOpen(false); setSettingsNotice(""); }} aria-label="Close settings"><X size={18} /></button></header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {([{id:"general",label:"General",symbol:"◈"},{id:"personalization",label:"Personalization",symbol:"✳"},{id:"data",label:"Data & privacy",symbol:"◇"},{id:"notifications",label:"Notifications",symbol:"♧"},{id:"about",label:"About Moonex",symbol:"ⓘ"}] as {id:SettingsTab;label:string;symbol:string}[]).map((item) => <button key={item.id} className={settingsTab===item.id?"settings-nav-item selected":"settings-nav-item"} onClick={() => {setSettingsTab(item.id);setSettingsNotice("");}}><span>{item.symbol}</span>{item.label}</button>)}
          <div className="settings-account-card"><div className="avatar">{user?.email?.[0]?.toUpperCase() ?? "M"}</div><div><strong>{user?.email ?? "Guest workspace"}</strong><small>{user ? "Signed in" : "Preferences stored on this device"}</small></div></div>
        </nav>
        <div className="settings-content">
          {settingsTab==="general" && <div className="settings-section"><h3>General</h3><p className="settings-description">Control how the workspace looks and behaves.</p>
            <div className="settings-option"><div><strong>Appearance</strong><small>Choose your preferred colour theme.</small></div><div className="theme-switch"><button className={!dark?"chosen":""} onClick={() => setDark(false)}><Sun size={15}/>Light</button><button className={dark?"chosen":""} onClick={() => setDark(true)}><Moon size={15}/>Dark</button></div></div>
            <div className="settings-option"><div><strong>Compact layout</strong><small>Reduce spacing in the chat workspace.</small></div><button role="switch" aria-checked={preferences.compactMode} className={preferences.compactMode?"toggle-switch on":"toggle-switch"} onClick={() => {updatePreference("compactMode",!preferences.compactMode);document.querySelector(".app-shell")?.classList.toggle("compact-mode",!preferences.compactMode);}}><span/></button></div>
            <div className="settings-option"><div><strong>Press Enter to send</strong><small>Use Shift + Enter to add a new line.</small></div><button role="switch" aria-checked={preferences.enterToSend} className={preferences.enterToSend?"toggle-switch on":"toggle-switch"} onClick={() => updatePreference("enterToSend",!preferences.enterToSend)}><span/></button></div>
            <div className="settings-option"><div><strong>Show selected model</strong><small>Display the active model beside the message box.</small></div><button role="switch" aria-checked={preferences.showModelInComposer} className={preferences.showModelInComposer?"toggle-switch on":"toggle-switch"} onClick={() => updatePreference("showModelInComposer",!preferences.showModelInComposer)}><span/></button></div>
            <div className="settings-option"><div><strong>Save drafts locally</strong><small>Keep unfinished prompts on this device.</small></div><button role="switch" aria-checked={preferences.saveDrafts} className={preferences.saveDrafts?"toggle-switch on":"toggle-switch"} onClick={() => updatePreference("saveDrafts",!preferences.saveDrafts)}><span/></button></div>
          </div>}
          {settingsTab==="personalization" && <div className="settings-section"><h3>Personalization</h3><p className="settings-description">Set your preferred name and response defaults. These preferences are saved on this device.</p>
            <label className="settings-field"><span>What should Moonex call you?</span><input value={preferences.nickname} onChange={(event)=>updatePreference("nickname",event.target.value)} placeholder="Your preferred name (optional)" maxLength={80}/></label>
            <label className="settings-field"><span>Custom instructions</span><textarea value={preferences.instructions} onChange={(event)=>updatePreference("instructions",event.target.value)} placeholder="Share context or preferences you'd like Moonex to keep in mind…" rows={5} maxLength={4000}/><small>{preferences.instructions.length}/4000 characters · Saved locally; not yet sent to the AI.</small></label>
            <label className="settings-field"><span>Base response style</span><select value={preferences.responseStyle} onChange={(event)=>updatePreference("responseStyle",event.target.value)}><option value="balanced">Balanced</option><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="direct">Direct and concise</option><option value="creative">Creative</option><option value="academic">Academic</option></select></label>
            <label className="settings-field"><span>Default response length</span><select value={preferences.responseLength} onChange={(event)=>updatePreference("responseLength",event.target.value)}><option value="default">Model default</option><option value="concise">Concise</option><option value="balanced">Balanced detail</option><option value="detailed">Detailed</option></select></label>
            <div className="settings-preview-note">These controls are saved now, but response style, custom instructions, and length will not affect AI replies until the chat API is wired to use them.</div>
          </div>}
          {settingsTab==="data" && <div className="settings-section"><h3>Data & privacy</h3><p className="settings-description">Understand what is stored and manage your local preferences.</p>
            <div className="settings-info-card"><strong>Workspace preferences</strong><p>Theme and settings are stored in this browser's local storage. They are not synced between devices.</p><span className="status-chip">Stored on this device</span></div>
            <div className="settings-info-card"><strong>Conversation history</strong><p>{user?"Your signed-in conversations are stored in your Moonex account. Export below creates a local JSON copy.":"Guest preview conversations may only exist in this open session; they are not backed up to an account."}</p></div>
            <button className="settings-secondary-button" onClick={() => {const payload={exportedAt:new Date().toISOString(),preferences,conversations:chats.map(({id,title,messages,updated,model})=>({id,title,messages,updated,model}))};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="moonex-workspace-export.json";anchor.click();URL.revokeObjectURL(url);setSettingsNotice("Workspace export prepared as a JSON file.");}}>Export workspace data (.json)</button>
            <button className="settings-secondary-button" onClick={() => {setPreferences(DEFAULT_PREFERENCES);setDark(false);document.querySelector(".app-shell")?.classList.remove("compact-mode");setSettingsNotice("Local preferences reset to defaults.");}}>Reset local preferences</button>
            <p className="settings-footnote">Resetting preferences does not delete account conversations or server data.</p>
          </div>}
          {settingsTab==="notifications" && <div className="settings-section"><h3>Notifications</h3><p className="settings-description">Choose how Moonex should notify you. Browser and sound integrations are not connected yet.</p>
            <div className="settings-option"><div><strong>Sound effects</strong><small>Enable response and interaction sounds when supported.</small></div><button role="switch" aria-checked={preferences.soundEffects} className={preferences.soundEffects?"toggle-switch on":"toggle-switch"} onClick={() => updatePreference("soundEffects",!preferences.soundEffects)}><span/></button></div>
            <div className="settings-option"><div><strong>Desktop notifications</strong><small>Allow browser notifications for completed responses.</small></div><button role="switch" aria-checked={preferences.desktopNotifications} className={preferences.desktopNotifications?"toggle-switch on":"toggle-switch"} onClick={() => updatePreference("desktopNotifications",!preferences.desktopNotifications)}><span/></button></div>
            <div className="settings-preview-note">Your choices are saved locally. Notifications and sound are visual preference placeholders until implemented.</div>
          </div>}
          {settingsTab==="about" && <div className="settings-section"><h3>About Moonex</h3><p className="settings-description">Your AI workspace, built to make thinking and building feel effortless.</p>
            <div className="settings-info-card"><div className="about-brand"><span className="brand-mark"><Sparkles size={17}/></span><div><strong>Moonex</strong><small>AI workspace</small></div></div><p>Current workspace build · UI preferences are stored locally.</p><span className="status-chip">Frontend settings preview</span></div>
            <div className="settings-option"><div><strong>Account</strong><small>{user?.email ?? "Not signed in"}</small></div>{user?<button className="settings-inline-button" onClick={() => void signOut()}><LogOut size={14}/>Sign out</button>:<button className="settings-inline-button" onClick={()=>{setSettingsOpen(false);setAuthOpen(true);setAuthNotice("");setAuthError("");}}>Sign in</button>}</div>
            <div className="settings-info-card"><strong>Feature status</strong><p>Theme, layout, keyboard behaviour, model visibility and local preference storage work in this build. Notification delivery, cloud preference sync and applying personalization to model requests still need implementation.</p></div>
          </div>}
          {settingsNotice && <p className="settings-status-message" role="status">{settingsNotice}</p>}
        </div>
      </div>
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
