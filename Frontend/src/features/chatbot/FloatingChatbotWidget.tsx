import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStudiesList } from '@/hooks/useStudies';
import { useChatbotQuery } from '@/hooks/useChatbot';
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
  FileText,
  FlaskConical,
  Download,
  CheckCircle2,
  XCircle,
  Search,
  Target,
  ChevronDown,
  Layers,
  Copy,
  Check,
  User,
  Activity,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

interface ConversationHistoryItem {
  id: string;
  title: string;
  time: string;
  messageIndex: number;
}

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
  const [attachedSnippet, setAttachedSnippet] = useState<{ fileName: string; text: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyItems, setHistoryItems] = useState<ConversationHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Studies Data
  const { data: studiesData } = useStudiesList();
  const chatbotMutation = useChatbotQuery();

  const studies = Array.isArray(studiesData) ? studiesData : studiesData?.items || [];

  // Default active study if available
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

  // Handle Send Query
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || chatbotMutation.isPending) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: currentTime,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');

    // Add to sidebar conversation history
    const historyTitle = text.length > 28 ? `${text.slice(0, 28)}...` : text;
    const historyEntryId = `hist-${Date.now()}`;
    setHistoryItems((prev) => [
      ...prev,
      {
        id: historyEntryId,
        title: historyTitle,
        time: currentTime,
        messageIndex: newMessages.length - 1,
      },
    ]);
    setActiveHistoryId(historyEntryId);

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
    setHistoryItems([]);
    setAttachedSnippet(null);
    setActiveHistoryId(null);
    toast({
      title: 'Conversation Reset',
      description: 'Chat session cleared.',
    });
  };

  // Download Transcript Report
  const handleDownloadReport = () => {
    if (messages.length === 0) {
      toast({
        title: 'No Conversation to Export',
        description: 'Start a conversation before downloading the report.',
      });
      return;
    }

    const currentStudy = studies.find((s) => s.id === selectedStudyId);
    let transcript = `# ProtocolAI Research Assistant - Conversation Report\n`;
    transcript += `Study: ${currentStudy?.title || 'All Studies'} (${currentStudy?.protocolNumber || 'N/A'})\n`;
    transcript += `Generated: ${new Date().toLocaleString()}\n\n---\n\n`;

    messages.forEach((m) => {
      transcript += `### ${m.role === 'user' ? 'Researcher' : 'ProtocolAI Assistant'} (${m.timestamp})\n`;
      transcript += `${m.content}\n\n`;
    });

    const blob = new Blob([transcript], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProtocolAI_Report_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Report Downloaded',
      description: 'Conversation summary saved as Markdown document.',
    });
  };

  // Parse structured sections: Key Details, Inclusion/Exclusion Criteria, Text
  const parseStructuredMessage = (content: string): ParsedMessage => {
    const hasKeyDetails = content.includes('### Key Details');
    const hasInclusion = content.includes('### Inclusion Criteria');
    const hasExclusion = content.includes('### Exclusion Criteria');

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
      {/* 1. FLOATING LAUNCHER BUTTON (Bottom Right - Highlighted in Image 1) */}
      {/* ============================================================== */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in duration-200">
          <div className="relative group">
            {/* Glowing Aura */}
            <div className="absolute -inset-1 rounded-full bg-linear-to-r from-purple-600 via-indigo-600 to-blue-500 opacity-70 blur-xs group-hover:opacity-100 transition duration-300 animate-pulse" />

            <button
              onClick={() => setIsOpen(true)}
              className="relative flex items-center gap-2.5 px-4 py-3 bg-linear-to-r from-purple-700 via-purple-600 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white rounded-full shadow-xl transition-all transform hover:scale-105 active:scale-95"
              aria-label="Open ProtocolAI Research Assistant"
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
                  <span>ProtocolAI Assistant</span>
                  <Sparkles className="h-3 w-3 text-amber-300" />
                </p>
                <p className="text-[10px] text-purple-200 font-medium leading-none mt-0.5">
                  RAG Agent
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. EXPANDED TWO-PANEL CHATBOT WINDOW (Matching Mockup Exactly)  */}
      {/* ============================================================== */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-slate-300/80 bg-[#f4f6fb] shadow-2xl transition-all duration-300 overflow-hidden ${
            isExpanded
              ? 'w-[96vw] max-w-[1140px] h-[92vh] max-h-[92vh]'
              : 'w-[95vw] max-w-[1040px] h-[85vh] max-h-[800px]'
          }`}
        >
          {/* Top Header Bar */}
          <div className="px-5 py-3.5 bg-[#f8faff] border-b border-slate-200/90 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 shadow-2xs">
                <Bot className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight text-slate-900">
                    ProtocolAI Assistant
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-300 text-emerald-800 bg-emerald-50/80 py-0.5 px-2 flex items-center gap-1 font-semibold"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>RAG Agent</span>
                    <ChevronDown className="h-3 w-3 text-emerald-700" />
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Ask anything about your research protocol, study design, methodology, or uploaded documents.
                </p>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1.5 text-slate-500">
              <button
                type="button"
                onClick={handleResetChat}
                title="Clear conversation"
                className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restore window size' : 'Expand window'}
                className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize chatbot"
                className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Two-Column Workspace Container */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* ============================================================ */}
            {/* LEFT COLUMN: CHAT CONVERSATION AREA                          */}
            {/* ============================================================ */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#f4f6fb]">
              {/* Messages Area */}
              <div className="flex-1 p-5 overflow-y-auto space-y-5">
                {/* Clean Welcome Banner (Matching Mockup: No inbuild questions!) */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200">
                      <Bot className="h-5 w-5 text-purple-700" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Hello {userName}! 👋
                      </h4>
                      <p className="text-xs text-slate-600">
                        I'm your AI Research Assistant, I can help you with:
                      </p>
                    </div>
                  </div>

                  {/* 6 Clean Action Pills from Mockup */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSendMessage('What is the objective and key details of my study?')}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-700 text-xs font-medium transition-all shadow-2xs flex items-center gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 text-purple-600" />
                      <span>Study Summary</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendMessage('Compare our study protocol against the Admin Reference Protocol.')}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-700 text-xs font-medium transition-all shadow-2xs flex items-center gap-1.5"
                    >
                      <Search className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Protocol Comparison</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendMessage('Show me the test case analysis for my protocol.')}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-700 text-xs font-medium transition-all shadow-2xs flex items-center gap-1.5"
                    >
                      <FlaskConical className="h-3.5 w-3.5 text-blue-600" />
                      <span>Test Case Analysis</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendMessage('Generate candidate psychometric questions based on protocol endpoints.')}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-700 text-xs font-medium transition-all shadow-2xs flex items-center gap-1.5"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Generate Questions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendMessage('Show me the inclusion and exclusion criteria.')}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-700 text-xs font-medium transition-all shadow-2xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
                      <span>Inclusion / Exclusion Criteria</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendMessage('Explain the study methodology and statistical analysis plan.')}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-700 text-xs font-medium transition-all shadow-2xs flex items-center gap-1.5"
                    >
                      <Activity className="h-3.5 w-3.5 text-amber-600" />
                      <span>Methodology Explanation</span>
                    </button>
                  </div>
                </div>

                {/* Conversation Turns */}
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  const parsed = !isUser ? parseStructuredMessage(msg.content) : null;

                  return (
                    <div key={msg.id} className="space-y-1">
                      {isUser ? (
                        /* User Message Bubble */
                        <div className="flex items-end justify-end gap-2.5">
                          <div className="flex flex-col items-end">
                            <div className="px-4 py-2.5 rounded-2xl bg-purple-600 text-white text-xs max-w-md shadow-xs leading-relaxed">
                              {msg.content}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 mr-1">
                              {msg.timestamp}
                            </span>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 text-xs font-bold">
                            <User className="h-4 w-4" />
                          </div>
                        </div>
                      ) : (
                        /* Assistant Message Turn */
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 shadow-2xs mt-1">
                            <Bot className="h-4.5 w-4.5" />
                          </div>

                          <div className="flex-1 space-y-3 max-w-2xl">
                            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs text-slate-800 space-y-3">
                              {/* Preamble / Summary text */}
                              {parsed?.preamble ? (
                                <p className="leading-relaxed text-slate-700 font-normal">
                                  {parsed.preamble}
                                </p>
                              ) : parsed?.type === 'plain' ? (
                                <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">
                                  {msg.content}
                                </p>
                              ) : null}

                              {/* Key Details Card */}
                              {parsed?.type === 'key_details' && parsed.keyDetailsList.length > 0 && (
                                <div className="p-3.5 rounded-xl bg-[#f8faff] border border-[#e0e7ff] space-y-2">
                                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                                    <Target className="h-4 w-4 text-purple-600" />
                                    <span>Key Details</span>
                                  </div>
                                  <ul className="space-y-1 text-slate-700 text-xs">
                                    {parsed.keyDetailsList.map((item, kIdx) => (
                                      <li key={kIdx} className="flex items-start gap-2">
                                        <span className="text-slate-400 font-bold">•</span>
                                        <span>
                                          <strong className="text-slate-900 font-semibold">{item.label}:</strong> {item.value}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Inclusion & Exclusion Criteria Split Cards */}
                              {parsed?.type === 'criteria' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                  {/* Inclusion Card (Green) */}
                                  <div className="p-3.5 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] space-y-2">
                                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                      <span>Inclusion Criteria</span>
                                    </div>
                                    <ul className="space-y-1.5 text-[11px] text-emerald-950">
                                      {parsed.inclusionList.map((item, iIdx) => (
                                        <li key={iIdx} className="flex items-start gap-2">
                                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                          <span>{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* Exclusion Card (Red) */}
                                  <div className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] space-y-2">
                                    <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                                      <XCircle className="h-4 w-4 text-rose-600" />
                                      <span>Exclusion Criteria</span>
                                    </div>
                                    <ul className="space-y-1.5 text-[11px] text-rose-950">
                                      {parsed.exclusionList.map((item, eIdx) => (
                                        <li key={eIdx} className="flex items-start gap-2">
                                          <X className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                                          <span>{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}

                              {/* Sources Card (Matching Mockup: User_Protocol.pdf / Admin_Protocol.pdf) */}
                              <div className="p-3 rounded-xl bg-[#f0f4ff] border border-[#e0e7ff] text-xs space-y-1.5">
                                <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-[11px]">
                                  <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                                  <span>Sources</span>
                                </div>
                                <div className="space-y-1 text-[11px] text-slate-700">
                                  {msg.citations && msg.citations.length > 0 ? (
                                    msg.citations.slice(0, 3).map((cite, cIdx) => (
                                      <div key={cIdx} className="flex items-center gap-2">
                                        <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                        <span className="font-medium text-slate-800">
                                          {cite.document_title || (cite as any).file_name || 'Protocol Document.pdf'}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          ({(cite as any).page_info || `Section ${cite.section}`})
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                        <span className="font-medium text-slate-800">User_Protocol.pdf</span>
                                        <span className="text-[10px] text-slate-500">(Page 2, Section 1)</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                        <span className="font-medium text-slate-800">Admin_Protocol.pdf</span>
                                        <span className="text-[10px] text-slate-500">(Page 1, Section 3)</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
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
                                    <span>Copy response</span>
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

                {/* Loading Spinner Indicator */}
                {chatbotMutation.isPending && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200 shadow-2xs mt-1 animate-spin">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-700 space-y-1 shadow-2xs">
                      <p className="font-semibold text-slate-800">Analyzing Protocol Knowledge Base...</p>
                      <p className="text-[10px] text-slate-500">
                        Query Understanding → Pinecone Semantic Search → Grounded Verification
                      </p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* "You can also ask:" Horizontal Pill Suggestions (from Mockup) */}
              <div className="px-5 py-2 border-t border-slate-200/80 bg-[#f8faff] space-y-1.5 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  You can also ask:
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSendMessage('What is the study methodology?')}
                    className="px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-300 text-slate-600 hover:text-purple-700 text-[11px] whitespace-nowrap transition-colors shadow-2xs"
                  >
                    What is the study methodology?
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Generate test case analysis')}
                    className="px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-300 text-slate-600 hover:text-purple-700 text-[11px] whitespace-nowrap transition-colors shadow-2xs"
                  >
                    Generate test case analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Create research questions')}
                    className="px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-300 text-slate-600 hover:text-purple-700 text-[11px] whitespace-nowrap transition-colors shadow-2xs"
                  >
                    Create research questions
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage('Summarize the protocol')}
                    className="px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-300 text-slate-600 hover:text-purple-700 text-[11px] whitespace-nowrap transition-colors shadow-2xs"
                  >
                    Summarize the protocol
                  </button>
                </div>
              </div>

              {/* Attached Snippet Chip (if any) */}
              {attachedSnippet && (
                <div className="px-4 py-1.5 bg-purple-50 border-t border-purple-100 flex items-center justify-between text-xs text-purple-900">
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

              {/* Bottom Input Field */}
              <div className="p-4 bg-white border-t border-slate-200/90 shrink-0">
                <div className="flex items-center gap-2">
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
                    className="p-2 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-colors shrink-0"
                  >
                    <Paperclip className="h-4.5 w-4.5" />
                  </button>

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
                    placeholder="Ask a question about your protocol, study, or research guidelines..."
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white"
                  />

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || chatbotMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-9 w-9 p-0 flex items-center justify-center shrink-0 disabled:opacity-40 shadow-xs"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* RIGHT SIDEBAR: CHAT CONTEXT & QUICK ACTIONS (From Mockup)     */}
            {/* ============================================================ */}
            <div className="w-72 sm:w-80 border-l border-slate-200/90 bg-[#eef2f9] p-4 flex flex-col justify-between hidden md:flex shrink-0">
              <div className="space-y-5 overflow-y-auto">
                {/* 1. Chat Context */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                    Chat Context
                  </label>
                  <p className="text-[10px] text-slate-500 font-medium">Current Study</p>
                  <select
                    value={selectedStudyId}
                    onChange={(e) => setSelectedStudyId(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600 truncate shadow-2xs"
                  >
                    {studies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                    {studies.length === 0 && (
                      <option value="">Efficacy of Drug X in Type 2 Diabetes</option>
                    )}
                  </select>
                </div>

                {/* 2. Quick Actions */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                    Quick Actions
                  </label>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleSendMessage('What is the objective and key details of my study?')}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white hover:bg-purple-50/80 border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-purple-700 transition-colors shadow-2xs text-left"
                    >
                      <FileText className="h-4 w-4 text-purple-600" />
                      <span>Study Summary</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendMessage('Show me the test case analysis for my protocol.')}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white hover:bg-purple-50/80 border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-purple-700 transition-colors shadow-2xs text-left"
                    >
                      <FlaskConical className="h-4 w-4 text-indigo-600" />
                      <span>Test Case Analysis</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendMessage('Generate candidate questions for my study.')}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white hover:bg-purple-50/80 border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-purple-700 transition-colors shadow-2xs text-left"
                    >
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <span>Generate Questions</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white hover:bg-purple-50/80 border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-purple-700 transition-colors shadow-2xs text-left"
                    >
                      <Download className="h-4 w-4 text-emerald-600" />
                      <span>Download Report</span>
                    </button>
                  </div>
                </div>

                {/* 3. Conversation History */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                    Conversation History
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {historyItems.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic py-1">
                        Recent questions will appear here
                      </p>
                    ) : (
                      historyItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setActiveHistoryId(item.id);
                          }}
                          className={`p-2 rounded-xl border text-xs cursor-pointer transition-colors flex items-center justify-between gap-1 shadow-2xs ${
                            activeHistoryId === item.id
                              ? 'bg-purple-100/90 border-purple-300 text-purple-900 font-semibold'
                              : 'bg-white border-slate-200/80 text-slate-700 hover:bg-purple-50/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Search className="h-3 w-3 text-purple-600 shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{item.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Powered by RAG + LangGraph Dark Box (From Mockup) */}
              <div className="mt-4 p-3.5 rounded-2xl bg-[#0f172a] text-white space-y-2 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-tight text-white">
                    Powered by RAG + LangGraph
                  </span>
                  <div className="w-5 h-5 rounded-md bg-purple-600/30 text-purple-400 flex items-center justify-center">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="space-y-1 text-[10px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Semantic Search</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Context Aware</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Source Cited</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span>Agentic Reasoning</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
