// server/auth.ts
import { randomUUID } from 'crypto';

export interface SessionData {
  userId: string;
  username: string;
  role: string;
}

const sessions = new Map<string, SessionData>();

export function createSession(userId: string, username: string, role: string): string {
  const token = randomUUID();
  sessions.set(token, { userId, username, role });
  return token;
}

export function getSession(token: string): SessionData | null {
  return sessions.get(token) ?? null;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

/** Extract bearer token from Authorization header, or null */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
