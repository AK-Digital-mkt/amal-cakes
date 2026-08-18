import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — Selam Cake Shop" },
      { name: "description", content: "Secure admin sign-in for Selam Cake Shop." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedEmail = emailSchema.safeParse(email);
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedEmail.success) return setError(parsedEmail.error.issues[0].message);
    if (!parsedPassword.success) return setError(parsedPassword.error.issues[0].message);

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsedEmail.data,
          password: parsedPassword.data,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: parsedEmail.data,
          password: parsedPassword.data,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
      }
      navigate({ to: "/admin" });
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "linear-gradient(135deg, #ffffff 0%, #fef5f7 50%, #ddf8f8 100%)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
          <img src="/selam-logo.png" alt="" className="w-10 h-10 group-hover:scale-110 transition-transform rounded" />
          <span className="font-display text-3xl font-semibold text-[#2d2029]">Selam</span>
        </Link>

        <div className="glass rounded-3xl p-8 shadow-[var(--shadow-elegant)] border border-[#f0d5dc]">
          <h1 className="font-display text-2xl font-bold text-[#2d2029]">
            {mode === "signin" ? "Welcome back" : "Create admin account"}
          </h1>
          <p className="text-sm text-[#8b6b73] mt-1">
            {mode === "signin"
              ? "Sign in to manage your bakery"
              : "The first account becomes the shop admin"}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] bg-white px-4 py-3 outline-none focus:border-[#f5a1ad] focus:ring-2 focus:ring-[#fadadd] transition-all"
                placeholder="owner@selamcakes.et"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8b6b73] uppercase tracking-wider">Password</label>
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-[#f0d5dc] bg-white px-4 py-3 outline-none focus:border-[#f5a1ad] focus:ring-2 focus:ring-[#fadadd] transition-all"
                placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#f0d5dc] text-center text-sm">
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
              className="text-[#e88aab] font-semibold hover:underline"
            >
              {mode === "signin" ? "Need to create the first admin? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-[#8b6b73] hover:text-[#2d2029]">← Back to the shop</Link>
        </div>
      </div>
    </div>
  );
}
