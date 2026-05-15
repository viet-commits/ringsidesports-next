"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface SearchBarProps {
  className?: string;
  compact?: boolean;
  placeholder?: string;
}

export function SearchBar({ className = "", compact = false, placeholder = "Search products..." }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div
        className={`flex items-center rounded-lg bg-white border transition-all ${
          focused ? "border-primary ring-2 ring-primary/20" : "border-gray-300"
        } ${compact ? "h-9" : "h-12"}`}
      >
        <Search size={compact ? 16 : 18} className="ml-3 text-secondary shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2 text-primary placeholder:text-secondary/60 focus:outline-none text-sm"
        />
        {query && (
          <button
            type="submit"
            className="mr-2 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-light transition-colors"
          >
            Search
          </button>
        )}
      </div>
    </form>
  );
}
