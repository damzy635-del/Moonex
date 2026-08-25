import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Folder,
  FileText,
  Trash2,
  Upload,
  MessageSquare,
  Sparkles,
  Edit2,
  BookOpen,
  Layers,
} from 'lucide-react';
import { Project, ProjectKnowledgeItem } from '../types';

interface ProjectsModalProps {
  isOpen: boolean;
  projects: Project[];
  activeProjectId?: string;
  onClose: () => void;
  onSaveProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onSelectProjectAndChat: (projectId: string) => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  projects,
  activeProjectId,
  onClose,
  onSaveProject,
  onDeleteProject,
  onSelectProjectAndChat,
}) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<ProjectKnowledgeItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleStartNewProject = () => {
    const newProj: Project = {
      id: `proj_${Date.now()}`,
      name: 'New Project',
      description: 'Custom workspace with project context and instructions.',
      icon: 'Folder',
      color: 'blue',
      customInstructions: 'You are helping me build and research this specific project.',
      knowledgeBase: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSelectedProject(newProj);
    setName(newProj.name);
    setDescription(newProj.description);
    setCustomInstructions(newProj.customInstructions);
    setKnowledgeBase([]);
    setIsEditing(true);
  };

  const handleEditCurrentProject = (p: Project) => {
    setSelectedProject(p);
    setName(p.name);
    setDescription(p.description);
    setCustomInstructions(p.customInstructions);
    setKnowledgeBase([...p.knowledgeBase]);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!selectedProject || !name.trim()) return;

    const updated: Project = {
      ...selectedProject,
      name: name.trim(),
      description: description.trim(),
      customInstructions: customInstructions.trim(),
      knowledgeBase,
      updatedAt: Date.now(),
    };

    onSaveProject(updated);
    setSelectedProject(updated);
    setIsEditing(false);
  };

  const handleUploadKnowledgeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs: ProjectKnowledgeItem[] = [];

    for (const file of Array.from(files)) {
      const textContent = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
      });

      newDocs.push({
        id: `kb_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: file.name,
        type: file.type || 'text/plain',
        content: textContent,
        size: file.size,
        uploadedAt: Date.now(),
      });
    }

    setKnowledgeBase((prev) => [...prev, ...newDocs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveDoc = (docId: string) => {
    setKnowledgeBase((prev) => prev.filter((d) => d.id !== docId));
  };

  return (
    <div
      id="projects-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="projects-modal-dialog"
        className="relative flex h-[85vh] max-h-[700px] w-full max-w-4xl flex-col md:flex-row overflow-hidden rounded-2xl border border-gray-800 bg-[#171717] shadow-2xl text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Column: Projects Sidebar */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-800 bg-[#141414] p-3 flex flex-col justify-between shrink-0">
          <div className="space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Projects
              </span>
              <button
                onClick={handleStartNewProject}
                className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 transition-colors shadow-2xs"
              >
                <Plus className="h-3 w-3" />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1">
              {projects.map((p) => {
                const isSelected = selectedProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProject(p);
                      setName(p.name);
                      setDescription(p.description);
                      setCustomInstructions(p.customInstructions);
                      setKnowledgeBase([...p.knowledgeBase]);
                      setIsEditing(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#262626] font-medium text-white shadow-xs'
                        : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <span className="rounded bg-[#1f1f1f] border border-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                      {p.knowledgeBase.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Project Details & Knowledge Manager */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto p-4 sm:p-6 bg-[#171717]">
          {selectedProject ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-950/60 border border-amber-800/50 text-amber-400">
                    <Folder className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {isEditing ? 'Edit Project' : selectedProject.name}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {selectedProject.knowledgeBase.length} knowledge documents attached
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => handleEditCurrentProject(selectedProject)}
                        className="flex items-center gap-1 rounded-lg border border-gray-700 bg-[#1f1f1f] px-2.5 py-1.5 text-xs text-gray-200 hover:bg-gray-800 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => {
                          onSelectProjectAndChat(selectedProject.id);
                          onClose();
                        }}
                        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Start Chat</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-white rounded"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div className="space-y-4 text-xs sm:text-sm">
                {/* Project Name & Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Q3 Growth Strategy, NextJS SaaS Codebase"
                    className="w-full rounded-lg border border-gray-800 bg-[#1f1f1f] px-3 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this project's purpose"
                    className="w-full rounded-lg border border-gray-800 bg-[#1f1f1f] px-3 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden disabled:opacity-70"
                  />
                </div>

                {/* Custom Instructions */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Custom Project Instructions
                  </label>
                  <textarea
                    disabled={!isEditing}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                    placeholder="Specific guidelines, coding styles, constraints, or tone for this project..."
                    className="w-full rounded-lg border border-gray-800 bg-[#1f1f1f] p-3 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-hidden disabled:opacity-70 resize-none font-mono"
                  />
                </div>

                {/* Knowledge Base Documents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-semibold text-gray-300">
                        Project Knowledge Base
                      </span>
                      <p className="text-[11px] text-gray-400">
                        Uploaded documents (.md, .txt, .json, .csv, code) automatically provide context to your chats.
                      </p>
                    </div>

                    {isEditing && (
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleUploadKnowledgeFile}
                          multiple
                          className="hidden"
                          accept=".txt,.md,.json,.csv,.ts,.js,.py,.html"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 rounded-lg border border-gray-700 bg-[#1f1f1f] px-2.5 py-1 text-xs text-gray-200 hover:bg-gray-800"
                        >
                          <Upload className="h-3 w-3" />
                          <span>Add Documents</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-gray-800 p-2 bg-[#121212]">
                    {knowledgeBase.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-500">
                        No documents added yet.
                      </div>
                    ) : (
                      knowledgeBase.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs border border-gray-800"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                            <span className="font-medium text-gray-200 truncate">
                              {doc.name}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              ({(doc.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>

                          {isEditing && (
                            <button
                              onClick={() => handleRemoveDoc(doc.id)}
                              className="text-gray-400 hover:text-rose-400 rounded p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Edit Action Buttons */}
              {isEditing && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this project?')) {
                        onDeleteProject(selectedProject.id);
                        setSelectedProject(projects[0] || null);
                        setIsEditing(false);
                      }
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Delete Project
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-xs"
                    >
                      Save Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <Folder className="h-10 w-10 stroke-1 mb-2" />
              <p className="text-xs">Select or create a project to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
