import type { Request } from 'express';
import { getAdminToken, isVaultConfigured } from '../services/vault.js';

// Cache pour l'ADMIN_TOKEN (évite de leer Vault à chaque requête)
let cachedAdminToken: string | null = null;

/**
 * Met à jour le cache de l'ADMIN_TOKEN depuis Vault.
 * Appelé une fois au démarrage ou quand le token n'est pas en cache.
 */
async function updateAdminTokenCache(): Promise<void> {
  if (!isVaultConfigured()) {
    // Vault non configuré : fonctionnalité admin désactivée
    cachedAdminToken = null;
    return;
  }
  try {
    cachedAdminToken = await getAdminToken();
  } catch {
    // Erreur de récupération : fonctionnalité admin désactivée
    cachedAdminToken = null;
  }
}

/**
 * Vérifie l'authentification administrateur :
 * en-tête "Authorization: Bearer <ADMIN_TOKEN>" (désactivé si non configuré).
 * 
 * Note : L'ADMIN_TOKEN est maintenant stocké dans Vault et non dans les variables
 * d'environnement. Si Vault n'est pas configuré, la fonctionnalité est désactivée.
 */
export async function isAdmin(req: Request): Promise<boolean> {
  // Mise à jour du cache si nécessaire (lazy loading)
  if (cachedAdminToken === null) {
    await updateAdminTokenCache();
  }
  
  const expected = cachedAdminToken;
  if (!expected) return false;
  
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return false;
  
  const token = header.slice(7).trim();
  return token.length > 0 && token === expected;
}

/**
 * Met à jour manuellement le cache de l'ADMIN_TOKEN.
 * Utile après un redémarrage de Vault ou une rotation du token.
 */
export async function refreshAdminToken(): Promise<void> {
  await updateAdminTokenCache();
}
