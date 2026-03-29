import { PersonalSubmission } from '@/services/submissions/submissions.types';
import { relativeTime } from '@/utils/time';
import { SUBMISSION_TYPES } from './Filters';

// ============================================================================
// Language colors
// ============================================================================

const LANG_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  Python:          { bg: 'bg-emerald-500', text: 'text-white',     glow: 'shadow-emerald-200' },
  JavaScript:      { bg: 'bg-amber-400',   text: 'text-gray-900',  glow: 'shadow-amber-200'  },
  TypeScript:      { bg: 'bg-blue-500',    text: 'text-white',     glow: 'shadow-blue-200'   },
  Java:            { bg: 'bg-orange-500',  text: 'text-white',     glow: 'shadow-orange-200' },
  'C++':           { bg: 'bg-purple-500',  text: 'text-white',     glow: 'shadow-purple-200' },
  C:               { bg: 'bg-blue-700',    text: 'text-white',     glow: 'shadow-blue-300'   },
  'C#':            { bg: 'bg-violet-600',  text: 'text-white',     glow: 'shadow-violet-200' },
  SQL:             { bg: 'bg-slate-600',   text: 'text-white',     glow: 'shadow-slate-200'  },
  Haskell:         { bg: 'bg-pink-500',    text: 'text-white',     glow: 'shadow-pink-200'   },
  MATLAB:          { bg: 'bg-red-500',     text: 'text-white',     glow: 'shadow-red-200'    },
  Go:              { bg: 'bg-cyan-500',    text: 'text-white',     glow: 'shadow-cyan-200'   },
  Rust:            { bg: 'bg-orange-700',  text: 'text-white',     glow: 'shadow-orange-300' },
  'Visual Basic':  { bg: 'bg-indigo-500',  text: 'text-white',     glow: 'shadow-indigo-200' },
  Fortran:         { bg: 'bg-teal-600',    text: 'text-white',     glow: 'shadow-teal-200'   },
};

const getLang = (l: string) =>
  LANG_COLORS[l] ?? { bg: 'bg-gray-500', text: 'text-white', glow: 'shadow-gray-200' };

// ============================================================================
// Type badge colors
// ============================================================================

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  review:  { bg: 'bg-teal-100',   text: 'text-teal-700'   },
  help:    { bg: 'bg-purple-100', text: 'text-purple-700' },
  sharing: { bg: 'bg-amber-100',  text: 'text-amber-700'  },
};
const getType = (t: string) =>
  TYPE_COLORS[t] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };

// ============================================================================
// Avatar
// ============================================================================

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-violet-600',
  'from-orange-500 to-red-500',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-blue-500',
  'from-amber-500 to-orange-500',
];

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const gradient = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className={`
      w-8 h-8 rounded-full shrink-0
      bg-gradient-to-br ${gradient}
      flex items-center justify-center
      text-white text-[0.6875rem] font-black
      ring-2 ring-white
    `}>
      {initials}
    </div>
  );
}

// ============================================================================
// Props & Component
// ============================================================================

interface SubmissionCardProps {
  submission: PersonalSubmission;
  onClick:    () => void;
  index:      number;
}

export default function SubmissionCard({ submission, onClick, index }: SubmissionCardProps) {
  // TODO(submissions.types.ts owner): split list/detail models (e.g. PersonalSubmissionListItem vs PersonalSubmission)
  // so list views cannot accidentally read detail-only fields.
  const listLike = submission as PersonalSubmission & {
    file_count?: number;
    owner_name?: string;
    owner?: string | { first_name?: string; last_name?: string };
  };

  const lang      = getLang(submission.language);
  const type      = getType(submission.submission_type);
  const typeLabel = SUBMISSION_TYPES.find(t => t.value === submission.submission_type)?.label
                 ?? submission.submission_type;
  const fileCount = listLike.file_count ?? submission.files?.length ?? 0;

  const ownerFromObject =
    typeof listLike.owner === 'object' && listLike.owner
      ? `${listLike.owner.first_name ?? ''} ${listLike.owner.last_name ?? ''}`.trim()
      : '';

  const ownerFromString =
    typeof listLike.owner === 'string'
      ? listLike.owner
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .trim()
      : '';

  const ownerName = listLike.owner_name?.trim() || ownerFromObject || ownerFromString || 'ESI Student';

  return (
    <div
      onClick={onClick}
      style={{
        animationDelay:    `${index * 50}ms`,
        animationFillMode: 'both',
      }}
      className="
        group relative
        bg-white rounded-2xl border border-gray-100
        p-5 cursor-pointer
        shadow-sm
        hover:shadow-xl hover:shadow-blue-100/50
        hover:-translate-y-1.5 hover:border-blue-200
        transition-all duration-300 ease-out
        animate-[fadeSlideUp_0.5s_ease]
        flex flex-col gap-3.5
        overflow-hidden
      "
    >
      {/* Top accent line — appears on hover */}
      <div className="
        absolute inset-x-0 top-0 h-0.5
        bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-500
        scale-x-0 group-hover:scale-x-100
        origin-left transition-transform duration-300
      " />

      {/* Title */}
      <h3 className="
        font-bold text-gray-900 text-[0.9375rem] leading-snug
        group-hover:text-blue-700 transition-colors duration-200
        line-clamp-2
      ">
        {submission.title}
      </h3>

      {/* Description */}
      {submission.description && (
        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
          {submission.description}
        </p>
      )}

      {/* Owner */}
      <div className="flex items-center gap-2.5">
        <Avatar name={ownerName} />
        <span className="text-sm text-gray-500">
          by{' '}
          <span className="font-semibold text-gray-700">{ownerName}</span>
        </span>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Language badge */}
        <span className={`
          inline-flex items-center gap-1.5 px-2.5 py-1
          text-[0.6875rem] font-black rounded-lg
          shadow-sm ${lang.glow}
          ${lang.bg} ${lang.text}
          transition-transform duration-150 group-hover:scale-105
        `}>
          {submission.language}
        </span>

        {/* Type badge */}
        {submission.submission_type && (
          <span className={`
            px-2.5 py-1
            text-[0.6875rem] font-bold rounded-lg
            ${type.bg} ${type.text}
          `}>
            {typeLabel}
          </span>
        )}
      </div>

      {/* Footer: files + time */}
      <div className="
        flex items-center gap-4 pt-3
        border-t border-gray-100
        text-xs text-gray-400
      ">
        {/* Files */}
        <span className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"/>
          </svg>
          {fileCount} {fileCount === 1 ? 'file' : 'files'}
        </span>

        {/* Course tag */}
        {submission.course_tag && (
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            {submission.course_tag}
          </span>
        )}

        {/* Time */}
        <span className="flex items-center gap-1.5 ml-auto">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
          </svg>
          {relativeTime(submission.created_at)}
        </span>
      </div>
    </div>
  );
}