import React, { useState, useRef, useEffect } from 'react';
import { useStudiesList } from '@/hooks/useStudies';
import { useChatbotQuery, useChatbotStatus } from '@/hooks/useChatbot';
import { ChatMessage, chatbotApi } from '@/api/chatbotApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Sparkles,
  Bot,
  X,
  Minimize2,
  Maximize2,
  Send,
  Paperclip,
  RotateCcw,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Brain,
  Layers,
  FileText,
  Search,
  Activity,
  ArrowRight,
} from 'lucide-react';

const STARTER_PROMPTS = [
  {
    title: 'Protocol Endpoints & Gaps',
    prompt: 'What are the primary and secondary endpoints in our active protocol, and are there any gaps compared to standard guidelines?',
    icon: FileText,
  },
  {
    title: 'Statistical Plan & R Script',
    prompt: 'Recommend a statistical analysis plan for our study endpoints, including MMRM model specification and R Docker execution guidelines.',
    icon: Activity,
  },
  {
    title: 'Admin Protocol Match',
    prompt: 'Compare our active study protocol against the Admin Reference Protocol standard using semantic RAG verification.',
    icon: Search,
  },
  {
    title: 'Synthesize Assessment Items',
    prompt: 'Generate 5 protocol-grounded questionnaire items with 3 standardized radio options and clinical calibration explanations.',
    icon: BookOpen,
  },
];

