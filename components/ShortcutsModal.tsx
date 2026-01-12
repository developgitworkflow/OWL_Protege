
import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const categories = [
      {
          title: "Navigation",
          items: [
              { keys: ['Tab'], desc: 'Cycle focus through nodes' },
              { keys: ['Shift', 'Tab'], desc: 'Cycle focus backwards' },
              { keys: ['Alt', '↑↓←→'], desc: 'Jump selection spatially' },
              { keys: ['Esc'], desc: 'Deselect all' },
          ]
      },
      {
          title: "Editing",
          items: [
              { keys: ['Del'], desc: 'Delete selected entity' },
              { keys: ['Bksp'], desc: 'Delete selected entity' },
              { keys: ['Enter'], desc: 'Confirm / Select' },
          ]
      },
      {
          title: "Canvas",
          items: [
              { keys: ['?'], desc: 'Toggle this help' },
              { keys: ['+'], desc: 'Zoom In' },
              { keys: ['-'], desc: 'Zoom Out' },
          ]
      }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2 text-slate-100">
            <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                <Keyboard size={20} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white hover:bg-slate-800 p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-1 gap-6">
                {categories.map((cat, i) => (
                    <div key={i}>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b border-slate-800">{cat.title}</h3>
                        <div className="space-y-3">
                            {cat.items.map((item, j) => (
                                <div key={j} className="flex justify-between items-center group">
                                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{item.desc}</span>
                                    <div className="flex gap-1">
                                        {item.keys.map((k, ki) => (
                                            <kbd key={ki} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs font-mono text-slate-400 min-w-[24px] text-center shadow-sm">
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
        </div>

        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500">
                Tip: You can also use <span className="text-slate-300 font-mono">Drag & Drop</span> from the sidebar to create nodes.
            </p>
        </div>

      </div>
    </div>
  );
};

export default ShortcutsModal;
