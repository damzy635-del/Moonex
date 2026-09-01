import { Conversation, Project, UserPreferences, Artifact } from '../types';
import { AUTO_MODEL_ID, DEFAULT_MOONEX_MODEL_ID, normalizeMoonexModelId } from '../../lib/moonex-models';

const CONVERSATIONS_KEY = 'moonex_conversations_v1';
const PROJECTS_KEY = 'moonex_projects_v1';
const PREFERENCES_KEY = 'moonex_preferences_v1';
const DEFAULT_MODEL = AUTO_MODEL_ID;
const MODEL_FALLBACK = DEFAULT_MOONEX_MODEL_ID;

export const DEFAULT_PREFERENCES: UserPreferences = {
  userName: 'User', theme: 'dark', defaultModel: DEFAULT_MODEL, defaultThinkingLevel: 'none', defaultWebSearch: false,
  tone: 'balanced', customSystemInstructions: '', userContext: '', voiceName: 'Kore', soundEffects: true, autoScroll: true,
};

export const INITIAL_PROJECT: Project = {
  id: 'proj_default_intro', name: 'General Knowledge & Workspace', description: 'Shared knowledge space for general notes, prompts, and analysis.', icon: 'BookOpen', color: 'blue',
  customInstructions: 'Provide clear, structured, and helpful responses formatted with markdown.', knowledgeBase: [], createdAt: Date.now(), updatedAt: Date.now(),
};

export const INITIAL_CONVERSATION: Conversation = {
  id: 'conv_welcome', title: 'Welcome to Moonex', messages: [{ id: 'msg_welcome_1', role: 'assistant', content: `### Welcome to **Moonex** 🌙\n\nI'm Moonex, your AI assistant for reasoning, coding, research, writing, and multimodal work.\n\n**Auto** selects the best Moonex model for each request. You can still choose a specific Moonex model whenever you want.`, timestamp: Date.now(), modelUsed: DEFAULT_MODEL }],
  createdAt: Date.now(), updatedAt: Date.now(), model: DEFAULT_MODEL, thinkingLevel: 'none', enableWebSearch: false,
};

export function getSavedConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) { saveConversations([INITIAL_CONVERSATION]); return [INITIAL_CONVERSATION]; }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [INITIAL_CONVERSATION];
    return parsed.map((conversation: Conversation) => {
      const model = normalizeMoonexModelId(conversation.model, MODEL_FALLBACK);
      return { ...conversation, model, messages: Array.isArray(conversation.messages) ? conversation.messages.map((message) => message.role === 'assistant' ? { ...message, modelUsed: normalizeMoonexModelId(message.modelUsed, model) } : message) : [] };
    });
  } catch { return [INITIAL_CONVERSATION]; }
}
export function saveConversations(conversations: Conversation[]): void { try { localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations)); } catch (e) { console.error('Error saving conversations:', e); } }
export function getSavedProjects(): Project[] { try { const raw = localStorage.getItem(PROJECTS_KEY); if (!raw) { saveProjects([INITIAL_PROJECT]); return [INITIAL_PROJECT]; } const parsed = JSON.parse(raw); return Array.isArray(parsed) && parsed.length ? parsed : [INITIAL_PROJECT]; } catch { return [INITIAL_PROJECT]; } }
export function saveProjects(projects: Project[]): void { try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch (e) { console.error('Error saving projects:', e); } }
export function getSavedPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const saved = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...saved, defaultModel: normalizeMoonexModelId(saved.defaultModel, DEFAULT_MODEL) };
  } catch { return DEFAULT_PREFERENCES; }
}
export function savePreferences(preferences: UserPreferences): void { try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch (e) { console.error('Error saving preferences:', e); } }
export function exportAllData(): string { return JSON.stringify({ conversations: getSavedConversations(), projects: getSavedProjects(), preferences: getSavedPreferences(), exportedAt: new Date().toISOString(), version: '2.0' }, null, 2); }
export function importAllData(jsonString: string): boolean { try { const data = JSON.parse(jsonString); if (Array.isArray(data.conversations)) saveConversations(data.conversations); if (Array.isArray(data.projects)) saveProjects(data.projects); if (data.preferences) savePreferences(data.preferences); return true; } catch (e) { console.error('Import failed:', e); return false; } }
export function extractArtifactsFromText(text: string): Artifact[] { const artifacts: Artifact[] = []; const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g; let match; let count = 1; while ((match = codeBlockRegex.exec(text)) !== null) { const lang = (match[1] || 'text').toLowerCase(); const content = match[2].trim(); if (content.length > 20) { let type: Artifact['type'] = 'code'; let title = `Snippet ${count} (${lang.toUpperCase() || 'Text'})`; if (lang === 'html' || lang === 'svg') { type = lang === 'svg' ? 'svg' : 'html'; title = `Interactive Component ${count} (${lang.toUpperCase()})`; } else if (lang === 'json') { type = 'json'; title = `Structured Data ${count}`; } else if (lang === 'markdown' || lang === 'md') { type = 'markdown'; title = `Document ${count}`; } artifacts.push({ id: `art_${Date.now()}_${count}`, title, type, language: lang, content }); count++; } } return artifacts; }