import React, { useState, useRef } from 'react';
import { X, Upload, FileText, FolderPlus } from 'lucide-react';
import { ProjectData } from '../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (projectData: ProjectData) => void;
}

// Subset of IANA Language Subtag Registry
const LANGUAGES = [
  { code: "af", name: "Afrikaans" },
  { code: "ar", name: "Arabic" },
  { code: "bg", name: "Bulgarian" },
  { code: "bn", name: "Bengali" },
  { code: "ca", name: "Catalan" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "en", name: "English" },
  { code: "en-US", name: "English (United States)" },
  { code: "en-GB", name: "English (United Kingdom)" },
  { code: "es", name: "Spanish" },
  { code: "et", name: "Estonian" },
  { code: "fa", name: "Persian" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "gu", name: "Gujarati" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hr", name: "Croatian" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "kn", name: "Kannada" },
  { code: "ko", name: "Korean" },
  { code: "lt", name: "Lithuanian" },
  { code: "lv", name: "Latvian" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "ms", name: "Malay" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "sr", name: "Serbian" },
  { code: "sv", name: "Swedish" },
  { code: "sw", name: "Swahili" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "vi", name: "Vietnamese" },
  { code: "zh", name: "Chinese" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" }
];

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({ name, language, description, file: file || undefined });
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setLanguage('');
    setDescription('');
    setFile(null);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        if (e.dataTransfer.files[0].name.endsWith('.json')) {
            setFile(e.dataTransfer.files[0]);
        }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 transform transition-all flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-blue-500" />
              New Project
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">Start a new UML or OWL design project</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          
          <div className="space-y-4">
            {/* Project Name */}
            <div className="space-y-1.5">
              <label htmlFor="projectName" className="block text-sm font-medium text-slate-400">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input 
                id="projectName"
                type="text" 
                required
                placeholder="e.g. Inventory Management System"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
              />
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <label htmlFor="language" className="block text-sm font-medium text-slate-400">
                Language
              </label>
              <div className="relative">
                <select 
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 appearance-none focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                >
                  <option value="" disabled className="text-slate-500">Select a language...</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-slate-800 text-slate-200">
                      {lang.name} ({lang.code})
                    </option>
                  ))}
                </select>
                {/* Chevron Icon */}
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Select from standard IANA language registry codes.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="description" className="block text-sm font-medium text-slate-400">
                Description
              </label>
              <textarea 
                id="description"
                rows={3}
                placeholder="Briefly describe the purpose of this project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm resize-none"
              />
            </div>

            {/* File Upload Area */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-400">
                Import Existing Source (Optional)
              </label>
              <div 
                className={`
                    border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer text-center group
                    ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-blue-500 hover:bg-slate-800'}
                    ${file ? 'bg-blue-500/10 border-blue-500/50' : ''}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json" 
                    className="hidden" 
                />
                
                <div className="flex flex-col items-center justify-center gap-2">
                    {file ? (
                        <>
                            <div className="w-10 h-10 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center">
                                <FileText size={20} />
                            </div>
                            <div className="text-sm font-medium text-blue-400 max-w-full truncate px-4">
                                {file.name}
                            </div>
                            <div className="text-xs text-blue-500">Click to change</div>
                        </>
                    ) : (
                        <>
                            <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-500 group-hover:bg-blue-900/30 group-hover:text-blue-400 transition-colors flex items-center justify-center">
                                <Upload size={20} />
                            </div>
                            <div className="text-sm text-slate-400">
                                <span className="font-semibold text-blue-500 hover:underline">Click to upload</span> or drag and drop
                            </div>
                            <p className="text-xs text-slate-500">JSON files only</p>
                        </>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-sm hover:shadow"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;