import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

import Header from '@/components/submissions/Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { listAssignments } from '@/services/assignments';
import type { Assignment } from '@/services/assignments';
import { listQuestions, getQuestion } from '@/services/forum';
import type { Answer, QuestionDetail, QuestionListItem } from '@/services/forum';
import { getProfessorStats } from '@/services/profile/api';
import type { ProfessorStats } from '@/services/profile/api';
import { listSubmissions } from '@/services/submissions';
import type { PersonalSubmission } from '@/services/submissions';
import { timeAgo } from '@/utils/time';

const INSIGHTS_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

  :root {
    --ink:          #000000;
    --paper:        #ffffff;
    --navy:         #051650;
    --rule:         1.5px solid #000;
    --border-soft:  1px solid #e0e0e0;
    --surface:      #f7f7f5;
    --surface-2:    #f0efec;
    --text-muted:   #666666;
    --text-sub:     #444444;
    --red:          #cc0000;
    --green:        #1a7a3c;
    --orange:       #b85c00;
    --blue:         #1a4fa8;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-mono: 'Space Mono', monospace;
    --font-body: 'DM Sans', sans-serif;
  }

  .ip-page {
    min-height: 100vh;
    position: relative;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
  }

  .ip-page::before {
    content: '';
    position: fixed;
    right: 0;
    top: 0;
    width: 280px;
    height: 100vh;
    background: var(--navy);
    clip-path: polygon(80px 0, 100% 0, 100% 100%, 0 100%);
    z-index: 0;
    pointer-events: none;
  }

  .ip-page::after {
    content: '';
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    height: 1.5px;
    background: var(--ink);
    z-index: 0;
    pointer-events: none;
  }

  .ip-container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  .ip-breadcrumb {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .ip-breadcrumb-link {
    color: var(--navy);
    text-decoration: none;
    font-weight: 700;
    border-bottom: 1.5px solid var(--navy);
    padding-bottom: 1px;
    transition: opacity 0.16s;
  }

  .ip-breadcrumb-link:hover { opacity: 0.6; }

  .ip-breadcrumb-sep,
  .ip-breadcrumb-current { color: #6b7280; }

  .ip-page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    border-bottom: var(--rule);
    padding-bottom: 28px;
    margin-bottom: 0;
  }

  .ip-page-title {
    margin: 0 0 6px;
    font-family: var(--font-display);
    font-size: 44px;
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.05;
  }

  .ip-page-title span { color: var(--navy); }

  .ip-page-subtitle {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 700;
  }

  .ip-section {
    margin-top: 28px;
    animation: ip-fade-up 0.35s ease forwards;
    opacity: 0;
  }

  .ip-section-1 { animation-delay: 0.03s; }
  .ip-section-2 { animation-delay: 0.08s; }
  .ip-section-3 { animation-delay: 0.13s; }

  .ip-section-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .ip-section-mark {
    width: 3px;
    height: 18px;
    background: var(--navy);
    flex-shrink: 0;
  }

  .ip-section-title {
    margin: 0;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 10px;
    color: var(--navy);
    font-weight: 700;
  }

  .ip-section-line {
    flex: 1;
    height: 1px;
    background: var(--navy);
    opacity: 0.22;
  }

  .ip-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .ip-stat-tile {
    background: var(--paper);
    border: 1px solid #e2e8f6;
    border-radius: 16px;
    padding: 18px 20px;
    box-shadow: 0 1px 2px rgba(5, 22, 80, 0.08);
    transition: box-shadow 0.2s;
  }

  .ip-stat-tile:hover {
    box-shadow: 0 8px 20px rgba(5, 22, 80, 0.14);
  }

  .ip-stat-number {
    margin: 0 0 6px;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1;
    color: var(--navy);
  }

  .ip-stat-label {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 700;
  }

  .ip-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  .ip-card {
    background: var(--paper);
    border: var(--rule);
    border-top: 4px solid var(--navy);
    padding: 24px;
    position: relative;
    overflow: hidden;
    min-height: 230px;
  }

  .ip-card::after {
    content: '';
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 20px;
    height: 20px;
    border-bottom: 3px solid var(--navy);
    border-right: 3px solid var(--navy);
  }

  .ip-card-title {
    margin: 0 0 12px;
    font-family: var(--font-display);
    font-size: 28px;
    line-height: 1.1;
    color: #0f172a;
  }

  .ip-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .ip-list-link {
    display: block;
    text-decoration: none;
    color: inherit;
    background: var(--surface);
    border: 1px solid #d0d0d0;
    border-left: 3px solid var(--navy);
    border-radius: 10px;
    padding: 14px 16px;
    transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
  }

  .ip-list-link:hover {
    transform: translate(-2px, -2px);
    box-shadow: 4px 4px 0 var(--navy);
    border-color: var(--navy);
  }

  .ip-row-top,
  .ip-row-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .ip-row-title {
    margin: 0;
    font-weight: 700;
    font-size: 14px;
    color: #0f172a;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ip-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-family: var(--font-mono);
    white-space: nowrap;
    border: 1px solid transparent;
  }

  .ip-pill-subject {
    background: var(--navy);
    color: #ffffff;
    border-color: var(--navy);
  }

  .ip-pill-pending {
    background: #fff7ed;
    color: var(--orange);
    border-color: var(--orange);
  }

  .ip-pill-submitted {
    background: #f0fdf4;
    color: var(--green);
    border-color: var(--green);
  }

  .ip-pill-public {
    background: #ecfeff;
    color: #0e7490;
    border-color: #a5f3fc;
  }

  .ip-pill-private {
    background: #f8fafc;
    color: #334155;
    border-color: #cbd5e1;
  }

  .ip-row-meta {
    margin: 0;
    color: var(--text-muted);
    font-size: 10px;
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .ip-empty {
    margin: 6px 0 0;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    color: #64748b;
    font-size: 13px;
  }

  .ip-board-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .ip-board-card {
    background: var(--paper);
    border: var(--rule);
    border-top: 4px solid var(--ink);
    overflow: hidden;
    position: relative;
  }

  .ip-board-card::after {
    content: '';
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 20px;
    height: 20px;
    border-bottom: 3px solid var(--ink);
    border-right: 3px solid var(--ink);
  }

  .ip-board-head {
    margin: 0;
    padding: 14px 16px;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 11px;
    font-weight: 700;
    border-bottom: 1px solid #d0d0d0;
  }

  .ip-board-table {
    width: 100%;
    border-collapse: collapse;
  }

  .ip-board-table th,
  .ip-board-table td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid #ececec;
    vertical-align: middle;
    font-size: 12px;
  }

  .ip-board-table th {
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    font-size: 10px;
  }

  .ip-rank {
    font-family: var(--font-mono);
    color: #64748b;
    width: 38px;
  }

  .ip-user-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .ip-avatar {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: linear-gradient(135deg, #1d6ef5, #1558d4);
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    border: 1px solid #e2e8f0;
    flex-shrink: 0;
    background-size: cover;
    background-position: center;
  }

  .ip-name-link {
    color: #0f172a;
    text-decoration: none;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ip-name-link:hover { text-decoration: underline; }

  .ip-highlight td {
    background: #f8fafc;
  }

  .ip-count {
    font-family: var(--font-mono);
    font-weight: 700;
    color: #1e3a8a;
    text-align: right;
    width: 70px;
  }

  .ip-loading,
  .ip-error {
    font-size: 14px;
    color: #64748b;
    margin: 0;
  }

  .ip-error { color: #b91c1c; }

  @keyframes ip-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 980px) {
    .ip-page::before { display: none; }
    .ip-page::after { display: none; }
    .ip-page-title { font-size: 34px; }
    .ip-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .ip-two-col { grid-template-columns: 1fr; }
    .ip-board-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 600px) {
    .ip-container { padding: 20px 14px 60px; }
    .ip-page-title { font-size: 28px; }
    .ip-card-title { font-size: 24px; }
    .ip-row-title { font-size: 13px; }
    .ip-stat-number { font-size: 30px; }
  }
`;

interface StatTile {
  label: string;
  value: number;
}

interface UpcomingItem {
  id: number;
  title: string;
  deadline: string;
  subjectCode: string;
  hasSubmitted: boolean;
}

interface RecentSubmissionItem {
  id: number;
  title: string;
  language: string;
  visibility: 'public' | 'private';
  createdAt: string;
}

interface LeaderboardEntry {
  name: string;
  count: number;
  avatarUrl?: string | null;
  isCurrentUser: boolean;
  href: string;
}

interface InsightsState {
  loading: boolean;
  error: string | null;
  leaderboardLoading: boolean;
  personalStats: StatTile[];
  upcomingAssignments: UpcomingItem[];
  recentSubmissions: RecentSubmissionItem[];
  topQuestioners: LeaderboardEntry[];
  topAnswerers: LeaderboardEntry[];
}

const INITIAL_STATE: InsightsState = {
  loading: true,
  error: null,
  leaderboardLoading: true,
  personalStats: [],
  upcomingAssignments: [],
  recentSubmissions: [],
  topQuestioners: [],
  topAnswerers: [],
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function buildFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
}

function parseNextPage(url: string | null): number | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const page = parsed.searchParams.get('page');
    if (!page) return null;
    const num = Number.parseInt(page, 10);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

function countdownText(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(diff)) return 'Unknown';
  if (diff <= 0) return 'Expired';

  const totalMins = Math.floor(diff / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return `${Math.max(totalMins, 1)}m left`;
}

function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function profileHrefForName(name: string): string {
  return `/profile?user=${encodeURIComponent(name)}`;
}

function collectAnswers(answers: Answer[]): Answer[] {
  const out: Answer[] = [];
  const walk = (nodes: Answer[]) => {
    nodes.forEach((node) => {
      out.push(node);
      if (Array.isArray(node.replies) && node.replies.length > 0) {
        walk(node.replies);
      }
    });
  };
  walk(answers);
  return out;
}

async function fetchQuestionPages(maxPages = 5): Promise<QuestionListItem[]> {
  let page = 1;
  let pagesFetched = 0;
  const all: QuestionListItem[] = [];

  while (pagesFetched < maxPages) {
    const res = await listQuestions({ page, ordering: 'newest' });
    all.push(...res.results);
    pagesFetched += 1;

    const nextPage = parseNextPage(res.next);
    if (!nextPage) break;
    page = nextPage;
  }

  return all;
}

async function fetchUserQuestionCount(userEmail: string, fullName: string): Promise<number> {
  const authorCandidates = [userEmail, fullName].filter((v) => v.trim().length > 0);

  for (const author of authorCandidates) {
    try {
      const res = await listQuestions({ author, page: 1 });
      if (typeof res.count === 'number' && res.count >= 0) {
        return res.count;
      }
    } catch {
      // Try next candidate.
    }
  }

  return 0;
}

async function buildLeaderboard(
  userEmail: string,
  userFullName: string
): Promise<{
  topQuestioners: LeaderboardEntry[];
  topAnswerers: LeaderboardEntry[];
  myAnswerCount: number;
}> {
  const questions = await fetchQuestionPages(5);

  const questionerMap = new Map<
    string,
    { name: string; count: number; avatarUrl?: string | null; isCurrentUser: boolean }
  >();

  questions.forEach((question) => {
    const name = question.author_name?.trim() || 'Unknown User';
    const key = normalize(name);
    const existing = questionerMap.get(key);
    const current =
      normalize(userFullName).length > 0 && key === normalize(userFullName);

    if (existing) {
      existing.count += 1;
      if (!existing.avatarUrl && question.author_avatar) {
        existing.avatarUrl = question.author_avatar;
      }
      existing.isCurrentUser = existing.isCurrentUser || current;
    } else {
      questionerMap.set(key, {
        name,
        count: 1,
        avatarUrl: question.author_avatar,
        isCurrentUser: current,
      });
    }
  });

  const detailTargets = questions.slice(0, 30);
  const detailResults = await Promise.allSettled(
    detailTargets.map((q) => getQuestion(q.id))
  );

  const answererMap = new Map<string, { name: string; count: number; isCurrentUser: boolean }>();
  let myAnswerCount = 0;

  detailResults.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    const question: QuestionDetail = result.value;
    const allAnswers = collectAnswers(question.answers ?? []);

    allAnswers.forEach((answer) => {
      const name = answer.author_name?.trim() || 'Unknown User';
      const email = normalize(answer.author_email);
      const key = normalize(name);
      const isCurrent =
        (email.length > 0 && email === normalize(userEmail)) ||
        (normalize(userFullName).length > 0 && key === normalize(userFullName));

      if (isCurrent) myAnswerCount += 1;

      const existing = answererMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.isCurrentUser = existing.isCurrentUser || isCurrent;
      } else {
        answererMap.set(key, { name, count: 1, isCurrentUser: isCurrent });
      }
    });
  });

  const topQuestioners = [...questionerMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((entry) => ({
      name: entry.name,
      count: entry.count,
      avatarUrl: entry.avatarUrl,
      isCurrentUser: entry.isCurrentUser,
      href: profileHrefForName(entry.name),
    }));

  const topAnswerers = [...answererMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((entry) => ({
      name: entry.name,
      count: entry.count,
      isCurrentUser: entry.isCurrentUser,
      href: profileHrefForName(entry.name),
    }));

  return { topQuestioners, topAnswerers, myAnswerCount };
}

function LeaderboardTable({
  title,
  rows,
  countLabel,
}: {
  title: string;
  rows: LeaderboardEntry[];
  countLabel: string;
}) {
  const rankedRows: Array<LeaderboardEntry | null> = Array.from(
    { length: 10 },
    (_, idx) => rows[idx] ?? null
  );

  return (
    <div className="ip-board-card">
      <h3 className="ip-board-head">{title}</h3>
      <table className="ip-board-table">
        <thead>
          <tr>
            <th className="ip-rank">Rank</th>
            <th>User</th>
            <th style={{ textAlign: 'right' }}>{countLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rankedRows.map((row, idx) => (
            <tr
              key={`${title}-${idx}`}
              className={row?.isCurrentUser ? 'ip-highlight' : ''}
            >
              <td className="ip-rank">{idx + 1}</td>
              <td>
                {row ? (
                  <div className="ip-user-cell">
                    <span
                      className="ip-avatar"
                      style={
                        row.avatarUrl
                          ? { backgroundImage: `url(${row.avatarUrl})`, color: 'transparent' }
                          : undefined
                      }
                    >
                      {initialsFromName(row.name)}
                    </span>
                    <Link href={row.href} className="ip-name-link">
                      {row.name}
                    </Link>
                  </div>
                ) : (
                  <span style={{ color: '#94a3b8' }}>-</span>
                )}
              </td>
              <td className="ip-count">{row ? row.count : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentInsightsContent() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [state, setState] = useState<InsightsState>(INITIAL_STATE);

  const fullName = useMemo(() => {
    if (!user) return '';
    return buildFullName(user.first_name, user.last_name);
  }, [user]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    const authUser = user;

    let cancelled = false;

    async function load() {
      try {
        setState((prev) => ({
          ...prev,
          loading: true,
          leaderboardLoading: true,
          error: null,
        }));

        const [assignmentsRes, submissionsRes, questionCountRes] =
          await Promise.allSettled([
            listAssignments(),
            listSubmissions({ page: 1 }),
            fetchUserQuestionCount(authUser.email, fullName),
          ]);

        const assignments: Assignment[] =
          assignmentsRes.status === 'fulfilled' ? assignmentsRes.value.results : [];

        const submissions: PersonalSubmission[] =
          submissionsRes.status === 'fulfilled' ? submissionsRes.value.results : [];

        const forumQuestionCount =
          questionCountRes.status === 'fulfilled' ? questionCountRes.value : 0;

        const now = Date.now();
        const upcomingAssignments: UpcomingItem[] = assignments
          .filter((a) => new Date(a.deadline).getTime() > now)
          .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
          .slice(0, 5)
          .map((a) => ({
            id: a.id,
            title: a.title,
            deadline: a.deadline,
            subjectCode: a.subject?.code ?? 'N/A',
            hasSubmitted: Boolean(a.has_submitted),
          }));

        const recentSubmissions: RecentSubmissionItem[] = submissions
          .slice()
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          .slice(0, 5)
          .map((sub) => ({
            id: sub.id,
            title: sub.title,
            language: sub.language,
            visibility: sub.visibility,
            createdAt: sub.created_at,
          }));

        const personalSubmissionCount =
          submissionsRes.status === 'fulfilled' ? submissionsRes.value.count : 0;
        const assignmentSubmissions = assignments.filter((a) => Boolean(a.has_submitted)).length;
        const totalSubmissions = personalSubmissionCount + assignmentSubmissions;

        const personalStats: StatTile[] = [
          { label: 'Total Submissions', value: totalSubmissions },
          { label: 'Assignments Completed', value: assignmentSubmissions },
          { label: 'Forum Questions', value: forumQuestionCount },
          { label: 'Forum Answers', value: 0 },
        ];

        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            leaderboardLoading: true,
            personalStats,
            upcomingAssignments,
            recentSubmissions,
            topQuestioners: [],
            topAnswerers: [],
          });
        }

        const leaderboardRes = await Promise.allSettled([
          buildLeaderboard(authUser.email, fullName),
        ]);

        if (!cancelled) {
          const leaderboard =
            leaderboardRes[0].status === 'fulfilled'
              ? leaderboardRes[0].value
              : { topQuestioners: [], topAnswerers: [], myAnswerCount: 0 };

          setState((prev) => ({
            ...prev,
            leaderboardLoading: false,
            personalStats: prev.personalStats.map((tile) =>
              tile.label === 'Forum Answers'
                ? { ...tile, value: leaderboard.myAnswerCount }
                : tile
            ),
            topQuestioners: leaderboard.topQuestioners,
            topAnswerers: leaderboard.topAnswerers,
          }));
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            leaderboardLoading: false,
            error: 'Failed to load insights data. Please refresh the page.',
          }));
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [fullName, isAuthenticated, isLoading, user]);

  if (!user) return null;

  return (
    <>
      <Head>
        <title>Student Insights - ESICodeHub</title>
        <style id="insights-styles">{INSIGHTS_CSS}</style>
      </Head>

      <div className="ip-page">
        <Header activePage="Insights" />

        <div className="ip-container">
          <nav className="ip-breadcrumb">
            <Link href="/home" className="ip-breadcrumb-link">
              Home
            </Link>
            <span className="ip-breadcrumb-sep">/</span>
            <span className="ip-breadcrumb-current">Insights</span>
          </nav>

          <div className="ip-page-header">
            <div>
              <h1 className="ip-page-title">
                Student <span>Insights</span>
              </h1>
              <p className="ip-page-subtitle">Personal progress, submissions, and community standing</p>
            </div>
          </div>

          {state.error && <p className="ip-error">{state.error}</p>}

          <section className="ip-section ip-section-1">
            <div className="ip-section-head">
              <div className="ip-section-mark" />
              <h2 className="ip-section-title">Personal Stats</h2>
              <div className="ip-section-line" />
            </div>

            {state.loading ? (
              <p className="ip-loading">Loading your stats...</p>
            ) : (
              <div className="ip-stats-grid">
                {state.personalStats.map((tile) => (
                  <article key={tile.label} className="ip-stat-tile">
                    <p className="ip-stat-number">{tile.value}</p>
                    <p className="ip-stat-label">{tile.label}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="ip-section ip-section-2">
            <div className="ip-two-col">
              <article className="ip-card">
                <h3 className="ip-card-title">Upcoming Assignments</h3>

                {state.loading ? (
                  <p className="ip-loading">Loading assignments...</p>
                ) : state.upcomingAssignments.length === 0 ? (
                  <p className="ip-empty">No upcoming assignments.</p>
                ) : (
                  <ul className="ip-list">
                    {state.upcomingAssignments.map((item) => (
                      <li key={item.id}>
                        <Link href={`/assignments/${item.id}`} className="ip-list-link">
                          <div className="ip-row-top">
                            <p className="ip-row-title">{item.title}</p>
                            <span className={`ip-pill ${item.hasSubmitted ? 'ip-pill-submitted' : 'ip-pill-pending'}`}>
                              {item.hasSubmitted ? 'Submitted ✓' : 'Pending'}
                            </span>
                          </div>
                          <div className="ip-row-bottom" style={{ marginTop: 7 }}>
                            <span className="ip-pill ip-pill-subject">{item.subjectCode}</span>
                            <p className="ip-row-meta">{countdownText(item.deadline)}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="ip-card">
                <h3 className="ip-card-title">Your Recent Submissions</h3>

                {state.loading ? (
                  <p className="ip-loading">Loading submissions...</p>
                ) : state.recentSubmissions.length === 0 ? (
                  <p className="ip-empty">No submissions yet.</p>
                ) : (
                  <ul className="ip-list">
                    {state.recentSubmissions.map((item) => (
                      <li key={item.id}>
                        <Link href={`/submissions/${item.id}`} className="ip-list-link">
                          <div className="ip-row-top">
                            <p className="ip-row-title">{item.title}</p>
                            <span className={`ip-pill ${item.visibility === 'public' ? 'ip-pill-public' : 'ip-pill-private'}`}>
                              {item.visibility}
                            </span>
                          </div>
                          <div className="ip-row-bottom" style={{ marginTop: 7 }}>
                            <span className="ip-pill ip-pill-subject">{item.language}</span>
                            <p className="ip-row-meta">{timeAgo(item.createdAt)}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          </section>

          <section className="ip-section ip-section-3">
            <div className="ip-section-head">
              <div className="ip-section-mark" />
              <h2 className="ip-section-title">Community Leaderboard</h2>
              <div className="ip-section-line" />
            </div>

            {state.loading || state.leaderboardLoading ? (
              <p className="ip-loading">Loading leaderboard...</p>
            ) : (
              <div className="ip-board-grid">
                <LeaderboardTable
                  title="Top Questioners"
                  rows={state.topQuestioners}
                  countLabel="Questions"
                />
                <LeaderboardTable
                  title="Top Answerers"
                  rows={state.topAnswerers}
                  countLabel="Answers"
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function ProfessorInsightsContent() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfessorStats | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const fullName = useMemo(() => {
    if (!user) return '';
    return buildFullName(user.first_name, user.last_name);
  }, [user]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    const authUser = user;

    let cancelled = false;

    async function loadProfessorData() {
      setLoadingPage(true);
      setError(null);

      const [statsRes, questionRes] = await Promise.allSettled([
        getProfessorStats(),
        fetchUserQuestionCount(authUser.email, fullName),
      ]);

      if (cancelled) return;

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }

      if (questionRes.status === 'fulfilled') {
        setQuestionCount(questionRes.value);
      }

      if (statsRes.status !== 'fulfilled' && questionRes.status !== 'fulfilled') {
        setError('Failed to load professor insights right now.');
      }

      setLoadingPage(false);
    }

    loadProfessorData();

    return () => {
      cancelled = true;
    };
  }, [fullName, isAuthenticated, isLoading, user]);

  if (!user) return null;

  const professorStats: StatTile[] = [
    { label: 'Assignments Created', value: stats?.total_assignments ?? 0 },
    { label: 'Submissions Received', value: stats?.total_submissions_received ?? 0 },
    { label: 'Reviews Given', value: stats?.total_reviews_given ?? 0 },
    { label: 'Forum Questions', value: questionCount },
  ];

  return (
    <>
      <Head>
        <title>Professor Insights - ESICodeHub</title>
        <style id="insights-styles">{INSIGHTS_CSS}</style>
      </Head>

      <div className="ip-page">
        <Header activePage="Insights" />

        <div className="ip-container">
          <nav className="ip-breadcrumb">
            <Link href="/home" className="ip-breadcrumb-link">
              Home
            </Link>
            <span className="ip-breadcrumb-sep">/</span>
            <span className="ip-breadcrumb-current">Insights</span>
          </nav>

          <div className="ip-page-header">
            <div>
              <h1 className="ip-page-title">
                Professor <span>Insights</span>
              </h1>
              <p className="ip-page-subtitle">Your teaching impact and engagement snapshot</p>
            </div>
          </div>

          {error && <p className="ip-error">{error}</p>}

          <section className="ip-section ip-section-1">
            <div className="ip-section-head">
              <div className="ip-section-mark" />
              <h2 className="ip-section-title">Impact Stats</h2>
              <div className="ip-section-line" />
            </div>

            {loadingPage ? (
              <p className="ip-loading">Loading your stats...</p>
            ) : (
              <div className="ip-stats-grid">
                {professorStats.map((tile) => (
                  <article key={tile.label} className="ip-stat-tile">
                    <p className="ip-stat-number">{tile.value}</p>
                    <p className="ip-stat-label">{tile.label}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="ip-section ip-section-2">
            <div className="ip-two-col">
              <article className="ip-card">
                <h3 className="ip-card-title">Professor View</h3>
                <p className="ip-row-meta" style={{ lineHeight: 1.6 }}>
                  This route is role-aware and now serves a dedicated professor view instead of student-only content.
                  You can navigate to assignments and forum from the header for deeper actions.
                </p>
                <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                  <Link href="/assignments" className="ip-list-link" style={{ width: 'fit-content' }}>
                    Open Assignments
                  </Link>
                  <Link href="/forum" className="ip-list-link" style={{ width: 'fit-content' }}>
                    Open Forum
                  </Link>
                </div>
              </article>

              <article className="ip-card">
                <h3 className="ip-card-title">Role Routing</h3>
                <p className="ip-row-meta" style={{ lineHeight: 1.6 }}>
                  Students automatically see personal progress insights. Professors see this teaching-oriented panel.
                  This keeps a single Insights URL while respecting account role.
                </p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function InsightsPage() {
  const { user } = useAuth();

  if (!user) return null;
  return user.role === 'professor' ? <ProfessorInsightsContent /> : <StudentInsightsContent />;
}

export default function InsightsPageWrapper() {
  return (
    <ProtectedRoute>
      <InsightsPage />
    </ProtectedRoute>
  );
}
