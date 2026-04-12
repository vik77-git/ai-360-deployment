import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { assistants } from "@/lib/assistants";
import { Bot, ArrowRight, Zap, Shield, Globe, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Zap, title: "Lightning Fast", desc: "Real-time word-by-word streaming with intelligent multi-model fallback." },
  { icon: Shield, title: "Private & Secure", desc: "Your API keys stay on your server. No data leaves your control." },
  { icon: Globe, title: "Multi-Purpose", desc: "Specialized AI assistants for every task you can imagine." },
  { icon: MessageSquare, title: "Smart Conversations", desc: "Context-aware responses with beautiful markdown rendering." },
];

export default function Index() {
  const { user } = useAuth();

  const marqueeItems = [...assistants, ...assistants, ...assistants];

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-primary font-bold text-xl">
          <Bot className="h-6 w-6" /> AI-360
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to={user ? "/chat" : "/login"}>
            <Button variant="default" size="sm">
              {user ? "Open Chat" : "Sign In"}
            </Button>
          </Link>
        </div>
      </nav>

      <section className="text-center py-20 px-6 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
            Your AI Companion <br className="hidden sm:block" /> for Everything
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Specialized AI assistants — from coding to creative writing — all with real-time streaming, voice input, and intelligent model fallback.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to={user ? "/chat" : "/login"}>
              <Button size="lg" className="gap-2">
                Start Chatting <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/chat">
              <Button size="lg" variant="outline" className="gap-2">
                Try Without Login <MessageSquare className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="py-10 px-6 max-w-6xl mx-auto">
        <div className="marquee-track">
          <div className="marquee-content">
            {marqueeItems.map((a, i) => {
              const Icon = a.icon;
              return (
                <div
                  key={`${a.id}-${i}`}
                  className="flex-shrink-0 w-56 rounded-xl border border-border bg-card p-4 space-y-2"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${a.gradient} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">{a.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{a.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }} className="rounded-xl border border-border bg-card p-6 space-y-3">
              <f.icon className="h-8 w-8 text-primary" />
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 text-center">
        <div className="max-w-xl mx-auto bg-primary/5 rounded-2xl p-10 border border-primary/20">
          <h2 className="text-2xl font-bold text-foreground mb-3">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6">Create your free account and start chatting with AI assistants in seconds.</p>
          <Link to="/register">
            <Button size="lg" className="gap-2">Get Started Free <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 px-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} AI-360. All rights reserved.</p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
