import type { Request } from 'express';

/**
 * Vérifie l'authentification administrateur :
 * en-tête "Authorization: Bearer <ADMIN_TOKEN>" (désactivé si non configuré).
 */
export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return false;
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice(7).trim();
  return token.length > 0 && token === expected;
}
