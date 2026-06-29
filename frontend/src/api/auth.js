import { api } from './client.js';

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data.data;
}

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data.data;
}

export async function me() {
  const { data } = await api.get('/auth/me');
  return data.data;
}

export async function refresh(refreshToken) {
  const { data } = await api.post('/auth/refresh', { refreshToken });
  return data.data;
}

export async function logout(refreshToken) {
  await api.post('/auth/logout', { refreshToken });
}

export async function verifyEmail(token) {
  const { data } = await api.post('/auth/verify-email', { token });
  return data.data;
}

export async function resendVerification() {
  const { data } = await api.post('/auth/verify-email/resend');
  return data.data;
}

export async function resendVerificationPublic(email) {
  const { data } = await api.post('/auth/verify-email/resend-public', { email });
  return data.data;
}

export async function forgotPassword(email) {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(token, password) {
  await api.post('/auth/reset-password', { token, password });
}
