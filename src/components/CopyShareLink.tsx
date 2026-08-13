"use client";

import { useState } from "react";

export default function CopyShareLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy share link:", url);
    }
  }

  return (
    <button type="button" className="btn" onClick={() => void copy()}>
      {copied ? "Link copied" : "Copy share link"}
    </button>
  );
}
