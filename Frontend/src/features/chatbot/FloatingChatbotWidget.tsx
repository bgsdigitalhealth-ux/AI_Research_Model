import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStudiesList } from '@/hooks/useStudies';
import { useChatbotQuery } from '@/hooks/useChatbot';
import { ChatMessage, chatbotApi, UploadSnippetResponse } from '@/api/chatbotApi';
import { Button } from '@/components/ui/button';
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
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Target,
  Copy,
  Check,
  BookOpen,
  Loader2,
  FileCode,
} from 'lucide-react';

interface ParsedMessage {
  type: 'plain' | 'key_details' | 'criteria';
  content?: string;
  preamble?: string;
  keyDetailsList: { label: string; value: string }[];
  inclusionList: string[];
  exclusionList: string[];
}

export function FloatingChatbotWidget() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const [inputMessage, setInputMessage] = useState('');

  // Attached file state (Image, PDF, DOC)
  const [attachedSnippet, setAttachedSnippet] = useState<{
    fileName: string;
    fileType: 'pdf' | 'doc' | 'image' | 'text';
    text: string;
    previewUrl?: string | null;
    characterCount: number;
  } | null>(null);

  // Upload menu popup state
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMenuRef = useRef<HTMLDivElement>(null);

  // Studies Data
  const { data: studiesData } = useStudiesList();
  const chatbotMutation = useChatbotQuery();

  const studies = Array.isArray(studiesData) ? studiesData : studiesData?.items || [];

  // Default active study
  useEffect(() => {
    if (studies.length > 0 && !selectedStudyId) {
      setSelectedStudyId(studies[0].id);
    }
  }, [studies, selectedStudyId]);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Close upload menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        uploadMenuRef.current &&
        !uploadMenuRef.current.contains(event.target as Node)
      ) {
        setShowUploadMenu(false);
      }
    };
    if (showUploadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUploadMenu]);

  // Handle Send Query
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = (textToSend || inputMessage).trim();
    const activeSnippet = attachedSnippet;

    if ((!rawText && !activeSnippet) || chatbotMutation.isPending) return;

    const text = rawText || (activeSnippet ? `Extract and analyze the attached document: ${activeSnippet.fileName}` : '');
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: currentTime,
      attachment: activeSnippet
        ? {
            fileName: activeSnippet.fileName,
            fileType: activeSnippet.fileType,
            characterCount: activeSnippet.characterCount,
            previewUrl: activeSnippet.previewUrl,
          }
        : undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');
    setAttachedSnippet(null); // Clear active snippet so it's not permanently stuck in the bottom input bar

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
        attached_snippet: activeSnippet?.text || (activeSnippet ? `[Attached File: ${activeSnippet.fileName}]` : null),
        attached_file_name: activeSnippet?.fileName || null,
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
    } catch (err: unknown) {
      const errorMsg = (err as { message?: string })?.message || 'Failed to connect to AI Agent service.';
      const fallbackAssistantMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content: `**AI Assistant Notice**: ${errorMsg}\n\nPlease check your backend connection or retry in a few moments.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackAssistantMsg]);
    }
  };

  // Trigger file dialog asking Image, PDF, or DOC
  const handleTriggerUpload = (type: 'pdf' | 'doc' | 'image') => {
    setShowUploadMenu(false);
    if (!fileInputRef.current) return;

    if (type === 'pdf') {
      fileInputRef.current.accept = '.pdf,application/pdf';
    } else if (type === 'doc') {
      fileInputRef.current.accept =
        '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (type === 'image') {
      fileInputRef.current.accept = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp';
    }
    fileInputRef.current.click();
  };

  // Handle File Snippet Attachment & Extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const res: UploadSnippetResponse = await chatbotApi.uploadSnippet(file);
      const detectedType = res.fileType || (file.type.startsWith('image/') ? 'image' : file.name.endsWith('.pdf') ? 'pdf' : 'doc');
      setAttachedSnippet({
        fileName: res.fileName,
        fileType: detectedType,
        text: res.snippet,
        previewUrl: res.previewUrl || null,
        characterCount: res.characterCount,
      });
      toast({
        title: 'File Attached Successfully',
        description: `Attached ${res.fileName} (${detectedType.toUpperCase()}) to conversation context.`,
      });
    } catch {
      toast({
        title: 'Upload Failed',
        description: 'Could not extract content from the uploaded file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingFile(false);
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

  // Parse structured sections: Key Details, Inclusion/Exclusion Criteria, Text
  const parseStructuredMessage = (content: string): ParsedMessage => {
    const hasKeyDetails = content.includes('### Key Details');
    const hasInclusion = content.includes('### Inclusion Criteria');

    if (!hasKeyDetails && !hasInclusion) {
      return {
        type: 'plain',
        content,
        preamble: '',
        keyDetailsList: [],
        inclusionList: [],
        exclusionList: [],
      };
    }

    let preamble = '';
    const keyDetailsList: { label: string; value: string }[] = [];
    const inclusionList: string[] = [];
    const exclusionList: string[] = [];

    const lines = content.split('\n');
    let currentMode: 'preamble' | 'key_details' | 'inclusion' | 'exclusion' = 'preamble';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '### Key Details') {
        currentMode = 'key_details';
        continue;
      }
      if (trimmed === '### Inclusion Criteria') {
        currentMode = 'inclusion';
        continue;
      }
      if (trimmed === '### Exclusion Criteria') {
        currentMode = 'exclusion';
        continue;
      }

      if (currentMode === 'preamble') {
        if (!trimmed.startsWith('#')) {
          preamble += `${line}\n`;
        }
      } else if (currentMode === 'key_details') {
        if (trimmed.startsWith('- **') || trimmed.startsWith('* **')) {
          const match = trimmed.match(/^[-*]\s*\*\*([^*]+)\*\*:\s*(.+)$/);
          if (match) {
            keyDetailsList.push({ label: match[1], value: match[2] });
          } else {
            keyDetailsList.push({ label: 'Item', value: trimmed.replace(/^[-*]\s*/, '') });
          }
        }
      } else if (currentMode === 'inclusion') {
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          inclusionList.push(trimmed.replace(/^[-*]\s+/, ''));
        }
      } else if (currentMode === 'exclusion') {
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          exclusionList.push(trimmed.replace(/^[-*]\s+/, ''));
        }
      }
    }

    return {
      type: hasInclusion ? 'criteria' : 'key_details',
      preamble: preamble.trim(),
      keyDetailsList,
      inclusionList,
      exclusionList,
    };
  };

  const userName = user?.fullName || 'Ranjan';

  return (
    <>
      {/* ============================================================== */}
      {/* 1. FLOATING LAUNCHER BUTTON (Standout, High-Contrast & Visible)*/}
      {/* ============================================================== */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in duration-200">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            style={{ backgroundColor: '#4338ca', color: '#ffffff' }}
            className="flex items-center gap-3 px-4 py-3 bg-[#4338ca] hover:bg-[#3730a3] bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 text-white rounded-full shadow-2xl hover:shadow-indigo-500/40 border border-indigo-300/40 transition-all transform hover:scale-105 active:scale-95 group"
            aria-label="Open ProtocolAI Assistant"
          >
            <div className="relative flex items-center justify-center h-8 w-8 rounded-full bg-white/20 text-white shrink-0">
              <Bot className="h-5 w-5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-white" />
              </span>
            </div>
            <div className="text-left pr-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-wide" style={{ color: '#ffffff' }}>
                  ProtocolAI Assistant
                </span>
                <Sparkles className="h-3 w-3 text-amber-300 shrink-0" />
              </div>
              <span className="text-[10px] font-medium text-indigo-100 flex items-center gap-1" style={{ color: '#e0e7ff' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>RAG Agent Online</span>
              </span>
            </div>
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. COMPACT, CLEAN FLOATING CHATBOT WINDOW (Single-Column)      */}
      {/* ============================================================== */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl transition-all duration-300 overflow-hidden ${
            isExpanded
              ? 'w-[92vw] max-w-[720px] h-[82vh] max-h-[800px]'
              : 'w-[450px] max-w-[calc(100vw-1.5rem)] h-[590px] max-h-[82vh]'
          }`}
        >
          {/* Top Header Bar (High-Contrast Gradient with Title & Controls) */}
          <div
            style={{ backgroundColor: '#4338ca', color: '#ffffff' }}
            className="px-4 py-3 bg-[#4338ca] bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 text-white flex items-center justify-between shrink-0 shadow-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0 border border-white/20">
                <Bot className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold tracking-tight text-white shrink-0 whitespace-nowrap">
                    ProtocolAI Assistant
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-300/40 text-[9px] font-semibold text-emerald-200 flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    RAG Agent
                  </span>
                </div>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1 text-white/90">
              {/* Compact Study Context Selector */}
              {studies.length > 0 && (
                <select
                  value={selectedStudyId}
                  onChange={(e) => setSelectedStudyId(e.target.value)}
                  title="Active study context for AI retrieval"
                  className="bg-white/15 hover:bg-white/25 text-white text-[10px] font-medium rounded-lg px-2 py-1 border border-white/25 focus:outline-none max-w-[110px] truncate cursor-pointer transition-colors"
                >
                  {studies.map((s) => (
                    <option key={s.id} value={s.id} className="text-slate-900 bg-white">
                      {s.title}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleResetChat}
                title="Clear conversation"
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restore window size' : 'Expand window'}
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors"
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chatbot"
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Area (Clean, Slate-50 background, Zero inbuild clutter) */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#f8fafc]">
            {/* Simple Clean Welcome Greeting */}
            {messages.length === 0 && (
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-xs space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Hello {userName}! 👋
                  </h4>
                </div>
                <p className="text-xs text-slate-600 pl-9">
                  How can I assist you with your clinical protocols or research queries today?
                </p>
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const parsed = !isUser ? parseStructuredMessage(msg.content) : null;

              return (
                <div key={msg.id} className="space-y-1">
                  {isUser ? (
                    /* User Message Bubble */
                    <div className="flex items-end justify-end gap-2">
                      <div className="flex flex-col items-end max-w-[85%]">
                        {/* Attached File Chip if present */}
                        {msg.attachment && (
                          <div className="mb-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-950 shadow-2xs">
                            <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                              {msg.attachment.fileName}
                            </span>
                            <span className="text-[9px] text-indigo-500 font-bold uppercase">
                              {msg.attachment.fileType}
                            </span>
                          </div>
                        )}
                        <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-600 text-white text-xs shadow-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                      </div>
                    </div>
                  ) : (
                    /* Bot Message Bubble with Structured Cards */
                    <div className="flex items-start gap-2 max-w-[95%]">
                      <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200 mt-0.5">
                        <Bot className="h-4 w-4 text-indigo-700" />
                      </div>

                      <div className="flex-1 space-y-2.5">
                        <div className="p-3.5 rounded-2xl rounded-tl-sm bg-white border border-slate-200/90 shadow-sm text-xs text-slate-800 space-y-3">
                          {/* Preamble / Plain content */}
                          {parsed?.preamble ? (
                            <p className="leading-relaxed text-slate-700 font-normal whitespace-pre-wrap">
                              {parsed.preamble}
                            </p>
                          ) : parsed?.type === 'plain' ? (
                            <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">
                              {msg.content}
                            </p>
                          ) : null}

                          {/* Key Details Card */}
                          {parsed?.type === 'key_details' && parsed.keyDetailsList.length > 0 && (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                                <Target className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Key Details</span>
                              </div>
                              <ul className="space-y-1 text-slate-700 text-xs">
                                {parsed.keyDetailsList.map((item, kIdx) => (
                                  <li key={kIdx} className="flex items-start gap-1.5">
                                    <span className="text-slate-400 font-bold">•</span>
                                    <span>
                                      <strong className="text-slate-900 font-semibold">{item.label}:</strong> {item.value}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Inclusion & Exclusion Criteria Cards */}
                          {parsed?.type === 'criteria' && (
                            <div className="grid grid-cols-1 gap-2 pt-0.5">
                              {/* Inclusion Card */}
                              {parsed.inclusionList.length > 0 && (
                                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Inclusion Criteria</span>
                                  </div>
                                  <ul className="space-y-1 text-[11px] text-emerald-950">
                                    {parsed.inclusionList.map((item, iIdx) => (
                                      <li key={iIdx} className="flex items-start gap-1.5">
                                        <Check className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Exclusion Card */}
                              {parsed.exclusionList.length > 0 && (
                                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                                    <XCircle className="h-3.5 w-3.5 text-rose-600" />
                                    <span>Exclusion Criteria</span>
                                  </div>
                                  <ul className="space-y-1 text-[11px] text-rose-950">
                                    {parsed.exclusionList.map((item, eIdx) => (
                                      <li key={eIdx} className="flex items-start gap-1.5">
                                        <X className="h-3 w-3 text-rose-600 shrink-0 mt-0.5" />
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sources Card */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs space-y-1">
                              <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-[11px]">
                                <BookOpen className="h-3 w-3 text-indigo-600" />
                                <span>Verified Sources</span>
                              </div>
                              <div className="space-y-1 text-[11px] text-slate-700">
                                {msg.citations.slice(0, 3).map((cite, cIdx) => (
                                  <div key={cIdx} className="flex items-center gap-1.5 truncate">
                                    <FileText className="h-3 w-3 text-indigo-500 shrink-0" />
                                    <span className="font-medium text-slate-800 truncate">
                                      {cite.document_title || (cite as any).file_name || 'Protocol Document.pdf'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 shrink-0">
                                      ({(cite as any).page_info || `Section ${cite.section}`})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Timestamp & Copy Action */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                          <span>{msg.timestamp}</span>
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
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {chatbotMutation.isPending && (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200 mt-0.5 animate-spin">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 shadow-xs">
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                    <span>Analyzing Protocol Knowledge Base...</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Semantic Search → Pinecone Context Grounding
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ============================================================== */}
          {/* 3. ATTACHED FILE PREVIEW CHIP (Image / PDF / DOC)              */}
          {/* ============================================================== */}
          {attachedSnippet && (
            <div className="px-3.5 py-2 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between text-xs text-indigo-950 shrink-0">
              <div className="flex items-center gap-2 truncate min-w-0">
                {attachedSnippet.fileType === 'image' && attachedSnippet.previewUrl ? (
                  <img
                    src={attachedSnippet.previewUrl}
                    alt={attachedSnippet.fileName}
                    className="h-8 w-8 rounded-lg object-cover border border-indigo-200 shrink-0"
                  />
                ) : attachedSnippet.fileType === 'pdf' ? (
                  <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
                    <FileText className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
                    <FileCode className="h-4 w-4" />
                  </div>
                )}
                <div className="truncate">
                  <p className="font-medium text-xs text-indigo-950 truncate">
                    {attachedSnippet.fileName}
                  </p>
                  <p className="text-[10px] text-indigo-600">
                    {attachedSnippet.fileType.toUpperCase()} • {attachedSnippet.characterCount} chars extracted
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAttachedSnippet(null)}
                title="Remove attached file"
                className="text-indigo-400 hover:text-indigo-700 p-1 rounded-md hover:bg-indigo-100 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Uploading progress indicator */}
          {isUploadingFile && (
            <div className="px-3.5 py-1.5 bg-amber-50 border-t border-amber-200 flex items-center gap-2 text-xs text-amber-900 shrink-0">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
              <span>Processing and extracting protocol text...</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* 4. CHAT INPUT & UPLOAD MENU POPUP                              */}
          {/* ============================================================== */}
          <div className="p-3 bg-white border-t border-slate-200 relative shrink-0">
            {/* Upload Selector Popover (PDF, Word DOC, Image) */}
            {showUploadMenu && (
              <div
                ref={uploadMenuRef}
                className="absolute bottom-14 left-3 z-30 w-64 rounded-xl bg-white border border-slate-200 shadow-xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-800">Attach Protocol Document / Image</span>
                  <button
                    type="button"
                    onClick={() => setShowUploadMenu(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Option 1: PDF Document */}
                <button
                  type="button"
                  onClick={() => handleTriggerUpload('pdf')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors group"
                >
                  <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 group-hover:bg-rose-100">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">PDF Document</p>
                    <p className="text-[10px] text-slate-500">.pdf clinical protocol, SAP</p>
                  </div>
                </button>

                {/* Option 2: Word Document (DOC / DOCX) */}
                <button
                  type="button"
                  onClick={() => handleTriggerUpload('doc')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors group"
                >
                  <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:bg-blue-100">
                    <FileCode className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Word Document</p>
                    <p className="text-[10px] text-slate-500">.doc, .docx study design, CRF</p>
                  </div>
                </button>

                {/* Option 3: Image (PNG, JPG, WEBP) */}
                <button
                  type="button"
                  onClick={() => handleTriggerUpload('image')}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors group"
                >
                  <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:bg-emerald-100">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Image / Diagram</p>
                    <p className="text-[10px] text-slate-500">.png, .jpg, .webp charts, diagrams</p>
                  </div>
                </button>
              </div>
            )}

            {/* Hidden dynamic file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />

            <div className="flex items-center gap-2">
              {/* Paperclip Button toggles popup asking Image / PDF / DOC */}
              <button
                type="button"
                onClick={() => setShowUploadMenu(!showUploadMenu)}
                title="Attach Image, PDF, or Word Document"
                className={`p-2 rounded-xl transition-colors shrink-0 ${
                  showUploadMenu
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                <Paperclip className="h-4.5 w-4.5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={attachedSnippet ? `Ask a question about ${attachedSnippet.fileName}...` : "Ask a question about your protocol or study..."}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
              />

              {/* Send Button */}
              <Button
                type="button"
                size="sm"
                onClick={() => handleSendMessage()}
                disabled={(!inputMessage.trim() && !attachedSnippet) || chatbotMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-8.5 w-8.5 p-0 flex items-center justify-center shrink-0 disabled:opacity-40 shadow-xs transition-colors"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
