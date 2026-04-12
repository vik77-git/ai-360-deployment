import { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { Bot } from "lucide-react";
import { Link } from "react-router-dom";

export function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-primary font-bold text-xl">
            <Bot className="h-6 w-6" />
            AI-360
          </Link>
          <ThemeToggle />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>

        {children}

        <p className="text-xs text-center text-muted-foreground">
          <Link to="/terms" className="underline hover:text-foreground">Terms</Link>
          {" · "}
          <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
