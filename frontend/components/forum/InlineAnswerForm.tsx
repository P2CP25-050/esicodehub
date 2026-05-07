import { useState } from "react";
import { createAnswer } from "@/services/forum";
import type { Answer, AnswerCreatePayload } from "@/services/forum";
import { MonacoEditor, LANGUAGES } from "@/components/forum/MonacoEditor";

interface InlineAnswerFormProps {
  questionId: number;
  parentId: number | null;
  onCancel: () => void;
  onPosted: (a: Answer) => void;
}

export function InlineAnswerForm({
  questionId,
  parentId,
  onCancel,
  onPosted,
}: InlineAnswerFormProps) {
  const [body, setBody] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [lang, setLang] = useState("python");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!body.trim()) { setErr("Body is required."); return; }
    setPosting(true);
    setErr("");
    try {
      const payload: AnswerCreatePayload = {
        body: body.trim(),
        ...(showCode && code.trim() ? { code_snippet: code, code_language: lang } : {}),
        ...(parentId !== null ? { parent_id: parentId } : {}),
      };
      const ans = await createAnswer(questionId, payload);
      onPosted(ans);
    } catch {
      setErr("Failed to post. Please try again.");
      setPosting(false);
    }
  };

  return (
    <div className="mt-3 bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-3">
      <textarea
        value={body}
        rows={3}
        onChange={(e) => { setBody(e.target.value); setErr(""); }}
        placeholder="Write your reply…"
        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-700 outline-none resize-y focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)] transition-all leading-relaxed"
      />
      {err && <p className="text-xs text-red-500">{err}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowCode((v) => !v)}
          className="text-xs font-bold border-2 border-slate-300 text-slate-500 px-3 py-1 rounded-full hover:border-[#0d1b4b] hover:text-[#0d1b4b] transition-all"
        >
          {showCode ? "− Remove code" : "+ Code"}
        </button>
        {showCode && (
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600"
          >
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </div>

      {showCode && (
        <div className="rounded-xl overflow-hidden border border-slate-700">
          <div style={{ height: "160px" }}>
            <MonacoEditor
              language={lang}
              theme="vs-dark"
              value={code}
              onChange={(v: string | undefined) => setCode(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                scrollBeyondLastLine: false,
                padding: { top: 10, bottom: 10 },
                fontFamily: "'Fira Code', Consolas, monospace",
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-slate-500 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={posting}
          className="text-xs font-bold bg-[#0d1b4b] text-white px-5 py-2 rounded-xl hover:bg-[#162269] transition-all disabled:opacity-60 flex items-center gap-1.5"
        >
          {posting && (
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {posting ? "Posting…" : "Post Reply"}
        </button>
      </div>
    </div>
  );
}