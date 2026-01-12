import { NextRequest } from 'next/server';

const ORG_SCOPES = ['org.read', 'mcp.org.read', 'aistatus.org.read'];

function decodeJwtPayload(token: string): Record<string, any> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function extractScopes(payload: Record<string, any>): string[] {
  if (!payload) return [];
  const scope = payload.scope;
  if (typeof scope === 'string') return scope.split(/\s+/).filter(Boolean);
  const scp = payload.scp;
  if (Array.isArray(scp)) return scp.map(String);
  if (typeof scp === 'string') return scp.split(/\s+/).filter(Boolean);
  const permissions = payload.permissions;
  if (Array.isArray(permissions)) return permissions.map(String);
  return [];
}

export function requireOrgScope(request: NextRequest): { ok: boolean; error?: string } {
  const header = request.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return { ok: false, error: 'missing_authorization' };
  }
  const token = header.slice('bearer '.length).trim();
  if (!token) {
    return { ok: false, error: 'missing_token' };
  }

  const allowToken = process.env.MCP_ORG_TOKEN;
  if (allowToken && token === allowToken) {
    return { ok: true };
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { ok: false, error: 'invalid_token' };
  }

  const scopes = extractScopes(payload);
  const hasScope = scopes.some((scope) => ORG_SCOPES.includes(scope));
  if (!hasScope) {
    return { ok: false, error: 'insufficient_scope' };
  }

  return { ok: true };
}
