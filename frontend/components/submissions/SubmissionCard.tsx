
import { PersonalSubmission } from '@/services/submissions/submissions.types';
import { timeAgo } from '@/utils/time';
import { SUBMISSION_TYPES } from './Filters';

// ============================================================================
// Language & type styles — minimal black/white with navy accents
// ============================================================================

const getLangStyle = (language: string) => {
  // Return a simple monochrome badge (no bright colors)
  return 'bg-black/5 text-black border border-black/10';
};

const getTypeStyle = (type: string) => {
  return 'bg-black/5 text-black border border-black/10';
};

// ============================================================================
// Avatar
// ============================================================================

const AVATAR_BG = 'bg-[#051650]'; // navy

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={`
      w-8 h-8 rounded-full shrink-0
      ${AVATAR_BG}
      flex items-center justify-center
      text-white text-[0.6875rem] font-bold
      ring-2 ring-white
    `}
    >
      {initials}
    </div>
  );
}

// ============================================================================
// Props & Component
// ============================================================================

interface SubmissionCardProps {
  submission: PersonalSubmission;
  onClick: () => void;
  index: number;
}

export default function SubmissionCard({
  submission,
  onClick,
  index,
}: SubmissionCardProps) {
  const listLike = submission as PersonalSubmission & {
    file_count?: number;
    owner_name?: string;
    owner?: string | { first_name?: string; last_name?: string };
  };

  const typeLabel =
    SUBMISSION_TYPES.find((t) => t.value === submission.submission_type)?.label ??
    submission.submission_type;

  const fileCount = listLike.file_count ?? submission.files?.length ?? 0;

  const ownerFromObject =
    typeof listLike.owner === 'object' && listLike.owner
      ? `${listLike.owner.first_name ?? ''} ${listLike.owner.last_name ?? ''}`.trim()
      : '';

  const ownerFromString =
    typeof listLike.owner === 'string'
      ? listLike.owner.split('@')[0].replace(/[._-]+/g, ' ').trim()
      : '';

  const ownerName =
    listLike.owner_name?.trim() || ownerFromObject || ownerFromString || 'ESI Student';

  return (
    <div
      onClick={onClick}
      style={{
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'both',
      }}
      className="
        group relative
        bg-white border border-black/10 border-t-4 border-t-[#051650]
        rounded-md p-5 cursor-pointer
        hover:border-black/30 hover:-translate-y-1
        transition-all duration-200 ease-out
        animate-[riseIn_0.4s_ease_both]
        flex flex-col gap-3.5
        overflow-hidden
      "
    >
      {/* Title */}
      <h3
        className="
        font-bold text-black text-[0.9375rem] leading-snug
        group-hover:text-[#051650] transition-colors duration-150
        line-clamp-2
      "
      >
        {submission.title}
      </h3>

      {/* Description */}
      {submission.description && (
        <p className="text-sm text-black/60 leading-relaxed line-clamp-2">
          {submission.description}
        </p>
      )}

      {/* Owner */}
      <div className="flex items-center gap-2.5">
        <Avatar name={ownerName} />
        <span className="text-sm text-black/50">
          by <span className="font-semibold text-black/80">{ownerName}</span>
        </span>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Language badge */}
        <span
          className={`
          inline-flex items-center gap-1.5 px-2.5 py-1
          text-[0.6875rem] font-mono font-bold rounded-full
          ${getLangStyle(submission.language)}
        `}
        >
          {submission.language}
        </span>

        {/* Type badge */}
        {submission.submission_type && (
          <span
            className={`
            px-2.5 py-1
            text-[0.6875rem] font-mono font-medium rounded-full
            ${getTypeStyle(submission.submission_type)}
          `}
          >
            {typeLabel}
          </span>
        )}
      </div>

      {/* Footer: files + time */}
      <div
        className="
        flex items-center gap-4 pt-3
        border-t border-black/5
        text-xs text-black/40
      "
      >
        {/* Files */}
        <span className="flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z" />
          </svg>
          {fileCount} {fileCount === 1 ? 'file' : 'files'}
        </span>

        {/* Course tag */}
        {submission.course_tag && (
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            {submission.course_tag}
          </span>
        )}

        {/* Time */}
        <span className="flex items-center gap-1.5 ml-auto">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z" />
          </svg>
          {timeAgo(submission.created_at)}
        </span>
      </div>
    </div>
  );
}