"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Flame, Lock, Mail } from "lucide-react";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const from = params.get("from") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"email" | "master">("email");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = mode === "email"
      ? { email, password }
      : { password };

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      window.location.href = from;
    } else {
      const data = await res.json();
      setError(data.error || "Authentication failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-4">
            <Flame size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Hekla Mission Control</h1>
          <p className="text-xs text-zinc-500 mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="surface p-6 space-y-3">
          {mode === "email" && (
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 input text-sm"
              />
            </div>
          )}

          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus={mode === "master"}
              className="w-full pl-10 pr-4 py-2.5 input text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password || (mode === "email" && !email)}
            className="w-full btn btn-primary"
          >
            {loading ? "..." : "Sign In"}
          </button>
        </form>

        <div className="text-center mt-4 space-y-1">
          <button
            onClick={() => { setMode(mode === "email" ? "master" : "email"); setError(""); }}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {mode === "email" ? "Use shared password instead" : "Sign in with email"}
          </button>
          <p className="text-[10px] text-zinc-700">
            Partners: use your <a href="/shared" className="text-zinc-500 hover:text-zinc-400">shared access link</a>
          </p>
        </div>
      </div>
    </div>
  );
}
