import React from 'react';
import { X, Keyboard, Command, CornerDownLeft, Sparkles } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'General & Navigation',
      items: [
        { keys: ['⌘', 'K'], label: 'Open Command Palette & Global Search' },
        { keys: ['Ctrl', 'Shift', 'O'], label: 'Create a new conversation' },
        { keys: ['Ctrl', 'Shift', 'S'], label: 'Toggle sidebar visibility' },
        { keys: ['Ctrl', 'Shift', 'R'], label: 'Launch Deep Research agent' },
        { keys: ['Ctrl', 'Shift', 'P'], label: 'Open Prompt Library & Templates' },
        { keys: ['Esc'], label: 'Close current modal, panel, or overlay' },
      ],
    },
    {
      title: 'Chat & Interaction',
      label: 'Messaging shortcuts',
      items: [
        { keys: ['Enter'], label: 'Send message' },
        { keys: ['Shift', 'Enter'], label: 'Insert newline in message box' },
        { keys: ['Ctrl', 'Shift', 'T'], label: 'Toggle Chain of Thought / Reasoning' },
        { keys: ['Ctrl', 'Shift', 'G'], label: 'Toggle Google Web Grounding' },
        { keys: ['Ctrl', 'Shift', 'E'], label: 'Export chat transcript to Markdown' },
        { keys: ['/'], label: 'Quick open Prompt Library in empty prompt box' },
      ],
    },
  ];

  return (
    <div
      id="shortcuts-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="shortcuts-modal"
        className="w-full max-w-lg rounded-2xl border border-gray-800 bg-[#171717] p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
              <p className="text-[11px] text-gray-400">Speed up your workflow with hotkeys</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcut Groups */}
        <div className="py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {shortcutGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-1">
                {group.title}
              </div>
              <div className="rounded-xl border border-gray-800/80 bg-[#141414] divide-y divide-gray-800/60 overflow-hidden">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs text-gray-300"
                  >
                    <span>{item.label}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="flex h-5 min-w-[20px] items-center justify-center rounded bg-gray-800 px-1.5 text-[10px] font-mono font-medium text-gray-300 border border-gray-700 shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
