import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

const SUGGESTED_TAGS = [
  "CS101", "CS201", "CS301", "CS401", "MATH101", "MATH201", "STAT101",
  "python", "javascript", "typescript", "java", "c++", "c", "rust", "go",
  "react", "nextjs", "nodejs", "sql", "algorithms", "data-structures",
  "debugging", "recursion", "async", "concurrency", "machine-learning",
  "linear-algebra", "calculus", "os", "networks", "compilers",
];

/**
 * Normalize a raw tag string into its stored form.
 * Subject-code tags (e.g. "CS101", "MATH201") preserve their original
 * casing so they display consistently; all other free-text tags are
 * lower-cased and have whitespace collapsed to hyphens.
 */
function normalizeTag(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, "-").slice(0, 50);
  // If the tag matches a known suggested tag (case-insensitive), return the
  // canonical casing from the suggestions list so "cs101" → "CS101".
  const canonical = SUGGESTED_TAGS.find(
    (s) => s.toLowerCase() === trimmed.toLowerCase()
  );
  return canonical ?? trimmed.toLowerCase();
}

interface TagInputProps {
  tags: string[];
  onChange: (t: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize stored tags to lowercase for comparison so that both
  // "CS101" (from suggestions) and a manually typed "cs101" are treated
  // as the same tag when checking for duplicates.
  const tagsLower = tags.map((t) => t.toLowerCase());

  const handleChange = (val: string) => {
    setInput(val);
    setSuggestions(
      val.trim()
        ? SUGGESTED_TAGS.filter(
            (t) =>
              t.toLowerCase().includes(val.toLowerCase()) &&
              // Compare against normalized stored tags so already-added tags
              // (stored as e.g. "cs101") are correctly excluded from suggestions
              // even when the suggested tag is cased differently ("CS101").
              !tagsLower.includes(t.toLowerCase())
          ).slice(0, 8)
        : []
    );
  };

  const addTag = (raw: string) => {
    const t = normalizeTag(raw);
    // Duplicate check uses normalized lowercase on both sides.
    if (t && !tagsLower.includes(t.toLowerCase()) && tags.length < 5) {
      onChange([...tags, t]);
    }
    setInput("");
    setSuggestions([]);
  };

  const removeTag = (t: string) => onChange(tags.filter((x) => x !== t));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length) removeTag(tags[tags.length - 1]);
  };

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex flex-wrap gap-2 min-h-[48px] px-3 py-2 rounded-xl border-2 bg-slate-50 cursor-text transition-all duration-200
          ${focused
            ? "border-[#0d1b4b] shadow-[0_0_0_3px_rgba(13,27,75,0.1)]"
            : "border-slate-200 hover:border-slate-300"}`}
      >
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 bg-[#0d1b4b] text-white text-xs font-bold px-3 py-1 rounded-full"
          >
            {t}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(t); }}
              className="text-blue-300 hover:text-white transition-colors leading-none"
            >
              ×
            </button>
          </span>
        ))}
        {tags.length < 5 && (
          <input
            ref={inputRef}
            value={input}
            placeholder={tags.length === 0 ? "Type to search tags…" : ""}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); setTimeout(() => setSuggestions([]), 200); }}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
          />
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
              className="px-3 py-1 text-xs border border-slate-200 rounded-full text-slate-600 hover:border-[#0d1b4b] hover:text-[#0d1b4b] hover:bg-blue-50 transition-all duration-150"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-slate-400">
        <span className={`font-semibold ${tags.length >= 4 ? "text-amber-500" : "text-slate-500"}`}>
          {tags.length}
        </span>
        /5 tags&nbsp;·&nbsp;press{" "}
        <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">
          Enter
        </kbd>
        {" "}or{" "}
        <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">
          ,
        </kbd>
        {" "}to add
      </p>
    </div>
  );
}