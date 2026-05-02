/**
 * Shared lazy-loaded Monaco editor instance.
 * Import this wherever you need an editable or read-only Monaco pane
 * so that Next.js only bundles the dynamic import once.
 */
import dynamic from "next/dynamic";

export const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-40 bg-[#1e1e1e]">
        <span className="text-xs text-slate-500 font-mono animate-pulse tracking-widest">
          LOADING EDITOR…
        </span>
      </div>
    ),
  }
);

export const LANGUAGES = [
  "python", "javascript", "typescript", "java", "c", "cpp", "rust", "go",
  "sql", "bash", "html", "css", "json", "yaml", "markdown", "plaintext",
] as const;

export type EditorLanguage = (typeof LANGUAGES)[number];