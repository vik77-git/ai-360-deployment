import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <ThemeToggle />
      </div>
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <h1>Privacy Policy</h1>
        <p><strong>Effective Date:</strong> March 5, 2026</p>
        <h2>1. Information We Collect</h2>
        <p>We collect account information (email, name) stored locally in your browser, chat messages processed during your session, and API keys you provide.</p>
        <h2>2. How We Use Your Information</h2>
        <p>Your information is used solely to authenticate you, send messages to AI providers, and display responses.</p>
        <h2>3. Data Storage</h2>
        <p>All user data including account credentials and chat history is stored locally in your browser using localStorage.</p>
        <h2>4. Third-Party Services</h2>
        <p>Your messages are sent to third-party AI providers (Google Gemini, OpenRouter, Groq) using your own API keys.</p>
        <h2>5. Data Security</h2>
        <p>We implement reasonable measures to protect your data. Security depends on your device and browser security practices.</p>
        <h2>6. Your Rights</h2>
        <p>You can delete your account data by clearing browser storage, remove API keys at any time, and clear chat history.</p>
        <h2>7. Children's Privacy</h2>
        <p>The Service is not intended for children under 13.</p>
        <h2>8. Changes to Policy</h2>
        <p>We may update this policy periodically.</p>
        <h2>9. Contact</h2>
        <p>For privacy concerns, contact us at privacy@ai-360.app.</p>
      </article>
    </div>
  );
}