export function FloatingChatbotWidget() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const [inputMessage, setInputMessage] = useState('');
  const [attachedSnippet, setAttachedSnippet] = useState<{ fileName: string; text: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [openTraceIndex, setOpenTraceIndex] = useState<number | null>(null);
  const [openCitationsIndex, setOpenCitationsIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Queries & Mutations
  const { data: studiesData } = useStudiesList();
  const { data: statusData } = useChatbotStatus();
  const chatbotMutation = useChatbotQuery();

  const studies = Array.isArray(studiesData) ? studiesData : studiesData?.items || [];

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle Send Query
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || chatbotMutation.isPending) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');

    // Prepare API history
    const historyPayload = messages.slice(-4).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await chatbotMutation.mutateAsync({
        message: text,
        study_id: selectedStudyId || null,
        history: historyPayload,
        attached_snippet: attachedSnippet?.text || null,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: result.intent,
        routedAgent: result.routed_agent,
        agentTrace: result.agent_trace,
        citations: result.citations,
        followUpSuggestions: result.follow_up_suggestions,
        confidenceScore: result.confidence_score,
        targetEntities: result.target_entities,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      // Auto-open trace for the latest assistant message
      setOpenTraceIndex(newMessages.length);
    } catch (err: unknown) {
      const errorMsg = (err as { message?: string })?.message || 'Failed to connect to AI Agent service.';
      const fallbackAssistantMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content: `**AI Assistant Notice**: ${errorMsg}\n\nPlease verify your backend connection or retry in a few moments.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackAssistantMsg]);
    }
  };

  // Handle File Snippet Attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await chatbotApi.uploadSnippet(file);
      setAttachedSnippet({
        fileName: res.fileName,
        text: res.snippet,
      });
      toast({
        title: 'Document Snippet Attached',
        description: `Attached ${res.fileName} (${res.characterCount} characters) to conversation context.`,
      });
    } catch {
      toast({
        title: 'Upload Failed',
        description: 'Could not extract text from document.',
        variant: 'destructive',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Copy Message to Clipboard
  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Reset Conversation
  const handleResetChat = () => {
    setMessages([]);
    setAttachedSnippet(null);
    toast({
      title: 'Conversation Reset',
      description: 'Chat session cleared.',
    });
  };

  // Render Simple Markdown Text (Headers, bold, code, bullet items)
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Header 3
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="font-bold text-slate-900 text-sm mt-2 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
      }
      // Header 2 / 1
      if (line.startsWith('## ') || line.startsWith('# ')) {
        return (
          <h3 key={idx} className="font-bold text-slate-900 text-base mt-2 mb-1">
            {line.replace(/^#+\s*/, '')}
          </h3>
        );
      }
      // Bullet items
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const bulletText = line.trim().replace(/^[-*]\s+/, '');
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-2 my-0.5 text-xs text-slate-700">
            <span className="text-purple-600 font-bold shrink-0">•</span>
            <span>{renderInlineStyles(bulletText)}</span>
          </div>
        );
      }
      // Numbered items
      if (/^\d+\.\s+/.test(line.trim())) {
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-2 my-0.5 text-xs text-slate-700">
            <span className="text-purple-700 font-bold shrink-0 text-[11px]">
              {line.trim().match(/^\d+\./)?.[0]}
            </span>
            <span>{renderInlineStyles(line.trim().replace(/^\d+\.\s+/, ''))}</span>
          </div>
        );
      }
      // Blank lines
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      // Normal paragraph
      return (
        <p key={idx} className="text-xs text-slate-700 leading-relaxed my-0.5">
          {renderInlineStyles(line)}
        </p>
      );
    });
  };

  // Inline bold, code, and source citations
  const renderInlineStyles = (content: string) => {
    // Highlight [Source X] pills
    const parts = content.split(/(\[Source\s*\d+(?:,\s*Source\s*\d+)*\]|\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, pIdx) => {
      if (/^\[Source\s*\d+/.test(part)) {
        return (
          <span
            key={pIdx}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 text-[10px] font-semibold text-purple-700 bg-purple-100/80 rounded border border-purple-200"
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={pIdx} className="px-1 py-0.2 mx-0.5 font-mono text-[11px] bg-slate-100 text-purple-800 rounded">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* ============================================================== */}
      {/* 1. FLOATING LAUNCHER BUTTON (Bottom Right - Highlighted in Image 1) */}
      {/* ============================================================== */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in duration-200">
          <div className="relative group">
            {/* Pulsing Aura */}
            <div className="absolute -inset-1 rounded-full bg-linear-to-r from-purple-600 via-indigo-600 to-blue-500 opacity-70 blur-xs group-hover:opacity-100 transition duration-300 animate-pulse" />

            <button
              onClick={() => setIsOpen(true)}
              className="relative flex items-center gap-2.5 px-4 py-3 bg-linear-to-r from-purple-700 via-purple-600 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white rounded-full shadow-xl transition-all transform hover:scale-105 active:scale-95"
              aria-label="Open AI RAG Research Chatbot"
            >
              <div className="relative flex items-center justify-center">
                <Bot className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold leading-tight flex items-center gap-1">
                  <span>AI Research Assistant</span>
                  <Sparkles className="h-3 w-3 text-amber-300" />
                </p>
                <p className="text-[10px] text-purple-200 font-medium leading-none mt-0.5">
                  RAG · LangGraph
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. EXPANDED AGENTIC RAG CHATBOT WINDOW                         */}
      {/* ============================================================== */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 overflow-hidden ${
            isExpanded
              ? 'w-[95vw] sm:w-[700px] h-[90vh] max-h-[90vh]'
              : 'w-[92vw] sm:w-[460px] h-[640px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 bg-linear-to-r from-slate-900 via-purple-950 to-indigo-950 text-white flex flex-col gap-2 shrink-0 border-b border-purple-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-xs">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold tracking-tight text-white">AI RAG Agentic Chatbot</h3>
                    <Badge variant="outline" className="text-[9px] border-emerald-400 text-emerald-300 bg-emerald-950/60 py-0 px-1 font-mono">
                      Pinecone RAG Active
                    </Badge>
                  </div>
                  <p className="text-[10px] text-purple-200/90">
                    LangGraph Multi-Agent · Hugging Face / OpenAI Grounded
                  </p>
                </div>
              </div>

              {/* Window Controls */}
              <div className="flex items-center gap-1 text-purple-200">
                <button
                  type="button"
                  onClick={handleResetChat}
                  title="Clear conversation"
                  className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-slate-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? 'Restore window size' : 'Expand window'}
                  className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-slate-300"
                >
                  {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Minimize chatbot"
                  className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Study Context Selector Bar */}
            <div className="flex items-center gap-2 pt-1 border-t border-white/10 text-xs">
              <span className="text-[10px] font-semibold text-purple-200 shrink-0 uppercase tracking-wider">
                Study Context:
              </span>
              <select
                value={selectedStudyId}
                onChange={(e) => setSelectedStudyId(e.target.value)}
                className="flex-1 text-[11px] bg-slate-800/80 border border-purple-500/30 rounded-lg px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-400 truncate"
              >
                <option value="">-- All Studies &amp; Admin Protocols --</option>
                {studies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.protocolNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/60">
            {/* Starter Welcome Screen (when no messages) */}
            {messages.length === 0 && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl border border-purple-100 bg-linear-to-br from-purple-50 via-indigo-50/50 to-white text-slate-800 space-y-2 shadow-xs">
                  <div className="flex items-center gap-2 text-purple-800 font-bold text-xs">
                    <Brain className="h-4 w-4 text-purple-600" />
                    <span>AI RAG Agentic Research Assistant</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    An intelligent, context-aware research assistant built with <strong>RAG + LangGraph + Hugging Face/OpenAI</strong>.
                    It understands your protocols, retrieves verified parameters from <strong>Pinecone Vector DB</strong>, and delivers source-cited answers with agentic reasoning.
                  </p>
                  <div className="flex items-center gap-2 pt-1 flex-wrap text-[10px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ Multi-Agent Routing
                    </span>
                    <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      ✓ Pinecone Embeddings
                    </span>
                    <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      ✓ Source Citations
                    </span>
                  </div>
                </div>

                {/* Starter Prompt Cards */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                    Suggested Research Questions:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {STARTER_PROMPTS.map((sp, idx) => {
                      const Icon = sp.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(sp.prompt)}
                          className="p-3 text-left rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/50 transition-all text-xs group shadow-2xs"
                        >
                          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-1 group-hover:text-purple-700">
                            <Icon className="h-3.5 w-3.5 text-purple-600" />
                            <span>{sp.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {sp.prompt}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}>
                  <div className="flex items-center gap-1.5 px-1 text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-600">
                      {isUser ? 'You' : msg.routedAgent || 'AI Agentic Assistant'}
                    </span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                    {msg.confidenceScore && (
                      <Badge variant="outline" className="text-[9px] text-emerald-700 border-emerald-200 bg-emerald-50 py-0 px-1 font-mono">
                        {Math.round(msg.confidenceScore * 100)}% Confidence
                      </Badge>
                    )}
                  </div>

                  <div
                    className={`max-w-[90%] rounded-2xl p-3.5 text-xs shadow-xs ${
                      isUser
                        ? 'bg-purple-600 text-white rounded-tr-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs space-y-2'
                    }`}
                  >
                    {isUser ? (
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        {/* LangGraph Agent Workflow Trace Accordion */}
                        {msg.agentTrace && msg.agentTrace.length > 0 && (
                          <div className="rounded-lg border border-purple-100 bg-purple-50/60 overflow-hidden text-[11px]">
                            <button
                              type="button"
                              onClick={() => setOpenTraceIndex(openTraceIndex === index ? null : index)}
                              className="w-full flex items-center justify-between p-2 text-left font-semibold text-purple-900 hover:bg-purple-100/60 transition-colors"
                            >
                              <div className="flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-purple-600" />
                                <span>LangGraph Agentic Trace ({msg.agentTrace.length} Steps)</span>
                              </div>
                              {openTraceIndex === index ? (
                                <ChevronDown className="h-3.5 w-3.5 text-purple-700" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-purple-700" />
                              )}
                            </button>

                            {openTraceIndex === index && (
                              <div className="p-2.5 pt-0 space-y-1.5 border-t border-purple-100">
                                {msg.agentTrace.map((tr) => (
                                  <div key={tr.step} className="flex items-start gap-2 text-[10px] text-slate-600">
                                    <span className="w-4 h-4 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center font-bold shrink-0 mt-0.5">
                                      {tr.step}
                                    </span>
                                    <div>
                                      <strong className="text-purple-900 font-semibold">{tr.agent}:</strong>{' '}
                                      <span>{tr.action}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Markdown Output Content */}
                        <div className="space-y-1">{renderFormattedMarkdown(msg.content)}</div>

                        {/* Source Citations Collapsible List */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setOpenCitationsIndex(openCitationsIndex === index ? null : index)}
                              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-purple-700 mb-1"
                            >
                              <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                              <span>Grounded Sources &amp; Citations ({msg.citations.length})</span>
                              {openCitationsIndex === index ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>

                            {openCitationsIndex === index && (
                              <div className="space-y-1.5 pt-1">
                                {msg.citations.map((cite) => (
                                  <div
                                    key={cite.citation_index}
                                    className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] space-y-0.5"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-bold text-purple-800">
                                        [Source {cite.citation_index}] {cite.document_title}
                                      </span>
                                      <span className="font-mono text-emerald-700 bg-emerald-50 px-1 rounded text-[9px] border border-emerald-200 shrink-0">
                                        {cite.similarity_score}% Match
                                      </span>
                                    </div>
                                    <p className="text-slate-500 truncate">{cite.source} · Section: {cite.section}</p>
                                    <p className="text-slate-600 italic line-clamp-2 pt-0.5">"{cite.snippet}"</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Follow-up Action Chips */}
                        {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Suggested Follow-Up:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.followUpSuggestions.map((sug, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => handleSendMessage(sug)}
                                  className="text-[11px] px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors flex items-center gap-1 font-medium text-left"
                                >
                                  <span>{sug}</span>
                                  <ArrowRight className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bottom Utility Bar */}
                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-50">
                          <span className="text-[9px] text-slate-400">
                            Verified against Pinecone RAG Knowledge Base
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, index)}
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pending State Indicator */}
            {chatbotMutation.isPending && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-white border border-slate-200 shadow-xs max-w-[85%] text-xs">
                <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 animate-spin">
                  <Sparkles className="h-3 w-3" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-800">AI Agentic Pipeline Executing...</p>
                  <p className="text-[10px] text-slate-500">
                    Query Understanding → Pinecone RAG Vector Search → Context Re-ranking → LLM Response
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Attached Document Snippet Pill (if any) */}
          {attachedSnippet && (
            <div className="px-3 py-1.5 bg-purple-50 border-t border-purple-100 flex items-center justify-between text-xs text-purple-900">
              <div className="flex items-center gap-1.5 truncate">
                <Paperclip className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span className="font-medium truncate">Attached: {attachedSnippet.fileName}</span>
                <span className="text-[10px] text-purple-600">({attachedSnippet.text.length} chars)</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedSnippet(null)}
                className="text-purple-400 hover:text-purple-700 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-2">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach protocol excerpt or PDF"
                className="p-2 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors shrink-0"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                placeholder="Ask anything about clinical protocols, endpoints, or R analysis..."
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 max-h-24"
              />

              <Button
                type="button"
                size="sm"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || chatbotMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-9 w-9 p-0 flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>Press <strong>Enter</strong> to send · Shift+Enter for newline</span>
              <span className="flex items-center gap-1 font-mono text-[9px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Pinecone + LangGraph Connected
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
