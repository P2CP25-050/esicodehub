import { SUPPORTED_LANGUAGES } from '@/services/submissions/submissions.types';

// ============================================================================
// Constants
// ============================================================================

export const SUBMISSION_TYPES = [
  { value: '',                    label: 'All Types'          },

  { value: 'review',              label: 'Review Request'     },
  { value: 'help',                label: 'Help Request'       },
  { value: 'sharing',             label: 'Educational Sharing'},

];

const QUICK_LANGS  = ['Python', 'JavaScript', 'Java', 'C++', 'C', 'TypeScript', 'SQL'];
const QUICK_TYPES  = [

  { value: 'review',              label: 'Review Request'     },
  { value: 'help',                label: 'Help Request'       },
  { value: 'sharing',             label: 'Educational Sharing'},

];

// ============================================================================
// Props
// ============================================================================

interface FiltersProps {
  language:               string;
  submissionType:         string;
  courseTag:              string;
  onLanguageChange:       (v: string) => void;
  onSubmissionTypeChange: (v: string) => void;
  onCourseTagChange:      (v: string) => void;
  onClear:                () => void;
  hasActiveFilter:        boolean;
  visibility: string;
  onVisibilityChange: (v: string) => void;
  total:                  number;
  shown:                  number;
  isAuthenticated:        boolean;
  onNewSubmission:        () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

function StyledSelect({
  value, onChange, children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`
          appearance-none pl-4 pr-9 py-2.5 rounded-xl text-sm font-semibold
          border-2 cursor-pointer outline-none
          transition-all duration-200
          ${value
            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'}
        `}
      >
        {children}
      </select>
      <svg
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${value ? 'text-white' : 'text-gray-400'}`}
        width="12" height="12" viewBox="0 0 16 16" fill="currentColor"
      >
        <path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427z"/>
      </svg>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function Filters({
  language, submissionType, courseTag,
  visibility, onVisibilityChange,
  onLanguageChange, onSubmissionTypeChange, onCourseTagChange,
  onClear, hasActiveFilter,
  total, shown,
  isAuthenticated, onNewSubmission,
}: FiltersProps) {
  return (
    <div className="space-y-4">

      {/* ── Row 1: dropdowns + course + button ── */}
      <div className="flex flex-wrap items-end gap-3">

        {/* Language dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
            Language
          </label>
          <StyledSelect value={language} onChange={onLanguageChange}>
            <option value="">All Languages</option>
            {SUPPORTED_LANGUAGES.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </StyledSelect>
        </div>

        {/* Type dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
            Type
          </label>
          <StyledSelect value={submissionType} onChange={onSubmissionTypeChange}>
            {SUBMISSION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </StyledSelect>
        </div>

	{/* Visibility dropdown */}
	<div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {[
            { value: '',        label: 'All' },
            { value: 'public',  label: 'Public' },
            { value: 'private', label: 'My Private' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onVisibilityChange(value)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${visibility === value
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'}
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Course tag */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
            Course Tag
          </label>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            <input
              type="text"
              value={courseTag}
              onChange={e => onCourseTagChange(e.target.value)}
              placeholder="e.g. AI101, DS201"
              className={`
                pl-9 pr-4 py-2.5 w-44 text-sm font-semibold rounded-xl
                border-2 outline-none
                transition-all duration-200
                ${courseTag
                  ? 'bg-blue-600 text-white border-blue-600 placeholder-blue-300'
                  : 'bg-white text-gray-600 border-gray-200 placeholder-gray-400 hover:border-blue-300 focus:border-blue-500'}
              `}
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Clear button */}
        {hasActiveFilter && (
          <button
            onClick={onClear}
            className="
              flex items-center gap-2 px-4 py-2.5
              text-sm font-semibold text-gray-500
              border-2 border-dashed border-gray-300
              rounded-xl hover:border-red-300 hover:text-red-500
              transition-all duration-200
            "
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
            Clear all
          </button>
        )}

        {/* New Submission */}
        {isAuthenticated && (
          <button
            onClick={onNewSubmission}
            className="
              group flex items-center gap-2.5 px-5 py-2.5
              bg-gradient-to-r from-blue-600 to-blue-500
              hover:from-blue-700 hover:to-blue-600
              text-white text-sm font-bold rounded-xl
              shadow-lg shadow-blue-200
              hover:shadow-xl hover:shadow-blue-300
              hover:-translate-y-0.5
              active:translate-y-0
              transition-all duration-200
            "
          >
            <svg
              className="transition-transform duration-200 group-hover:rotate-90"
              width="15" height="15" viewBox="0 0 16 16" fill="currentColor"
            >
              <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/>
            </svg>
            New Submission
          </button>
        )}
      </div>

      {/* ── Row 2: quick-select pills ── */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">
          Quick:
        </span>

        {/* Language pills */}
        {QUICK_LANGS.map(l => (
          <button
            key={l}
            onClick={() => onLanguageChange(language === l ? '' : l)}
            className={`
              px-3 py-1 text-xs font-bold rounded-full
              border-2 transition-all duration-150
              ${language === l
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200 scale-105'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:scale-105'}
            `}
          >
            {l}
          </button>
        ))}

        <span className="w-px h-4 bg-gray-200 mx-1" />

        {/* Type pills */}
        {QUICK_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => onSubmissionTypeChange(submissionType === t.value ? '' : t.value)}
            className={`
              px-3 py-1 text-xs font-bold rounded-full
              border-2 transition-all duration-150
              ${submissionType === t.value
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200 scale-105'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:scale-105'}
            `}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Row 3: result count ── */}
      {!!(total) && (
        <div className="flex items-center gap-2 pt-1">
          <div className="h-px flex-1 bg-gray-100" />
          <p className="text-xs font-semibold text-gray-400 whitespace-nowrap">
            Showing{' '}
            <span className="text-gray-700">{shown}</span>
            {' '}of{' '}
            <span className="text-gray-700">{total}</span>
            {' '}submissions
          </p>
          <div className="h-px flex-1 bg-gray-100" />
        </div>
      )}
    </div>
  );
}
