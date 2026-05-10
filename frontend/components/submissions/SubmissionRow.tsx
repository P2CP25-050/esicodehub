import { PersonalSubmission } from '@/services/submissions/submissions.types';
import { timeAgo } from '@/utils/time';
import { SUBMISSION_TYPES } from '@/components/submissions/Filters';

// ============================================================================
// Language badge — keep parity with existing badge style
// ============================================================================

const LANG_COLORS: Record<string, string> = {
  Python:     '#3572A5',
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  Java:       '#b07219',
  'C++':      '#f34b7d',
  C:          '#555555',
  SQL:        '#e38c00',
  HTML:       '#e34c26',
  CSS:        '#563d7c',
  Go:         '#00ADD8',
  Rust:       '#dea584',
  Ruby:       '#701516',
  PHP:        '#4F5D95',
  Swift:      '#F05138',
  Kotlin:     '#A97BFF',
};

function LangDot({ language }: { language: string }) {
  const color = LANG_COLORS[language] ?? '#888';
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-black/50 font-medium">{language}</span>
    </span>
  );
}

// ============================================================================
// Mini avatar
// ============================================================================

function MiniAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="
        w-5 h-5 rounded-full shrink-0
        bg-[#051650] ring-1 ring-white
        flex items-center justify-center
        text-white font-bold
      "
      style={{ fontSize: '0.5rem' }}
    >
      {initials}
    </div>
  );
}

// ============================================================================
// Lock icon (private)
// ============================================================================

function LockIcon() {
  return (
    <svg
      className="shrink-0 text-black/30"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-label="Private"
    >
      <path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM9 10.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-5a2.5 2.5 0 0 0-2.5 2.5H5.5V4a2.5 2.5 0 0 1 5 0v3.5h-1V7A2.5 2.5 0 0 0 8 5.5Z" />
    </svg>
  );
}

// ============================================================================
// File icon
// ============================================================================

function FileIcon() {
  return (
    <svg
      className="shrink-0 text-black/25"
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z" />
    </svg>
  );
}

// ============================================================================
// Props & Component
// ============================================================================

interface SubmissionRowProps {
  submission: PersonalSubmission & {
    file_count?: number;
    owner_name?: string;
    owner?: string | { first_name?: string; last_name?: string };
    is_private?: boolean;
  };
  onClick: () => void;
  isLast: boolean;
}

export default function SubmissionRow({ submission, onClick, isLast }: SubmissionRowProps) {
  const typeLabel =
    SUBMISSION_TYPES.find((t) => t.value === submission.submission_type)?.label ?? null;

  const ownerFromObject =
    typeof submission.owner === 'object' && submission.owner
      ? `${submission.owner.first_name ?? ''} ${submission.owner.last_name ?? ''}`.trim()
      : '';

  const ownerFromString =
    typeof submission.owner === 'string'
      ? submission.owner.split('@')[0].replace(/[._-]+/g, ' ').trim()
      : '';

  const ownerName =
    submission.owner_name?.trim() || ownerFromObject || ownerFromString || 'ESI Student';

  return (
    <div
      onClick={onClick}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`
        group flex items-center gap-3 px-4 py-3
        cursor-pointer
        hover:bg-[#f6f8fa]
        transition-colors duration-100
        ${!isLast ? 'border-b border-black/[0.07]' : ''}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#051650]/40 focus-visible:ring-inset
      `}
    >
      {/* File icon */}
      <FileIcon />

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span
            className="
              font-semibold text-[0.875rem] text-[#0969da]
              group-hover:underline truncate leading-snug
            "
          >
            {submission.title}
          </span>

          {submission.is_private && <LockIcon />}

          {typeLabel && (
            <span
              className="
                hidden sm:inline-flex
                px-2 py-0.5 text-[0.6875rem] font-medium
                border border-black/15 rounded-full
                text-black/50 bg-transparent
                shrink-0
              "
            >
              {typeLabel}
            </span>
          )}

          {submission.course_tag && (
            <span
              className="
                hidden md:inline-flex
                px-2 py-0.5 text-[0.6875rem] font-medium
                border border-black/15 rounded-full
                text-black/50 bg-transparent
                shrink-0
              "
            >
              {submission.course_tag}
            </span>
          )}
        </div>

        {/* Description — only show on hover or if short enough */}
        {submission.description && (
          <p className="hidden sm:block text-xs text-black/40 mt-0.5 truncate leading-relaxed">
            {submission.description}
          </p>
        )}
      </div>

      {/* Right-side meta: language · owner · time */}
      <div className="flex items-center gap-4 shrink-0 ml-2">
        {/* Language dot */}
        <LangDot language={submission.language} />

        {/* Owner */}
        <div className="hidden sm:flex items-center gap-1.5">
          <MiniAvatar name={ownerName} />
          <span className="text-xs text-black/45 font-medium max-w-24 truncate">
            {ownerName}
          </span>
        </div>

        {/* Time */}
        <span className="text-xs text-black/40 whitespace-nowrap w-17 text-right">
          {timeAgo(submission.created_at)}
        </span>
      </div>
    </div>
  );
}