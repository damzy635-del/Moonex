import React, { useState, useRef } from 'react';
import {
  X,
  User,
  Sliders,
  Sparkles,
  Volume2,
  Download,
  Upload,
  Trash2,
  Check,
  ShieldCheck,
  Moon,
  Sun,
  Laptop,
  Key,
  LogIn,
  LogOut,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import { UserPreferences, ModelInfo } from '../types';
import { exportAllData, importAllData } from '../utils/storage';
import { useAuth } from '../context/AuthContext';

interface SettingsModalProps {
  isOpen: boolean;
  preferences: UserPreferences;
  availableModels: ModelInfo[];
  onClose: () => void;
  onSavePreferences: (prefs: UserPreferences) => void;
  onReloadData: () => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

const VOICE_OPTIONS = [
  { id: 'Kore', name: 'Kore (Balanced, Natural, Warm)' },
  { id: 'Puck', name: 'Puck (Engaging, Clear, Crisp)' },
  { id: 'Fenrir', name: 'Fenrir (Deep, Authoritative)' },
  { id: 'Zephyr', name: 'Zephyr (Smooth, Relaxed)' },
  { id: 'Charon', name: 'Charon (Formal, Precise)' },
];

const TONE_OPTIONS = [
  { id: 'concise', label: 'Concise & Direct', desc: 'Minimal words, straight to the answer without preamble.' },
  { id: 'balanced', label: 'Balanced (Default)', desc: 'Well-structured, comprehensive, and clear.' },
  { id: 'explanatory', label: 'Educational & Explanatory', desc: 'Step-by-step breakdowns with analogies.' },
  { id: 'technical', label: 'Technical & Rigorous', desc: 'High architectural precision, edge cases, specifications.' },
  { id: 'creative', label: 'Creative & Engaging', desc: 'Expressive, vivid prose with dynamic style.' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  preferences,
  availableModels,
  onClose,
  onSavePreferences,
  onReloadData,
  onOpenAuth,
}) => {
  const { user, isAnonymous, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'model' | 'voice' | 'data'>('profile');
  const [prefs, setPrefs] = useState<UserPreferences>({ ...preferences });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    onSavePreferences(prefs);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleExportData = () => {
    const jsonStr = exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moonex_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importAllData(content);
      if (success) {
        setImportStatus('Data imported successfully! Reloading...');
        setTimeout(() => {
          onReloadData();
          setImportStatus(null);
        }, 1200);
      } else {
        setImportStatus('Failed to import data: Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete all conversations and reset settings?')) {
      localStorage.clear();
      onReloadData();
      onClose();
    }
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="settings-modal-dialog"
        className="relative flex h-[90vh] md:h-[85vh] max-h-[680px] w-full max-w-3xl flex-col md:flex-row overflow-hidden rounded-2xl border border-gray-800 bg-[#171717] shadow-2xl text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navigation Sidebar */}
        <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-gray-800 bg-[#141414] p-2 md:p-3 flex flex-row md:flex-col justify-between shrink-0 overflow-x-auto md:overflow-x-visible no-scrollbar">
          <div className="flex md:flex-col gap-1 w-full shrink-0 md:shrink">
            <div className="hidden md:block px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Preferences
            </div>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'profile'
                  ? 'bg-[#262626] text-white shadow-xs'
                  : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-gray-200'
              }`}
            >
              <User className="h-4 w-4 shrink-0" />
              <span>Profile & Tone</span>
            </button>

            <button
              onClick={() => setActiveTab('account')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'account'
                  ? 'bg-[#262626] text-white shadow-xs'
                  : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-gray-200'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Account & Cloud</span>
            </button>

            <button
              onClick={() => setActiveTab('model')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'model'
                  ? 'bg-[#262626] text-white shadow-xs'
                  : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-gray-200'
              }`}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Model & Behavior</span>
            </button>

            <button
              onClick={() => setActiveTab('voice')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'voice'
                  ? 'bg-[#262626] text-white shadow-xs'
                  : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-gray-200'
              }`}
            >
              <Volume2 className="h-4 w-4 shrink-0" />
              <span>Voice & Audio</span>
            </button>

            <button
              onClick={() => setActiveTab('data')}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'data'
                  ? 'bg-[#262626] text-white shadow-xs'
                  : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-gray-200'
              }`}
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>Data & Backup</span>
            </button>
          </div>

          <div className="hidden md:block px-2 py-2 text-[10px] text-gray-500 border-t border-gray-800">
            Moonex Consumer v3.7
          </div>
        </div>

        {/* Content Pane */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto p-4 sm:p-6 bg-[#171717]">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-bold text-white">
                {activeTab === 'profile' && 'Profile & Custom Tone'}
                {activeTab === 'account' && 'Account & Cloud Synchronization'}
                {activeTab === 'model' && 'Model Defaults & Instructions'}
                {activeTab === 'voice' && 'Audio & Voice Output'}
                {activeTab === 'data' && 'Data Storage & Export'}
              </h2>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab: Account & Cloud */}
            {activeTab === 'account' && (
              <div className="space-y-4 text-xs sm:text-sm">
                {user && !isAnonymous ? (
                  <div className="rounded-xl border border-gray-800 bg-[#1f1f1f] p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'User'}
                          className="h-12 w-12 rounded-full object-cover border-2 border-indigo-500"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-base font-bold text-white">
                          {(user.displayName || user.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-white">
                          {user.displayName || 'Authenticated User'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {user.email || 'No email associated'}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400">
                          <Cloud className="h-3.5 w-3.5" />
                          <span>Firestore Cloud Sync Active</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
                      <div className="text-[11px] text-gray-500 font-mono">
                        UID: {user.uid.slice(0, 16)}...
                      </div>
                      <button
                        onClick={async () => {
                          await logout();
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-rose-950/40 border border-rose-900/60 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-indigo-900/60 bg-indigo-950/20 p-5 text-center space-y-3">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white">
                      <LogIn className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Sign In to Moonex</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        Connect with Google or Email to synchronize your conversations, knowledge bases, and custom preferences securely across devices with Firestore.
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          onClose();
                          onOpenAuth?.('signin');
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        <span>Sign In or Create Account</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-gray-800 bg-[#141414] p-4 space-y-2">
                  <div className="text-xs font-semibold text-gray-200">
                    Cloud Storage & Real-Time Sync
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    When authenticated, your conversations and project workspaces are protected by Firestore security rules, persisting automatically so you can resume reasoning sessions anywhere.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 1: Profile & Tone */}
            {activeTab === 'profile' && (
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Your Name or Handle
                  </label>
                  <input
                    type="text"
                    value={prefs.userName}
                    onChange={(e) => setPrefs({ ...prefs, userName: e.target.value })}
                    className="w-full rounded-lg border border-gray-800 bg-[#1f1f1f] px-3 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    What should Moonex know about you?
                  </label>
                  <textarea
                    value={prefs.userContext}
                    onChange={(e) => setPrefs({ ...prefs, userContext: e.target.value })}
                    rows={3}
                    placeholder="e.g. I am a software engineer, I prefer TypeScript and Python, I value concise explanations..."
                    className="w-full rounded-lg border border-gray-800 bg-[#1f1f1f] p-3 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden resize-none"
                  />
                </div>

                {/* Tone Selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Response Tone & Style
                  </label>
                  <div className="space-y-1.5">
                    {TONE_OPTIONS.map((tone) => (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => setPrefs({ ...prefs, tone: tone.id as any })}
                        className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                          prefs.tone === tone.id
                            ? 'border-indigo-500 bg-indigo-950/40'
                            : 'border-gray-800 bg-[#1f1f1f] hover:bg-[#252525]'
                        }`}
                      >
                        <div
                          className={`mt-0.5 h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            prefs.tone === tone.id
                              ? 'border-indigo-500 bg-indigo-600 text-white'
                              : 'border-gray-600'
                          }`}
                        >
                          {prefs.tone === tone.id && <div className="h-1.5 w-1.5 bg-white rounded-full" />}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-gray-200">
                            {tone.label}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {tone.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Model & Instructions */}
            {activeTab === 'model' && (
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Default AI Model
                  </label>
                  <select
                    value={prefs.defaultModel}
                    onChange={(e) => setPrefs({ ...prefs, defaultModel: e.target.value })}
                    className="w-full rounded-lg border border-gray-800 bg-[#1f1f1f] px-3 py-2 text-xs text-gray-100 focus:border-indigo-500 focus:outline-hidden"
                  >
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#1f1f1f] text-gray-100">
                        {m.name} ({m.contextWindow})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Custom System Instructions (Global)
                  </label>
                  <textarea
                    value={prefs.customSystemInstructions}
                    onChange={(e) =>
                      setPrefs({ ...prefs, customSystemInstructions: e.target.value })
                    }
                    rows={4}
                    placeholder="Instructions that will apply to all conversations unless overridden by a project..."
                    className="w-full rounded-lg border border-gray-800 bg-[#1f1f1f] p-3 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden font-mono resize-none"
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Voice */}
            {activeTab === 'voice' && (
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Text-to-Speech Voice (Neural Engine)
                  </label>
                  <div className="space-y-1.5">
                    {VOICE_OPTIONS.map((voice) => (
                      <button
                        key={voice.id}
                        type="button"
                        onClick={() => setPrefs({ ...prefs, voiceName: voice.id })}
                        className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-all ${
                          prefs.voiceName === voice.id
                            ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                            : 'border-gray-800 bg-[#1f1f1f] hover:bg-[#252525] text-gray-200'
                        }`}
                      >
                        <span className="font-medium">{voice.name}</span>
                        {prefs.voiceName === voice.id && (
                          <Check className="h-4 w-4 text-indigo-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Data & Backup */}
            {activeTab === 'data' && (
              <div className="space-y-4 text-xs sm:text-sm">
                <div className="rounded-xl border border-gray-800 p-4 bg-[#141414] space-y-3">
                  <div className="font-semibold text-gray-200">
                    Export & Backup Workspace
                  </div>
                  <p className="text-xs text-gray-400">
                    Download a full JSON archive of all your conversations, projects, knowledge files, and settings.
                  </p>
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3.5 py-2 text-xs font-semibold text-gray-900 hover:bg-white shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Data (JSON)</span>
                  </button>
                </div>

                <div className="rounded-xl border border-gray-800 p-4 bg-[#141414] space-y-3">
                  <div className="font-semibold text-gray-200">
                    Import Workspace Backup
                  </div>
                  <p className="text-xs text-gray-400">
                    Restore previously exported conversations and projects.
                  </p>
                  <input
                    type="file"
                    ref={importFileRef}
                    onChange={handleImportFile}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    onClick={() => importFileRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-[#1f1f1f] px-3.5 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-800"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Import JSON Backup</span>
                  </button>
                  {importStatus && (
                    <div className="text-xs font-medium text-emerald-400">
                      {importStatus}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4 space-y-2">
                  <div className="font-semibold text-rose-400">
                    Danger Zone
                  </div>
                  <p className="text-xs text-rose-300/80">
                    Clear all conversations, projects, and local browser cache permanently.
                  </p>
                  <button
                    onClick={handleClearAll}
                    className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Reset All Data</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Save Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <span className="text-xs text-gray-400">
              {savedSuccess ? (
                <span className="text-emerald-400 font-medium">✓ Preferences saved</span>
              ) : (
                'Changes apply immediately'
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
