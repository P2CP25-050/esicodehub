import { useState, useEffect, useCallback } from "react";
import { listAssignments } from "@/services/assignments";
import type { Assignment, PaginatedResponse } from "@/services/assignments";

interface UseAssignmentsResult {
  assignments: Assignment[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches the assignment list for the current user.
 * Pass `group` to filter by group number (professors only).
 * The backend decides what the current user is allowed to see based on their JWT role.
 */
export function useAssignments(group?: number): UseAssignmentsResult {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: PaginatedResponse<Assignment> = await listAssignments(
        group !== undefined ? { group } : undefined
      );
      setAssignments(data.results);
      setTotal(data.count);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load assignments."
      );
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  return { assignments, total, loading, error, refetch: load };
}
