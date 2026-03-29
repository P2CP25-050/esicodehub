import { useEffect, ReactNode } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth1";

interface Props { children: ReactNode; }

/**
 * Guards any page that requires authentication.
 * - While auth resolves → centred spinner matching the app palette.
 * - Not authenticated → redirects to /login?redirect=<current path>.
 * - Authenticated → renders children.
 */
export default function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(router.asPath)}`);
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex flex-col items-center justify-center gap-3.5">
        {/* Spinner */}
        <span className="w-9 h-9 rounded-full border-[3px] border-[#d1d9e6] border-t-[#1d6ef5] animate-spin" />
        <span className="text-sm text-[#64748b]">
          {loading ? "Checking authentication…" : "Redirecting to login…"}
        </span>
      </div>
    );
  }

  return <>{children}</>;
}