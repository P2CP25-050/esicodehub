import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createQuestion } from "@/services/forum";
import type { QuestionCreatePayload } from "@/services/forum";
import Header from "@/components/submissions/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MonacoEditor, LANGUAGES } from "@/components/forum/MonacoEditor";
import { TagInput } from "@/components/forum/TagInput";
import { FormField } from "@/components/forum/FormField";

function NewQuestionContent() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("python");
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const validate = () => {
    const e: typeof errors = {};
    if (!title.trim()) e.title = "Title is required.";
    if (!body.trim()) e.body = "Description is required.";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload: QuestionCreatePayload = {
        title: title.trim(),
        body: body.trim(),
        tags,
        ...(showCode && codeSnippet.trim()
          ? { code_snippet: codeSnippet, code_language: codeLanguage }
          : {}),
      };
      const result = await createQuestion(payload);
      router.push(`/forum/${result.id}`);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header activePage="Q&A Forums" />

      <div className="min-h-screen bg-[#eef0f8]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-8">

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

            {/* Card header */}
            <div className="bg-[#0d1b4b] px-8 py-7 relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-28 h-28 bg-blue-400 opacity-10 rounded-full" />
              <div className="absolute top-4 right-16 w-14 h-14 bg-blue-300 opacity-10 rounded-full" />
              <h1 className="text-2xl font-black text-white tracking-widest font-mono uppercase relative z-10">
                Ask a Question
              </h1>
              <p className="text-blue-300 text-sm mt-1.5 relative z-10">
                Good questions get good answers. Be specific, show your work.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="px-6 sm:px-10 py-8 space-y-8">

              {/* Title */}
              <FormField label="Title" required error={errors.title}>
                <div className="relative">
                  <input
                    type="text"
                    value={title}
                    maxLength={300}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (errors.title) setErrors((p) => ({ ...p, title: undefined }));
                    }}
                    placeholder="e.g. Why does my recursive Fibonacci overflow the stack?"
                    className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-50 text-slate-800 text-sm outline-none transition-all duration-200 pr-16
                      ${errors.title
                        ? "border-red-400"
                        : "border-slate-200 focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)]"}`}
                  />
                  <span
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono tabular-nums pointer-events-none
                      ${title.length > 270 ? "text-red-500" : "text-slate-400"}`}
                  >
                    {title.length}/300
                  </span>
                </div>
              </FormField>

              {/* Body */}
              <FormField
                label="Description"
                required
                hint="Describe the problem in full. Include what you've already tried."
                error={errors.body}
              >
                <textarea
                  value={body}
                  rows={8}
                  onChange={(e) => {
                    setBody(e.target.value);
                    if (errors.body) setErrors((p) => ({ ...p, body: undefined }));
                  }}
                  placeholder="I'm trying to implement … but I keep getting …"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-50 text-slate-800 text-sm outline-none resize-y leading-relaxed transition-all duration-200
                    ${errors.body
                      ? "border-red-400"
                      : "border-slate-200 focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)]"}`}
                />
              </FormField>

              {/* Code snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-slate-800">Code Snippet</span>
                    <span className="ml-2 text-xs text-slate-400">optional</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCode((v) => !v)}
                    className={`text-xs font-bold px-4 py-1.5 rounded-full border-2 transition-all duration-200
                      ${showCode
                        ? "bg-slate-100 border-slate-300 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                        : "border-[#0d1b4b] text-[#0d1b4b] hover:bg-[#0d1b4b] hover:text-white"}`}
                  >
                    {showCode ? "− Remove snippet" : "+ Add snippet"}
                  </button>
                </div>

                {showCode && (
                  <div className="rounded-xl overflow-hidden border-2 border-slate-700 shadow-lg">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1a1f2e] border-b border-slate-700">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
                        <div className="w-3 h-3 rounded-full bg-amber-400 opacity-80" />
                        <div className="w-3 h-3 rounded-full bg-green-500 opacity-80" />
                      </div>
                      <span className="text-slate-500 text-xs font-mono">
                        snippet.{codeLanguage === "plaintext" ? "txt" : codeLanguage}
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-slate-500 text-xs">Language:</span>
                        <select
                          value={codeLanguage}
                          onChange={(e) => setCodeLanguage(e.target.value)}
                          className="bg-slate-800 border border-slate-600 text-slate-200 text-xs px-2 py-1 rounded-md outline-none cursor-pointer hover:border-slate-400 transition-colors"
                        >
                          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ height: "240px" }}>
                      <MonacoEditor
                        language={codeLanguage}
                        theme="vs-dark"
                        value={codeSnippet}
                        onChange={(v: string | undefined) => setCodeSnippet(v ?? "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: "on",
                          scrollBeyondLastLine: false,
                          wordWrap: "on",
                          padding: { top: 14, bottom: 14 },
                          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                          fontLigatures: true,
                          renderLineHighlight: "line",
                          cursorBlinking: "smooth",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <FormField
                label="Tags"
                hint="Add subject codes or topic keywords to help others find this."
              >
                <TagInput tags={tags} onChange={setTags} />
              </FormField>

              {/* Server error */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {submitError}
                </div>
              )}

              {/* Form actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Link
                  href="/forum"
                  className="text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors flex items-center gap-1.5 group"
                >
                  <svg
                    className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Forum
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2.5 bg-[#0d1b4b] hover:bg-[#162269] active:scale-[0.97] text-white font-bold text-sm px-8 py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Posting…
                    </>
                  ) : (
                    <>
                      Post Question
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </>
  );
}

export default function NewQuestionPage() {
  return (
    <ProtectedRoute>
      <NewQuestionContent />
    </ProtectedRoute>
  );
}