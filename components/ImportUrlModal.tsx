
import React, { useState } from 'react';
import { X, Globe, Download, Loader2, AlertCircle } from 'lucide-react';

interface ImportUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (url: string) => void;
}

const ImportUrlModal: React.FC<ImportUrlModalProps> = ({ isOpen, onClose, onImport }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
        await onImport(url);
        onClose();
        setUrl('');
    } catch (err) {
        setError("Failed to load URL. Please check if the resource exists and supports CORS.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 animate-in zoom-in-95 duration-200 border border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-100">Import from URL</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Ontology URL</label>
                <input 
                    type="url" 
                    required
                    placeholder="https://example.org/ontology.ttl"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 placeholder-slate-600 transition-all"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-2">
                    Supports JSON, Turtle, RDF/XML, and OWL formats. Ensure the server allows cross-origin requests (CORS).
                </p>
            </div>

            {error && (
                <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg flex items-center gap-2 text-xs text-red-300">
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
                <button 
                    type="button" 
                    onClick={onClose} 
                    className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    disabled={isLoading || !url.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                    {isLoading ? 'Loading...' : 'Import'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ImportUrlModal;
