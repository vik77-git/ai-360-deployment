import { Copy, Pencil, Square, Bot, User, Check, ShoppingCart, ExternalLink, Package, Youtube, Globe } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import hljs from "highlight.js";

interface ProductCard {
  name: string;
  price: string;
  store: string;
  url: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  assistantName?: string;
  assistantId?: string;
  assistantGradient?: string;
  onEdit?: (content: string) => void;
  onStop?: () => void;
}

function parseProductCards(content: string): ProductCard[] {
  const products: ProductCard[] = [];
  const regex = /\[PRODUCT\]\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(.+?))?\s*\[\/PRODUCT\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    products.push({ name: match[1].trim(), price: match[2].trim(), store: match[3].trim(), url: match[4].trim() });
  }
  return products;
}

function cleanProductTags(content: string): string {
  return content.replace(/\[PRODUCT\].*?\[\/PRODUCT\]/gs, "").trim();
}

const storeStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  amazon: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300" },
  walmart: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" },
  "best buy": { bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300", badge: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300" },
  target: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300", badge: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300" },
  ebay: { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300", badge: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300" },
};

function getStoreStyle(store: string) {
  const key = store.toLowerCase();
  for (const [name, style] of Object.entries(storeStyles)) {
    if (key.includes(name)) return style;
  }
  return { bg: "bg-primary/5", border: "border-primary/20", text: "text-primary", badge: "bg-primary/10 text-primary" };
}

function ShoppingCards({ products }: { products: ProductCard[] }) {
  if (products.length === 0) return null;
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <ShoppingCart className="h-3.5 w-3.5" /> Product Recommendations
      </p>
      <div className="grid grid-cols-1 gap-3">
        {products.map((p, i) => {
          const style = getStoreStyle(p.store);
          return (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
              className={`group block rounded-xl border-2 ${style.border} ${style.bg} p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg ${style.badge} flex items-center justify-center flex-shrink-0`}>
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{p.name}</p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${style.badge}`}>{p.store}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-lg font-bold text-foreground">{p.price}</span>
                  <div className={`w-8 h-8 rounded-full ${style.badge} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function LoadingIndicator({ gradient, name }: { gradient?: string; name?: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient || "from-blue-500 to-cyan-400"} flex items-center justify-center`}>
        <Bot className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="flex items-center gap-2 bg-secondary rounded-2xl rounded-tl-md px-4 py-3">
        {name && <span className="text-xs font-medium text-muted-foreground mr-1">{name}</span>}
        <span className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-primary loading-dot" />
          <span className="w-2 h-2 rounded-full bg-primary loading-dot" />
          <span className="w-2 h-2 rounded-full bg-primary loading-dot" />
        </span>
      </div>
    </div>
  );
}

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const code = String(children).replace(/\n$/, "");

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.removeAttribute("data-highlighted");
      codeRef.current.textContent = code;
      if (language) {
        codeRef.current.className = `language-${language} hljs`;
      } else {
        codeRef.current.className = "hljs";
      }
      hljs.highlightElement(codeRef.current);
    }
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langColors: Record<string, string> = {
    python: "bg-blue-600", javascript: "bg-yellow-600", typescript: "bg-blue-500",
    html: "bg-orange-600", css: "bg-purple-600", java: "bg-red-600",
    cpp: "bg-indigo-600", c: "bg-gray-600", rust: "bg-orange-700",
    go: "bg-cyan-600", ruby: "bg-red-500", php: "bg-violet-600",
    swift: "bg-orange-500", kotlin: "bg-purple-500", sql: "bg-emerald-600",
    bash: "bg-green-700", shell: "bg-green-700", json: "bg-gray-500",
    yaml: "bg-pink-600", xml: "bg-teal-600", dart: "bg-sky-500",
    jsx: "bg-cyan-500", tsx: "bg-blue-400",
  };

  const headerBg = langColors[language] || "bg-gray-700";

  if (!match) {
    return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">{children}</code>;
  }

  return (
    <div className="rounded-xl overflow-hidden my-3 border border-border shadow-sm">
      <div className={`flex items-center justify-between px-4 py-2 ${headerBg}`}>
        <span className="text-xs font-semibold uppercase tracking-wider text-primary-foreground">{language || "code"}</span>
        <button onClick={handleCopy} className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-primary-foreground/20 transition-colors text-primary-foreground">
          {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
      <div className="bg-[#1e1e2e] p-4 overflow-x-auto">
        <pre className="text-sm font-mono leading-relaxed whitespace-pre !bg-transparent !p-0 !m-0">
          <code ref={codeRef} className={language ? `language-${language}` : ""}>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export function ChatMessage({ role, content, isStreaming, assistantName, assistantId, assistantGradient, onEdit, onStop }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";
  const isShopping = assistantId === "shopping";

  const products = useMemo(() => isShopping ? parseProductCards(content) : [], [content, isShopping]);
  const cleanContent = useMemo(() => isShopping ? cleanProductTags(content) : content, [content, isShopping]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isUser && isStreaming && !content) {
    return <LoadingIndicator gradient={assistantGradient} name={assistantName} />;
  }

  const markdownComponents: any = {
    code: ({ className, children, ...props }: any) => {
      const isBlock = /language-/.test(className || "") || String(children).includes("\n");
      if (isBlock) {
        return <CodeBlock className={className}>{children}</CodeBlock>;
      }
      return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground" {...props}>{children}</code>;
    },
    pre: ({ children }: any) => <>{children}</>,
    a: ({ href, children }: any) => {
      const isYoutube = href?.includes("youtube.com") || href?.includes("youtu.be");
      return (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 font-medium hover:underline ${isYoutube ? "text-red-500 dark:text-red-400" : "text-blue-500 dark:text-blue-400"}`}>
          {isYoutube ? <Youtube className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
          {children}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-start gap-3 px-4 py-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${assistantGradient || "from-blue-500 to-cyan-400"} flex items-center justify-center flex-shrink-0`}>
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? "order-first" : ""}`}>
        {!isUser && assistantName && (
          <p className="text-xs font-medium text-muted-foreground mb-1">{assistantName}</p>
        )}

        {isUser ? (
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-2.5">
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          </div>
        ) : (
          <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-tl-md px-4 py-2.5">
            <div className="ai-response-content text-sm">
              <ReactMarkdown components={markdownComponents}>{cleanContent}</ReactMarkdown>
              {isStreaming && (
                <span className="inline-flex gap-1 ml-1 align-middle">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary typing-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary typing-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary typing-dot" />
                </span>
              )}
            </div>
          </div>
        )}

        {isShopping && products.length > 0 && <ShoppingCards products={products} />}

        <div className="flex items-center gap-1 mt-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy} title="Copy">
            {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
          </Button>
          {isUser && onEdit && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(content)} title="Edit">
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
          {!isUser && isStreaming && onStop && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onStop} title="Stop">
              <Square className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
      )}
    </motion.div>
  );
}
