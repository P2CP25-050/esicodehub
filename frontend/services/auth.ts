// services/auth.ts
// ─────────────────────────────────────────────────────────
// All auth API calls follow the same pattern used across
// the codebase: each function returns { data } so callers
// can do res.data.xxx consistently.
// ─────────────────────────────────────────────────────────

import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});

// ─── Payload types ────────────────────────────────────────

export interface RegisterPayload {
  email:            string;
  password:         string;
  password_confirm: string;
}

export interface VerifyEmailPayload {
  email: string;
  code:  string;
}

export interface ResendVerificationPayload {
  email: string;
}

// ─── Response types ───────────────────────────────────────

export interface RegisterResponse {
  message: string;
}

// Backend returns: { "access": "...", "refresh": "...", "user": { ... } }
export interface VerifyEmailResponse {
  access:  string;
  refresh: string;
  user: {
    id:    number;
    email: string;
    role:  "student" | "professor";
  };
}

export interface ResendVerificationResponse {
  message: string;
}

// ─── API calls ────────────────────────────────────────────

/**
 * Step 1 — Register a new user.
 * Backend sends a 6-digit verification code to their email.
 */
export async function register(
  payload: RegisterPayload
): Promise<{ data: RegisterResponse }> {
  const res = await api.post<RegisterResponse>("/auth/register/", payload);
  return { data: res.data };
}

/**
 * Step 2 — Verify the 6-digit code.
 * Returns access token, refresh token, and user info.
 */
export async function verifyEmail(
  payload: VerifyEmailPayload
): Promise<{ data: VerifyEmailResponse }> {
  const res = await api.post<VerifyEmailResponse>("/auth/verify/", payload);
  return { data: res.data };
}

/**
 * Resend verification code to the same email.
 * Endpoint: /auth/resend-verification/
 */
export async function resendVerification(
  payload: ResendVerificationPayload
): Promise<{ data: ResendVerificationResponse }> {
  const res = await api.post<ResendVerificationResponse>(
    "/auth/resend-verification/",
    payload
  );
  return { data: res.data };
}
