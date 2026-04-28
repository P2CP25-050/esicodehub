import { useState, useRef, KeyboardEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { createQuestion } from '@/services/forum';
import type { QuestionCreatePayload } from '@/services/forum';
import Header from '@/components/submissions/Header';

// ─── Monaco (no SSR) ─────────────────────────────────────────────────────────
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-52 bg-[#1e1e1e]">
      <span className="text-xs text-slate-500 font-mono animate-pulse tracking-widest">
        LOADING EDITOR…
      </span>
    </div>
  ),
});

// ─── Constants ────────────────────────────────────────────────────────────────
const SUGGESTED_TAGS = [
  'CS101','CS201','CS301','CS401','MATH101','MATH201','STAT101',
  'python','javascript','typescript','java','c++','c','rust','go',
  'react','nextjs','nodejs','sql','algorithms','data-structures',
  'debugging','recursion','async','concurrency','machine-learning',
  'linear-algebra','calculus','os','networks','compilers',
];

const LANGUAGES = [
  'python','javascript','typescript','java','c','cpp','rust','go',
  'sql','bash','html','css','json','yaml','markdown','plaintext',
];

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// ─── TagInput ─────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (val: string) => {
    setInput(val);
    setSuggestions(
      val.trim()
        ? SUGGESTED_TAGS.filter(t => t.toLowerCase().includes(val.toLowerCase()) && !tags.includes(t)).slice(0, 8)
        : []
    );
  };

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 50);
    if (t && !tags.includes(t) && tags.length < 5) onChange([...tags, t]);
    setInput(''); setSuggestions([]);
  };

  const removeTag = (t: string) => onChange(tags.filter(x => x !== t));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); addTag(input); }
    if (e.key === 'Backspace' && !input && tags.length) removeTag(tags[tags.length - 1]);
  };

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex flex-wrap gap-2 min-h-[48px] px-3 py-2 rounded-xl border-2 bg-slate-50 cursor-text transition-all duration-200
          ${focused ? 'border-[#0d1b4b] shadow-[0_0_0_3px_rgba(13,27,75,0.1)]' : 'border-slate-200 hover:border-slate-300'}`}
      >
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1.5 bg-[#0d1b4b] text-white text-xs font-bold px-3 py-1 rounded-full">
            {t}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); removeTag(t); }}
              className="text-blue-300 hover:text-white transition-colors leading-none"
            >×</button>
          </span>
        ))}
        {tags.length < 5 && (
          <input
            ref={inputRef}
            value={input}
            placeholder={tags.length === 0 ? 'Type to search tags…' : ''}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); setTimeout(() => setSuggestions([]), 200); }}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
          />
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 flex flex-wrap gap-1.5">
          {suggestions.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => { e.preventDefault(); addTag(s); }}
              className="px-3 py-1 text-xs border border-slate-200 rounded-full text-slate-600 hover:border-[#0d1b4b] hover:text-[#0d1b4b] hover:bg-blue-50 transition-all duration-150"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-slate-400">
        <span className={`font-semibold ${tags.length >= 4 ? 'text-amber-500' : 'text-slate-500'}`}>{tags.length}</span>/5 tags
        &nbsp;·&nbsp;press{' '}
        <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">Enter</kbd>
        {' '}or{' '}
        <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">,</kbd>
        {' '}to add
      </p>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, hint, required, error, children }: {
  label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-baseline gap-1.5 text-sm font-bold text-slate-800">
        {label}
        {required && <span className="text-red-500 text-xs">*</span>}
        {!required && <span className="text-xs text-slate-400 font-normal">optional</span>}
      </label>
      {hint && <p className="text-xs text-slate-400 -mt-0.5">{hint}</p>}
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NewQuestionPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('python');
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validate = () => {
    const e: typeof errors = {};
    if (!title.trim()) e.title = 'Title is required.';
    if (!body.trim()) e.body = 'Description is required.';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({}); setSubmitting(true); setSubmitError('');
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
      setSubmitError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <Header activePage="Q&A Forums" />

      <div className="min-h-screen bg-[#eef0f8]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-8">


          {/* Full-width form card — no sidebar */}
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
              <Field label="Title" required error={errors.title}>
                <div className="relative">
                  <input
                    type="text"
                    value={title}
                    maxLength={300}
                    onChange={e => { setTitle(e.target.value); if (errors.title) setErrors(p => ({ ...p, title: undefined })); }}
                    placeholder="e.g. Why does my recursive Fibonacci overflow the stack?"
                    className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-50 text-slate-800 text-sm outline-none transition-all duration-200 pr-16
                      ${errors.title ? 'border-red-400' : 'border-slate-200 focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)]'}`}
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono tabular-nums pointer-events-none
                    ${title.length > 270 ? 'text-red-500' : 'text-slate-400'}`}>
                    {title.length}/300
                  </span>
                </div>
              </Field>

              {/* Body */}
              <Field
                label="Description"
                required
                hint="Describe the problem in full. Include what you've already tried."
                error={errors.body}
              >
                <textarea
                  value={body}
                  rows={8}
                  onChange={e => { setBody(e.target.value); if (errors.body) setErrors(p => ({ ...p, body: undefined })); }}
                  placeholder="I'm trying to implement … but I keep getting …"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-50 text-slate-800 text-sm outline-none resize-y leading-relaxed transition-all duration-200
                    ${errors.body ? 'border-red-400' : 'border-slate-200 focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)]'}`}
                />
              </Field>

              {/* Code Snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-slate-800">Code Snippet</span>
                    <span className="ml-2 text-xs text-slate-400">optional</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCode(v => !v)}
                    className={`text-xs font-bold px-4 py-1.5 rounded-full border-2 transition-all duration-200
                      ${showCode
                        ? 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                        : 'border-[#0d1b4b] text-[#0d1b4b] hover:bg-[#0d1b4b] hover:text-white'}`}
                  >
                    {showCode ? '− Remove snippet' : '+ Add snippet'}
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
                      <span className="text-slate-500 text-xs font-mono">snippet.{codeLanguage === 'plaintext' ? 'txt' : codeLanguage}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-slate-500 text-xs">Language:</span>
                        <select
                          value={codeLanguage}
                          onChange={e => setCodeLanguage(e.target.value)}
                          className="bg-slate-800 border border-slate-600 text-slate-200 text-xs px-2 py-1 rounded-md outline-none cursor-pointer hover:border-slate-400 transition-colors"
                        >
                          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ height: '240px' }}>
                      <MonacoEditor
                        language={codeLanguage}
                        theme="vs-dark"
                        value={codeSnippet}
                        onChange={(v: string | undefined) => setCodeSnippet(v ?? '')}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          padding: { top: 14, bottom: 14 },
                          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                          fontLigatures: true,
                          renderLineHighlight: 'line',
                          cursorBlinking: 'smooth',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <Field
                label="Tags"
                hint="Add subject codes or topic keywords to help others find this."
              >
                <TagInput tags={tags} onChange={setTags} />
              </Field>

              {/* Server error */}
              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  {submitError}
                </div>
              )}

              {/* Form actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Link
                  href="/forum"
                  className="text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors flex items-center gap-1.5 group"
                >
                  <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </ProtectedRoute>
  );
}