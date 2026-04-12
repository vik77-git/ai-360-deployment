import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Server } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate("/login", { replace: true }); }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link to="/chat">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <ThemeToggle />
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Account</h2>
          <p className="text-sm text-muted-foreground">Signed in as <strong className="text-foreground">{user.email}</strong></p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Backend Connection</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            AI API keys are securely managed on the backend server via environment variables.
            Configure your keys in the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.env</code> file on your server.
          </p>
          <div className="bg-muted rounded-xl p-4 text-xs font-mono space-y-1">
            <p className="text-muted-foreground">VITE_GEMINI_K=your_key_here</p>
            <p className="text-muted-foreground">VITE_OPENROUTER_K=your_key_here</p>
            <p className="text-muted-foreground">VITE_GROQ_K=your_key_here</p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Model Fallback Chain</h2>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li><strong className="text-foreground">Gemini</strong> — gemini-2.5-flash</li>
            <li><strong className="text-foreground">OpenRouter</strong> — gemma-3-12b → gemma-3n-e4b → gemma-3-27b → nemotron-3</li>
            <li><strong className="text-foreground">Groq</strong> — gpt-oss-120b → qwen3-32b → llama-3.1-8b → gpt-oss-20b</li>
          </ol>
          <p className="text-xs text-muted-foreground">If one model fails, the next one in the chain is used automatically.</p>
        </div>
      </div>
    </div>
  );
}
