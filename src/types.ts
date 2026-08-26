export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  data: string; // Base64 or text data
  type: 'image' | 'document' | 'code';
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface Artifact {
  id: string;
  title: string;
  type: 'code' | 'html' | 'markdown' | 'svg' | 'table' | 'json';
  language?: string;
  content: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  files?: FileAttachment[];
  thinkingTimeMs?: number;
  thoughtContent?: string;
  groundingSources?: GroundingSource[];
  artifacts?: Artifact[];
  modelUsed?: string;
  isError?: boolean;
  isPinned?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  projectId?: string;
  isPinned?: boolean;
  model: string;
  thinkingLevel: 'none' | 'low' | 'high';
  enableWebSearch: boolean;
}

export interface ProjectKnowledgeItem {
  id: string;
  name: string;
  type: string;
  content: string;
  size: number;
  uploadedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  customInstructions: string;
  knowledgeBase: ProjectKnowledgeItem[];
  createdAt: number;
  updatedAt: number;
}

export interface UserPreferences {
  userName: string;
  theme: 'dark' | 'light' | 'system';
  defaultModel: string;
  defaultThinkingLevel: 'none' | 'low' | 'high';
  defaultWebSearch: boolean;
  tone: 'concise' | 'balanced' | 'explanatory' | 'creative' | 'technical';
  customSystemInstructions: string;
  userContext: string; // e.g. "I am a senior frontend engineer and data analyst"
  voiceName: string; // 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr' | 'Charon'
  soundEffects: boolean;
  autoScroll: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  contextWindow: string;
  supportsThinking: boolean;
  supportsSearch: boolean;
  supportsVision: boolean;
  badge?: string;
}

export interface DeepResearchResult {
  topic: string;
  plan: string;
  report: string;
  sources: GroundingSource[];
  timestamp: string;
}
