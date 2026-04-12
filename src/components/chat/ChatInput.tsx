import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Paperclip, X, FileText, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseFile, type ParsedFileResult } from "@/lib/file-parser";

interface FileAttachment {
  file: File;
  preview?: string;
  type: string;
  parsedResult?: ParsedFileResult;
  isParsing?: boolean;
}

interface ChatInputProps {
  onSend: (text: string, fileData?: { type: string; content: string; fileName: string } | null) => void;
  disabled?: boolean;
  initialValue?: string;
  supportsFileUpload?: boolean;
}

const ACCEPTED_TYPES: Record<string, string[]> = {
  image: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/bmp"],
  pdf: ["application/pdf"],
  word: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
};

const ALL_ACCEPTED = Object.values(ACCEPTED_TYPES).flat();
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getFileCategory(mime: string): string {
  for (const [cat, types] of Object.entries(ACCEPTED_TYPES)) {
    if (types.includes(mime)) return cat;
  }
  return "unknown";
}

function getFileIcon(category: string) {
  switch (category) {
    case "image": return Image;
    default: return FileText;
  }
}

export function ChatInput({ onSend, disabled, initialValue, supportsFileUpload, onFileFromDrop }: ChatInputProps & { onFileFromDrop?: File }) {
  const [text, setText] = useState(initialValue || "");
  const [isListening, setIsListening] = useState(false);
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    if (initialValue) {
      setText(initialValue);
      finalTranscriptRef.current = initialValue;
      textareaRef.current?.focus();
    }
  }, [initialValue]);

  const processFile = useCallback(async (file: File) => {
    if (!ALL_ACCEPTED.includes(file.type)) {
      toast.error("Unsupported file type", { description: "Please upload an image, PDF, or Word doc." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large", { description: "Maximum size is 10MB." });
      return;
    }

    const category = getFileCategory(file.type);
    const att: FileAttachment = { file, type: category, isParsing: true };
    if (category === "image") att.preview = URL.createObjectURL(file);
    setAttachment(att);

    try {
      const parsed = await parseFile(file);
      setAttachment(prev => prev ? { ...prev, parsedResult: parsed, isParsing: false } : null);
      toast.success(`${file.name} analysed successfully`, { description: "File content extracted and ready to send." });
    } catch (err) {
      console.error("File parsing error:", err);
      setAttachment(prev => prev ? { ...prev, isParsing: false } : null);
      toast.error("Failed to extract text", { description: "You can still send the message." });
    }
  }, []);

  // Handle file from drag-and-drop
  useEffect(() => {
    if (onFileFromDrop && !attachment) {
      processFile(onFileFromDrop);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFileFromDrop]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [text]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview);
    setAttachment(null);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || disabled) return;
    if (attachment?.isParsing) {
      toast.warning("Please wait for the file to finish analysing.");
      return;
    }

    let fileData: { type: string; content: string; fileName: string } | null = null;

    if (attachment?.parsedResult) {
      // Send the parsed text content instead of base64
      fileData = {
        type: attachment.file.type,
        content: attachment.parsedResult.text,
        fileName: attachment.file.name,
      };
    }

    const messageText = trimmed || (attachment ? `[Uploaded: ${attachment.file.name}]` : "");
    onSend(messageText, fileData);
    setText("");
    finalTranscriptRef.current = "";
    removeAttachment();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (!isListening) {
      finalTranscriptRef.current = e.target.value;
    }
  };

  const toggleVoice = useCallback(async () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast.error("Microphone permission denied.");
      } else {
        toast.error("Could not access microphone: " + (err.message || "Unknown error"));
      }
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    finalTranscriptRef.current = text;

    recognition.onresult = (event: any) => {
      let finalPart = "";
      let interimPart = "";
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalPart += transcript;
        } else {
          interimPart += transcript;
        }
      }
      const base = finalTranscriptRef.current.replace(/\s+$/, "");
      const sep = base ? " " : "";
      if (finalPart) {
        finalTranscriptRef.current = base + sep + finalPart.trim();
      }
      const display = finalTranscriptRef.current + (interimPart ? (finalTranscriptRef.current ? " " : "") + interimPart : "");
      setText(display);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      recognitionRef.current = null;
      if (event.error === "not-allowed") {
        toast.error("Microphone permission denied.");
      } else if (event.error !== "aborted") {
        toast.error("Voice recognition error: " + event.error);
      }
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      toast.error("Failed to start voice recognition.");
    }
  }, [isListening, text]);

  const FileIcon = attachment ? getFileIcon(attachment.type) : FileText;

  return (
    <div className="border-t border-border bg-background">
      {/* File attachment preview */}
      {attachment && (
        <div className="px-4 pt-3 pb-0">
          <div className="inline-flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 text-sm">
            {attachment.preview ? (
              <img src={attachment.preview} alt="preview" className="h-10 w-10 rounded object-cover" />
            ) : (
              <FileIcon className="h-5 w-5 text-primary" />
            )}
            <div className="flex flex-col">
              <span className="text-foreground truncate max-w-[200px]">{attachment.file.name}</span>
              {attachment.isParsing ? (
                <span className="text-xs analysing-shimmer font-medium flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analysing file...
                </span>
              ) : attachment.parsedResult ? (
                <span className="text-xs text-accent font-medium">✓ File analysed</span>
              ) : (
                <span className="text-xs text-muted-foreground">({(attachment.file.size / 1024).toFixed(0)}KB)</span>
              )}
            </div>
            <button onClick={removeAttachment} className="text-muted-foreground hover:text-destructive ml-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 p-4">
        {supportsFileUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALL_ACCEPTED.join(",")}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || !!attachment}
              className="text-muted-foreground hover:text-primary"
              type="button"
              aria-label="Attach file"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening..." : attachment ? "Describe what you want to know about this file..." : "Type a message..."}
          className="flex-1 resize-none rounded-xl border border-input bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring scrollbar-thin"
          rows={1}
          disabled={disabled}
        />
        <Button variant="ghost" size="icon" onClick={toggleVoice} className={isListening ? "text-destructive animate-pulse" : "text-muted-foreground"} type="button" aria-label={isListening ? "Stop listening" : "Start voice input"}>
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button size="icon" onClick={handleSend} disabled={(!text.trim() && !attachment) || disabled || (attachment?.isParsing ?? false)} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" type="button">
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
