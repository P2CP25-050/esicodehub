import { useRouter } from "next/router";
import Image from "next/image";
import type { QuestionListItem } from "@/services/forum";
import { timeAgo } from "@/utils/forum";

function tagChip(tag: string): string {
  const palette = ["qc-tag-navy", "qc-tag-ink", "qc-tag-mid"];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function avatarColor(name: string): string {
  const colors = [
    "#051650", "#1a3a6b", "#2d5a8e", "#0d3358",
    "#162447", "#1f4068", "#1b262c", "#0f3460",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

interface QuestionCardProps {
  question: QuestionListItem;
  voteScore: number;
  userVote: 1 | -1 | null;
  onVote: (q: QuestionListItem, v: 1 | -1) => void;
  activeTag: string | undefined;
  onTagClick: (tag: string) => void;
}

export function QuestionCard({
  question,
  voteScore,
  userVote,
  onVote,
  activeTag,
  onTagClick,
}: QuestionCardProps) {
  const router = useRouter();

  const authorName = question.author_name ?? "Anonymous";
  const avatarBg   = avatarColor(authorName);
  const avatarSrc  = question.author_avatar ?? null;
  const authorSlug = question.author_school_id ?? "";
  const bodyText   = question.body ?? question.description ?? null;

  return (
    <>
      <style>{`
        .qc-card {
          background: var(--paper);
          border: var(--rule);
          border-left: 5px solid transparent;
          display: flex;
          overflow: hidden;
          transition: border-color 0.18s, box-shadow 0.18s, transform 0.14s;
          font-family: var(--font-body);
          position: relative;
        }
        .qc-card:hover {
          border-left-color: var(--navy);
          box-shadow: 6px 6px 0 rgba(5,22,80,0.10);
          transform: translate(-3px, -3px);
        }
        .qc-card::after {
          content: '';
          position: absolute;
          bottom: -1px; right: -1px;
          width: 18px; height: 18px;
          border-bottom: 3px solid var(--navy);
          border-right: 3px solid var(--navy);
          opacity: 0;
          transition: opacity 0.18s;
          pointer-events: none;
        }
        .qc-card:hover::after { opacity: 1; }

        /* ── Vote column ── */
        .qc-vote-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 7px;
          padding: 22px 12px;
          background: #f7f7f7;
          border-right: var(--rule);
          width: 54px;
          flex-shrink: 0;
        }
        .qc-vote-btn {
          color: #bbb;
          background: none;
          border: 1px solid #e0e0e0;
          cursor: pointer;
          padding: 6px;
          transition: color 0.12s, border-color 0.12s, background 0.12s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .qc-vote-up:hover   { color: var(--navy); border-color: var(--navy); background: rgba(5,22,80,0.05); }
        .qc-vote-down:hover { color: #cc2200;     border-color: #cc2200;    background: rgba(204,34,0,0.05); }
        .qc-vote-up-active   { color: var(--paper); border-color: var(--navy); background: var(--navy); }
        .qc-vote-down-active { color: var(--paper); border-color: #cc2200;    background: #cc2200; }

        .qc-vote-score {
          font-family: var(--font-mono);
          font-size: 16px;
          font-weight: 700;
          line-height: 1;
          min-width: 22px;
          text-align: center;
        }
        .qc-score-pos  { color: var(--navy); }
        .qc-score-neg  { color: #cc2200; }
        .qc-score-zero { color: #bbb; }

        /* ── Body ── */
        .qc-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          padding: 22px 24px 20px;
          cursor: pointer;
          gap: 12px;
        }

        /* Title */
        .qc-title-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .qc-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
          flex: 1;
          line-height: 1.3;
          letter-spacing: -0.02em;
          transition: color 0.14s;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .qc-body:hover .qc-title { color: var(--navy); }

        .qc-accepted-badge {
          flex-shrink: 0;
          margin-top: 3px;
          width: 22px; height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--navy);
          color: var(--paper);
        }

        /* Description */
        .qc-description {
          font-family: var(--font-body);
          font-size: 13.5px;
          font-weight: 300;
          color: #555;
          line-height: 1.65;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          letter-spacing: 0.005em;
        }

        /* Tags */
        .qc-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .qc-tag {
          font-family: var(--font-mono);
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 9px;
          border: 1px solid;
          cursor: pointer;
          transition: opacity 0.12s;
          background: none;
        }
        .qc-tag:hover    { opacity: 0.6; }
        .qc-tag-active   { background: var(--navy) !important; color: var(--paper) !important; border-color: var(--navy) !important; opacity: 1 !important; }
        .qc-tag-navy     { color: var(--navy); border-color: var(--navy); }
        .qc-tag-ink      { color: var(--ink);  border-color: var(--ink);  }
        .qc-tag-mid      { color: #555;        border-color: #bbb;        }

        /* Footer */
        .qc-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-top: 14px;
          border-top: 1px solid #ebebeb;
          flex-wrap: wrap;
        }

        /* Author block */
        .qc-author-block {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          padding: 4px 8px 4px 4px;
          border: 1px solid transparent;
          transition: border-color 0.14s, background 0.14s;
          text-decoration: none;
          flex-shrink: 0;
        }
        .qc-author-block:hover {
          border-color: var(--navy);
          background: rgba(5,22,80,0.03);
        }

        .qc-avatar {
          width: 36px; height: 36px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          color: var(--paper);
          letter-spacing: 0.05em;
          overflow: hidden;
          border: 1.5px solid rgba(0,0,0,0.10);
        }
        .qc-avatar img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }

        .qc-author-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .qc-author-name {
          font-family: var(--font-body);
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink);
          line-height: 1.2;
          white-space: nowrap;
        }
        .qc-author-meta {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #aaa;
          white-space: nowrap;
        }

        /* Stats */
        .qc-stats {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .qc-stat {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 5px 10px;
          border: 1px solid #e0e0e0;
          color: #999;
          background: transparent;
        }
        .qc-stat-accepted { color: var(--navy); border-color: var(--navy); background: rgba(5,22,80,0.04); }
        .qc-stat-answered { color: #333;        border-color: #bbb;        background: #f8f8f8; }

        @media (max-width: 580px) {
          .qc-body       { padding: 16px 14px 14px; gap: 10px; }
          .qc-title      { font-size: 15px; }
          .qc-vote-col   { width: 44px; padding: 16px 8px; }
          .qc-footer     { flex-direction: column; align-items: flex-start; gap: 10px; }
        }
      `}</style>

      <div className="qc-card">
        {/* ── Vote ── */}
        <div className="qc-vote-col">
          <button
            className={`qc-vote-btn qc-vote-up${userVote === 1 ? " qc-vote-up-active" : ""}`}
            onClick={(e) => { e.stopPropagation(); onVote(question, 1); }}
            title="Upvote"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          <span className={`qc-vote-score ${voteScore > 0 ? "qc-score-pos" : voteScore < 0 ? "qc-score-neg" : "qc-score-zero"}`}>
            {voteScore}
          </span>

          <button
            className={`qc-vote-btn qc-vote-down${userVote === -1 ? " qc-vote-down-active" : ""}`}
            onClick={(e) => { e.stopPropagation(); onVote(question, -1); }}
            title="Downvote"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div
          className="qc-body"
          onClick={() => router.push(`/forum/${question.id}`)}
        >
          {/* Title */}
          <div className="qc-title-row">
            <h3 className="qc-title">{question.title}</h3>
            {question.has_accepted_answer && (
              <span className="qc-accepted-badge" title="Has accepted answer">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </div>

          {/* Description excerpt */}
          {bodyText && (
            <p className="qc-description">{bodyText}</p>
          )}

          {/* Tags */}
          {question.tags.length > 0 && (
            <div className="qc-tags">
              {question.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                  className={`qc-tag ${activeTag === tag ? "qc-tag-active" : tagChip(tag)}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="qc-footer">
            {/* Author — navigates to public profile */}
            <div
              className="qc-author-block"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/profile/${authorSlug}`);
              }}
              title={`View ${authorName}'s profile`}
              role="link"
            >
              <div className="qc-avatar" style={{ background: avatarBg }}>
                {avatarSrc
                  ? (
                      <Image
                        src={avatarSrc}
                        alt={authorName}
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized
                      />
                    )
                  : initials(authorName)}
              </div>
              <div className="qc-author-info">
                <span className="qc-author-name">{authorName}</span>
                <span className="qc-author-meta">{timeAgo(question.created_at)}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="qc-stats">
              <span className={`qc-stat ${
                question.has_accepted_answer
                  ? "qc-stat-accepted"
                  : question.answer_count > 0
                    ? "qc-stat-answered"
                    : ""
              }`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {question.answer_count} {question.answer_count === 1 ? "answer" : "answers"}
              </span>

              <span className="qc-stat">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {question.view_count}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
