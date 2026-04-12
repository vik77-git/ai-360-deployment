import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <ThemeToggle />
      </div>
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <h1>Terms of Service</h1>
        <p><strong>Effective Date:</strong> March 5, 2026</p>
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using AI-360 ("the Service"), you agree to be bound by these Terms of Service.</p>
        <h2>2. Description of Service</h2>
        <p>AI-360 is a multi-model AI chat platform that provides access to various AI assistants.</p>
        <h2>3. User Accounts</h2>
        <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials.</p>
        <h2>4. API Keys</h2>
        <p>The Service requires API keys for AI providers (Google Gemini, OpenRouter, Groq). You are solely responsible for the security and usage of your API keys.</p>
        <h2>5. Acceptable Use</h2>
        <p>You agree not to use the Service for illegal purposes, attempt to reverse-engineer the Service, or transmit harmful content.</p>
        <h2>6. Limitation of Liability</h2>
        <p>The Service is provided "as is" without warranties. We are not liable for any damages arising from AI-generated responses.</p>
        <h2>7. Privacy</h2>
        <p>Your use of the Service is also governed by our Privacy Policy.</p>
        <h2>8. Changes to Terms</h2>
        <p>We reserve the right to modify these terms at any time.</p>
        <h2>9. Contact</h2>
        <p>For questions about these terms, please contact us at support@ai-360.app.</p>
      </article>
    </div>
  );
}
