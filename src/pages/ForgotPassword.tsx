import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPassword(email)) {
      setSent(true);
      toast.success("Password reset link sent (simulated)");
    } else {
      toast.error("No account found with this email");
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email to receive a reset link">
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We've sent a password reset link to <strong className="text-foreground">{email}</strong> (simulated).
          </p>
          <Link to="/login">
            <Button variant="outline" className="w-full">Back to Sign In</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <Button type="submit" className="w-full">Send Reset Link</Button>
          <Link to="/login" className="block text-center text-sm text-primary hover:underline">
            Back to Sign In
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
