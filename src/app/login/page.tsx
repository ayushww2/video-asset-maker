"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) router.replace(searchParams.get("next") || "/");
      })
      .catch(() => undefined);
  }, [router, searchParams]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.replace(searchParams.get("next") || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <div className="panel space-y-5 p-6">
        <div>
          <p className="font-[family-name:var(--font-ibm-plex-mono)] text-[0.7rem] uppercase tracking-[0.18em] text-[var(--accent)]">
            Hook clip factory
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Sign in</h1>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="label" htmlFor="username">
              Username
            </label>
            <input id="username" className="field" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input id="password" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <button className="btn w-full" disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[var(--muted)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
