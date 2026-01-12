
import React, { useState, useMemo } from 'react';
import { Database, User, FileType, ArrowRightLeft, Tag, Info, Search, ChevronDown, ChevronRight, GripVertical, Box } from 'lucide-react';
import { ElementType, UMLNodeData } from '../types';
import type { Node } from 'reactflow';

interface SidebarProps {
    selectedNode?: Node<UMLNodeData> | null;
}

interface ToolGroup {
    id: string;
    label: string;
    items: ToolItemDef[];
}

interface ToolItemDef {
    type: ElementType;
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    desc: string;
}

const TOOL_GROUPS: ToolGroup[] = [
    {
        id: 'entities',
        label: 'Entities',
        items: [
            { 
                type: ElementType.OWL_CLASS, 
                label: 'Class', 
                icon: Database, 
                color: 'text-purple-400', 
                bgColor: 'group-hover:bg-purple-900/20',
                borderColor: 'group-hover:border-purple-500/50',
                desc: 'A concept or collection of objects (e.g., Person).' 
            },
            { 
                type: ElementType.OWL_DATATYPE, 
                label: 'Datatype', 
                icon: FileType, 
                color: 'text-amber-400',
                bgColor: 'group-hover:bg-amber-900/20',
                borderColor: 'group-hover:border-amber-500/50',
                desc: 'A range of data values (e.g., xsd:integer).' 
            }
        ]
    },
    {
        id: 'properties',
        label: 'Predicates',
        items: [
            { 
                type: ElementType.OWL_OBJECT_PROPERTY, 
                label: 'Obj Prop', 
                icon: ArrowRightLeft, 
                color: 'text-blue-400', 
                bgColor: 'group-hover:bg-blue-900/20',
                borderColor: 'group-hover:border-blue-500/50',
                desc: 'Relates two individuals (e.g., hasParent).' 
            },
            { 
                type: ElementType.OWL_DATA_PROPERTY, 
                label: 'Data Prop', 
                icon: Tag, 
                color: 'text-green-400', 
                bgColor: 'group-hover:bg-green-900/20',
                borderColor: 'group-hover:border-green-500/50',
                desc: 'Relates an individual to a literal (e.g., hasAge).' 
            }
        ]
    },
    {
        id: 'instances',
        label: 'Instances',
        items: [
            { 
                type: ElementType.OWL_NAMED_INDIVIDUAL, 
                label: 'Individual', 
                icon: User, 
                color: 'text-pink-400', 
                bgColor: 'group-hover:bg-pink-900/20',
                borderColor: 'group-hover:border-pink-500/50',
                desc: 'A specific object in the domain (e.g., JohnDoe).' 
            }
        ]
    }
];

const Sidebar: React.FC<SidebarProps> = ({ selectedNode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
      const newSet = new Set(collapsedGroups);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setCollapsedGroups(newSet);
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, elementType: ElementType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/elementType', elementType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredGroups = useMemo(() => {
      if (!searchTerm) return TOOL_GROUPS;
      return TOOL_GROUPS.map(group => ({
          ...group,
          items: group.items.filter(item => item.label.toLowerCase().includes(searchTerm.toLowerCase()))
      })).filter(group => group.items.length > 0);
  }, [searchTerm]);

  const getSelectionIcon = (type: ElementType) => {
      switch(type) {
          case ElementType.OWL_CLASS: return <Database size={16} className="text-purple-400" />;
          case ElementType.OWL_NAMED_INDIVIDUAL: return <User size={16} className="text-pink-400" />;
          case ElementType.OWL_OBJECT_PROPERTY: return <ArrowRightLeft size={16} className="text-blue-400" />;
          case ElementType.OWL_DATA_PROPERTY: return <Tag size={16} className="text-green-400" />;
          case ElementType.OWL_DATATYPE: return <FileType size={16} className="text-amber-400" />;
          default: return <Info size={16} className="text-slate-400" />;
      }
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-10 shadow-xl text-slate-200 select-none">
      
      {/* Header & Search */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Box size={14} /> Component Toolbox
        </h2>
        <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
            <input 
                className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="Filter tools..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>
      
      {/* Tool List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {filteredGroups.map(group => (
            <div key={group.id} className="space-y-2">
                <button 
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors px-1"
                >
                    {group.label}
                    {collapsedGroups.has(group.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
                
                {!collapsedGroups.has(group.id) && (
                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
                        {group.items.map((item) => (
                            <div 
                                key={item.label}
                                className="group relative"
                                onDragStart={(event) => onDragStart(event, 'umlNode', item.type)}
                                draggable={true}
                            >
                                <div className={`
                                    flex flex-col items-center justify-center gap-2 p-3 
                                    bg-slate-800 border border-slate-700 rounded-lg cursor-grab active:cursor-grabbing 
                                    transition-all duration-200 shadow-sm
                                    hover:bg-slate-750 hover:shadow-md hover:-translate-y-0.5
                                    ${item.borderColor}
                                `}>
                                    <div className={`p-1.5 rounded-md bg-slate-900 ${item.color} ${item.bgColor} transition-colors`}>
                                        <item.icon size={18} />
                                    </div>
                                    <span className="text-[11px] font-medium text-slate-300 group-hover:text-white">{item.label}</span>
                                    
                                    {/* Drag Handle hint */}
                                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-20">
                                        <GripVertical size={12} />
                                    </div>
                                </div>

                                {/* Tooltip */}
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 translate-x-2 group-hover:translate-x-0 duration-200">
                                    <div className={`font-bold mb-1 flex items-center gap-2 ${item.color}`}>
                                        <item.icon size={12} /> {item.label}
                                    </div>
                                    <div className="text-slate-400 leading-snug text-[10px]">{item.desc}</div>
                                    {/* Arrow */}
                                    <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-[1px] w-2 h-2 bg-slate-900 border-l border-b border-slate-700 transform rotate-45"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ))}

        {filteredGroups.length === 0 && (
            <div className="text-center py-8 text-slate-600 text-xs italic">
                No tools found.
            </div>
        )}
      </div>

      {/* Active Selection Widget */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
              <span>Active Selection</span>
              <div className={`w-1.5 h-1.5 rounded-full ${selectedNode ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`}></div>
          </div>
          
          {selectedNode ? (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-2 bg-slate-800 rounded-md border border-slate-700 shrink-0">
                      {getSelectionIcon(selectedNode.data.type)}
                  </div>
                  <div className="overflow-hidden min-w-0">
                      <div className="text-sm font-bold text-slate-200 truncate" title={selectedNode.data.label}>
                          {selectedNode.data.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                          {selectedNode.data.iri || selectedNode.id}
                      </div>
                  </div>
              </div>
          ) : (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-3 flex items-center justify-center text-slate-600 text-xs italic border-dashed">
                  No element selected
              </div>
          )}
      </div>
    </aside>
  );
};

export default Sidebar;
