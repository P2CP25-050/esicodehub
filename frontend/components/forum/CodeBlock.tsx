import MonacoEditor from "./MonacoEditor";

interface CodeBlockProps {
  code: string;
  lang: string;
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-700 shadow-md my-3">
      <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1f2e] border-b border-slate-700">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 opacity-70" />
        </div>
        <span className="text-xs text-slate-400 font-mono ml-1 tracking-wider">
          {lang || "code"}
        </span>
      </div>
      <div style={{ height: "180px" }}>
        <MonacoEditor
          language={lang === "plaintext" ? "plaintext" : lang}
          theme="vs-dark"
          value={code}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12.5,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            fontFamily: "'Fira Code', Consolas, monospace",
            fontLigatures: true,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "none",
            scrollbar: { verticalScrollbarSize: 4 },
          }}
        />
      </div>
    </div>
  );
}