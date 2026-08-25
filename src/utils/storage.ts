import { Conversation, Project, UserPreferences, Artifact } from '../types';

const CONVERSATIONS_KEY = 'my_ai_conversations_v1';
const PROJECTS_KEY = 'my_ai_projects_v1';
const PREFERENCES_KEY = 'my_ai_preferences_v1';

export const DEFAULT_PREFERENCES: UserPreferences = {
  userName: 'User',
  theme: 'dark',
  defaultModel: 'gemini-3.7-flash',
  defaultThinkingLevel: 'none',
  defaultWebSearch: false,
  tone: 'balanced',
  customSystemInstructions: '',
  userContext: '',
  voiceName: 'Kore',
  soundEffects: true,
  autoScroll: true,
};

export const INITIAL_PROJECT: Project = {
  id: 'proj_default_intro',
  name: 'General Knowledge & Workspace',
  description: 'Shared knowledge space for general notes, prompts, and analysis.',
  icon: 'BookOpen',
  color: 'blue',
  customInstructions: 'Provide clear, structured, and helpful responses formatted with markdown.',
  knowledgeBase: [
    {
      id: 'kb_welcome_guide',
      name: 'Getting Started Guide.md',
      type: 'markdown',
      content: '# Welcome to My AI Model\n\nMy AI Model is your intelligent personal companion for coding, research, writing, multimodal analysis, and project execution.\n\n### Key Features\n- **Deep Thinking**: Toggle reasoning mode for math, algorithms, and logical puzzles.\n- **Web Search**: Ground answers with current web facts and citations.\n- **Interactive Artifacts**: Code snippets, HTML previews, and documents open in a dedicated side canvas.\n- **Projects**: Group your work with customized context and files.',
      size: 612,
      uploadedAt: Date.now(),
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const INITIAL_CONVERSATION: Conversation = {
  id: 'conv_welcome',
  title: 'Welcome to My AI Model',
  messages: [
    {
      id: 'msg_welcome_1',
      role: 'assistant',
      content: `### Welcome to **My AI Model** 👋

I'm your consumer AI assistant, built for high-performance reasoning, creative writing, programming, file and image analysis, and deep research.

Here are a few things we can do together right away:
- **Write & Debug Code**: Generate TypeScript, Python, React components, SQL queries, or inspect logs.
- **Analyze Files & Images**: Attach PDFs, CSVs, charts, or images to discuss insights.
- **Deep Reasoning**: Enable **Thinking Mode** for complex mathematical, architectural, or algorithmic problems.
- **Web Search**: Query current real-time news, documentation, or market trends with live source citations.
- **Projects**: Keep files, context, and persistent instructions grouped in dedicated workspaces.

What would you like to explore or build today?`,
      timestamp: Date.now(),
      modelUsed: 'gemini-3.7-flash',
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  model: 'gemini-3.7-flash',
  thinkingLevel: 'none',
  enableWebSearch: false,
};

// Storage helper functions
export function getSavedConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) {
      saveConversations([INITIAL_CONVERSATION]);
      return [INITIAL_CONVERSATION];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [INITIAL_CONVERSATION];
  } catch (e) {
    console.error('Error loading conversations:', e);
    return [INITIAL_CONVERSATION];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error('Error saving conversations:', e);
  }
}

export function getSavedProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) {
      saveProjects([INITIAL_PROJECT]);
      return [INITIAL_PROJECT];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [INITIAL_PROJECT];
  } catch (e) {
    console.error('Error loading projects:', e);
    return [INITIAL_PROJECT];
  }
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Error saving projects:', e);
  }
}

export function getSavedPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: UserPreferences): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (e) {
    console.error('Error saving preferences:', e);
  }
}

// Export / Import all application data
export function exportAllData(): string {
  const data = {
    conversations: getSavedConversations(),
    projects: getSavedProjects(),
    preferences: getSavedPreferences(),
    exportedAt: new Date().toISOString(),
    version: '1.0',
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.conversations && Array.isArray(data.conversations)) {
      saveConversations(data.conversations);
    }
    if (data.projects && Array.isArray(data.projects)) {
      saveProjects(data.projects);
    }
    if (data.preferences) {
      savePreferences(data.preferences);
    }
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}

// Extract potential code/preview artifacts from text
export function extractArtifactsFromText(text: string): Artifact[] {
  const artifacts: Artifact[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match;
  let count = 1;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const lang = (match[1] || 'text').toLowerCase();
    const content = match[2].trim();

    if (content.length > 20) {
      let type: Artifact['type'] = 'code';
      let title = `Snippet ${count} (${lang.toUpperCase() || 'Text'})`;

      if (lang === 'html' || lang === 'svg') {
        type = lang === 'svg' ? 'svg' : 'html';
        title = `Interactive Component ${count} (${lang.toUpperCase()})`;
      } else if (lang === 'json') {
        type = 'json';
        title = `Structured Data ${count}`;
      } else if (lang === 'markdown' || lang === 'md') {
        type = 'markdown';
        title = `Document ${count}`;
      } else if (['python', 'javascript', 'typescript', 'tsx', 'jsx', 'bash', 'sql', 'css'].includes(lang)) {
        type = 'code';
        title = `${lang.toUpperCase()} Script ${count}`;
      }

      artifacts.push({
        id: `art_${Date.now()}_${count}`,
        title,
        type,
        language: lang,
        content,
      });
      count++;
    }
  }

  return artifacts;
}
