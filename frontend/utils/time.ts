/**
 * Converts an ISO date string into a human-readable relative time string.
 *
 * @example
 * relativeTime("2024-01-15T10:30:00Z") // "2 hours ago"
 * relativeTime("2024-01-10T10:30:00Z") // "5 days ago"
 */
export const relativeTime = (dateStr: string): string => {

  const timestamp = new Date(dateStr).getTime();

  const diff   = Date.now() - timestamp;
  if (Number.isNaN(diff)) {
    return '';
  }

  const mins   = Math.floor(diff / 60_000);
  const hours  = Math.floor(diff / 3_600_000);
  const days   = Math.floor(diff / 86_400_000);
  const weeks  = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins} minute${mins   > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours   > 1 ? 's' : ''} ago`;
  if (days  < 7)  return `${days} day${days      > 1 ? 's' : ''} ago`;
  if (weeks < 4)  return `${weeks} week${weeks   > 1 ? 's' : ''} ago`;
  return              `${months} month${months   > 1 ? 's' : ''} ago`;
};
  
