import apiClient from '@/lib/axios';
import axios from 'axios';



//interfaces
export interface RegisterRequest {
  email: string;
  password: string;
  password_confirm: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthUser {
  email: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'professor';
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

//functions

//validation and auth flows
export const register = (data: RegisterRequest) =>
  apiClient.post('/auth/register/', data);

//verify email with code sent to user's email
export const verifyEmail = (data: VerifyEmailRequest) =>
  apiClient.post('/auth/verify-email/', data);

//resend verification code to user's email
export const resendVerification = (data: ResendVerificationRequest) =>
  apiClient.post('/auth/resend-verification/', data);

//login and get tokens
export const login = (data: LoginRequest) =>
  apiClient.post<LoginResponse>('/auth/login/', data);
//refresh access token using refresh token
export const refreshToken = (refresh: string) =>
  axios.post<AuthTokens>(
	  `${process.env.NEXT_PUBLIC_API_URL}/auth/token/refresh/`,
	  { refresh }
  );
//the response returned  by GET auth/me endpoint
//returns the current user's profile based on the access token provided in the request headers
//email ,   first_name, last_name, role (student or professor)
export interface MeResponse {
  email: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'professor';
}
//get current user profile using access token
export const getMe = () =>
  apiClient.get<MeResponse>('/auth/me/');