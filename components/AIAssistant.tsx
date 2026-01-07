import React, { useState, useRef, useEffect } from 'react';
import { generateDiagramFromPrompt, explainDiagram } from '../services/geminiService';
import { MessageSquare, Send, Sparkles, Loader2, X } from 'lucide-react';
import { Node, Edge } from 'reactflow';

interface AIAssistantProps {
  onDiagramGenerated: (nodes: Node[], edges: Edge[]) => void;
  currentNodes: Node[];
  currentEdges: Edge[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ onDiagramGenerated, currentNodes, currentEdges }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
      { role: 'model', text: 'Hello! I can help you design software architectures. Describe a system (e.g., "Library Management System") and I will generate the UML diagram for you.' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    // Heuristic: If prompt implies generation/creation
    if (userMsg.toLowerCase().includes('create') || userMsg.toLowerCase().includes('design') || userMsg.toLowerCase().includes('generate') || userMsg.length > 10) {
        const result = await generateDiagramFromPrompt(userMsg);
        if (result && result.nodes.length > 0) {
            onDiagramGenerated(result.nodes, result.edges);
            setMessages(prev => [...prev, { role: 'model', text: `I've generated a diagram for "${userMsg}". You can see it on the canvas now.` }]);
        } else {
            setMessages(prev => [...prev, { role: 'model', text: "I couldn't generate a valid diagram from that prompt. Please try providing more specific details (e.g., 'Create a class diagram for a School system with Student, Teacher, and Course classes')." }]);
        }
    } else {
        // Fallback or other chat logic could go here
         setMessages(prev => [...prev, { role: 'model', text: "Please describe a system you want to model." }]);
    }
    
    setLoading(false);
  };

  const handleAnalyze = async () => {
      setLoading(true);
      const analysis = await explainDiagram(currentNodes, currentEdges);
      setMessages(prev => [...prev, { role: 'model', text: analysis }]);
      setLoading(false);
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 z-50 flex items-center gap-2"
        >
          <Sparkles className="w-6 h-6" />
          <span className="font-semibold">AI Architect</span>
        </button>
      )}

      {/* Chat Interface */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold">AI Architect</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
                <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                        msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white border border-gray-200 text-gray-700 rounded-bl-none shadow-sm'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
             {loading && (
                 <div className="flex justify-start">
                     <div className="bg-white border border-gray-200 p-3 rounded-lg rounded-bl-none shadow-sm">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                     </div>
                 </div>
             )}
             <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex gap-2">
            <button 
                onClick={handleAnalyze}
                disabled={currentNodes.length === 0 || loading}
                className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-200 disabled:opacity-50"
            >
                Analyze Diagram
            </button>
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Describe a system..."
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button 
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    <Send size={18} />
                </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
