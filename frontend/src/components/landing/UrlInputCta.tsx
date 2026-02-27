"use client";

import { useState } from "react";

export function UrlInputCta() {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      localStorage.setItem("pendingScrapeUrl", url);
      window.location.href = "/signup";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
      <div
        className="relative flex items-center rounded-full border border-border bg-card/90 transition-all duration-200 focus-within:border-primary/50 focus-within:shadow-[0_0_20px_rgba(249,115,22,0.14)]"
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste your product or store URL..."
          className="h-14 w-full rounded-full bg-transparent pl-5 pr-[150px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="submit"
          className="absolute right-1.5 h-11 rounded-full bg-primary px-6 text-sm font-medium text-white transition-colors hover:bg-orange-600"
        >
          Generate My First Ad Free →
        </button>
      </div>
    </form>
  );
}
