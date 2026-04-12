import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { assistants, type Assistant } from "@/lib/assistants";
import { streamChat, type ChatMessage as Msg } from "@/lib/ai-providers";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Menu, Plus, Settings, LogOut, Bot, PanelLeftClose, PanelLeft, LogIn, Upload } from "lucide-react";
import { toast } from "sonner";

const ALL_ACCEPTED = [
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/bmp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let lastMessageTime = 0;
const MIN_INTERVAL_MS = 1500;

export default function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeAssistant, setActiveAssistant] = useState<Assistant>(assistants[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | undefined>(undefined);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const newChat = () => {
    setMessages([]);
    setIsStreaming(false);
    abortRef.current?.abort();
  };

  const selectAssistant = (a: Assistant) => {
    setActiveAssistant(a);
    newChat();
    setMobileSidebarOpen(false);
  };

  const sendMessage = useCallback(async (text: string, fileData?: { type: string; content: string; fileName: string } | null) => {
    const now = Date.now();
    if (now - lastMessageTime < MIN_INTERVAL_MS) {
      toast.warning("Please wait before sending another message.");
      return;
    }
    lastMessageTime = now;

    try {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setEditValue("");

      const controller = new AbortController();
      abortRef.current = controller;

      const allMsgs: Msg[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let assistantContent = "";
      const assistantId = Date.now().toString() + "_ai";

      await streamChat({
        messages: allMsgs,
        systemPrompt: activeAssistant.systemPrompt,
        fileData: fileData || undefined,
        onDelta: (chunk: string) => {
          assistantContent += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantId) {
              return prev.map((m) =>
                m.id === assistantId ? { ...m, content: assistantContent } : m
              );
            }
            return [...prev, { id: assistantId, role: "assistant", content: assistantContent }];
          });
        },
        onDone: () => {
          setIsStreaming(false);
        },
        onError: (err: string) => {
          toast.error(err);
          setIsStreaming(false);
        },
        signal: controller.signal,
      });
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong.");
      setIsStreaming(false);
    }
  }, [messages, activeAssistant]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleEdit = (content: string) => {
    const idx = messages.findIndex((m) => m.content === content && m.role === "user");
    if (idx >= 0) setMessages(messages.slice(0, idx));
    setEditValue(content);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeAssistant.supportsFileUpload) {
      setIsDragOver(true);
    }
  }, [activeAssistant]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!activeAssistant.supportsFileUpload) {
      toast.error("This assistant doesn't support file uploads.");
      return;
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!ALL_ACCEPTED.includes(file.type)) {
      toast.error("Unsupported file type", {
        description: "Please upload an image, PDF, or Word document.",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Maximum file size is 10MB.",
      });
      return;
    }

    setDroppedFile(file);
    toast.info(`${file.name} attached`, {
      description: "File will be analysed when you send a message.",
    });
  }, [activeAssistant]);

  const LoginBanner = () => (
    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mx-4 mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-foreground">
        <span className="font-medium">Sign in</span> to save your chats and unlock all features.
      </p>
      <Link to="/login">
        <Button size="sm" className="gap-1.5">
          <LogIn className="h-3.5 w-3.5" /> Login
        </Button>
      </Link>
    </div>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2 text-primary font-bold text-lg">
          <Bot className="h-5 w-5" /> AI-360
        </Link>
      </div>

      <div className="p-3">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={newChat}>
          <Plus className="h-4 w-4" /> New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Assistants</p>
        {assistants.map((a) => {
          const Icon = a.icon;
          const isActive = activeAssistant.id === a.id;
          return (
            <button
              key={a.id}
              onClick={() => selectAssistant(a)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${a.gradient} flex items-center justify-center`}>
                <Icon className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="text-left">
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground truncate">{a.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-border space-y-1">
        {user ? (
          <>
            <Link to="/settings">
              <Button variant="ghost" className="w-full justify-start gap-2 text-sm">
                <Settings className="h-4 w-4" /> Settings
              </Button>
            </Link>
            <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-destructive" onClick={() => { logout(); navigate("/"); }}>
              <LogOut className="h-4 w-4" /> Log Out
            </Button>
          </>
        ) : (
          <Link to="/login">
            <Button variant="default" className="w-full justify-start gap-2 text-sm">
              <LogIn className="h-4 w-4" /> Sign In
            </Button>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {desktopSidebarOpen && (
        <div className="hidden md:flex w-72 border-r border-border bg-card flex-shrink-0 animate-slide-in-left">
          <SidebarContent />
        </div>
      )}

      {mobileSidebarOpen && (
        <>
          <div className="fixed inset-0 bg-background/80 z-40 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-card border-r border-border z-50 md:hidden animate-slide-in-left">
            <SidebarContent />
          </div>
        </>
      )}

      <div
        className="flex-1 flex flex-col min-w-0 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && activeAssistant.supportsFileUpload && (
          <div className="absolute inset-0 z-30 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg m-2 flex flex-col items-center justify-center pointer-events-none">
            <Upload className="h-12 w-12 text-primary mb-3 animate-bounce" />
            <p className="text-lg font-semibold text-primary">Drop file here</p>
            <p className="text-sm text-muted-foreground mt-1">Image, PDF, or Word document</p>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}>
              {desktopSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
            </Button>
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${activeAssistant.gradient} flex items-center justify-center`}>
              <activeAssistant.icon className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">{activeAssistant.name}</p>
              <p className="text-xs text-muted-foreground">{activeAssistant.description}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {!user && <LoginBanner />}

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${activeAssistant.gradient} flex items-center justify-center mb-4`}>
                <activeAssistant.icon className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">{activeAssistant.name} Assistant</h2>
              <p className="text-muted-foreground text-sm max-w-md">{activeAssistant.description}</p>
              {activeAssistant.supportsFileUpload && (
                <p className="text-xs text-muted-foreground mt-3 bg-secondary px-3 py-1.5 rounded-full">
                  📎 Drag & drop or click 📎 to upload files
                </p>
              )}
            </div>
          ) : (
            <div className="py-4">
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  isStreaming={isStreaming && m === messages[messages.length - 1] && m.role === "assistant"}
                  assistantName={activeAssistant.name}
                  assistantId={activeAssistant.id}
                  assistantGradient={activeAssistant.gradient}
                  onEdit={m.role === "user" ? handleEdit : undefined}
                  onStop={handleStop}
                />
              ))}
            </div>
          )}
        </div>

        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming}
          initialValue={editValue}
          supportsFileUpload={activeAssistant.supportsFileUpload}
          onFileFromDrop={droppedFile}
        />
      </div>
    </div>
  );
}
