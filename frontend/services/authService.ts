// ─────────────────────────────────────────────────────────
// services/authService.ts
// All authentication API calls live here.
// Replace BASE_URL with your actual backend URL.
// ─────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

// ─── Types ────────────────────────────────────────────────
export interface RegisterPayload {
  email: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  role: "student" | "professor";
}

export interface VerifyPayload {
  email: string;
  code: string;
}

export interface VerifyResponse {
  message: string;
  access_token: string;
  refresh_token: string;
  role: "student" | "professor";
}

export interface ResendPayload {
  email: string;
}

// ─── Helpers ──────────────────────────────────────────────
async function request<T>(
  endpoint: string,
  payload: object
): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    // Throw the backend error message so UI can display it
    throw new Error(data?.detail ?? data?.message ?? "Something went wrong");
  }

  return data as T;
}

// ─── API calls ────────────────────────────────────────────

/**
 * Step 1 — Register a new user.
 * Backend sends a 6-digit verification code to their email.
 */
export async function registerUser(
  payload: RegisterPayload
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/auth/register/", payload);
}

/**
 * Step 2 — Verify the 6-digit code sent by email.
 * Returns tokens and role on success.
 */
export async function verifyCode(
  payload: VerifyPayload
): Promise<VerifyResponse> {
  return request<VerifyResponse>("/auth/verify/", payload);
}

/**
 * Resend the verification code to the same email.
 */
export async function resendCode(
  payload: ResendPayload
): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/resend-code/", payload);
}
