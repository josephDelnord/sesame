/**
 * Module d'intégration avec HashiCorp Vault pour la récupération
 * du sel statique PASSWORD_SECRET_KEY.
 * 
 * Priorité :
 * 1. Vault (si VAULT_ADDR est défini)
 * 2. Variable d'environnement PASSWORD_SECRET_KEY (fallback dev)
 * 
 * En production, seul Vault doit être utilisé.
 */

import NodeVault from 'node-vault';

// Type pour le client Vault
interface VaultClient {
  read(path: string): Promise<{ data?: { data?: Record<string, unknown> } }>;
}

// Singleton pour le client Vault
let vaultClient: VaultClient | null = null;

/**
 * Crée ou retourne le client Vault singleton.
 * Retourne null si Vault n'est pas configuré (VAULT_ADDR absent).
 */
function getVaultClient(): VaultClient | null {
  if (!process.env.VAULT_ADDR) {
    return null;
  }

  if (!vaultClient) {
    vaultClient = NodeVault({
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
      apiVersion: 'v2', // Utilise KV v2 par défaut
    });
  }
  return vaultClient;
}

/**
 * Récupère le PASSWORD_SECRET_KEY depuis Vault.
 * Vault est OBLIGATOIRE. Il n'y a plus de fallback sur .env.
 * 
 * @throws Error si Vault n'est pas configuré ou si le secret est introuvable
 */
export async function getPasswordSecretKey(): Promise<string> {
  const vault = getVaultClient();

  if (!vault) {
    throw new Error(
      'Vault est OBLIGATOIRE. Configurez VAULT_ADDR et VAULT_TOKEN dans .env ' +
      'pour utiliser Vault (ex: VAULT_ADDR=http://vault:8200 VAULT_TOKEN=root).'
    );
  }

  try {
    // KV v2 : chemin = secret/data/sesame
    const result = await vault.read('secret/data/sesame');
    
    // Structure KV v2 : { data: { data: { password_secret_key: "..." } } }
    const v2Data = result?.data as { data?: Record<string, unknown> } | undefined;
    if (v2Data?.data && typeof v2Data.data.password_secret_key === 'string') {
      const secret = v2Data.data.password_secret_key as string;
      if (secret.length >= 32) {
        return secret;
      }
      throw new Error('PASSWORD_SECRET_KEY dans Vault est trop court (min 32 caractères)');
    }
    
    // KV v1 fallback : chemin = secret/sesame
    const v1Result = await vault.read('secret/sesame');
    const v1Data = v1Result?.data as Record<string, unknown> | undefined;
    if (v1Data && typeof v1Data.password_secret_key === 'string') {
      const secret = v1Data.password_secret_key as string;
      if (secret.length >= 32) {
        return secret;
      }
      throw new Error('PASSWORD_SECRET_KEY dans Vault est trop court (min 32 caractères)');
    }
    
    throw new Error(
      'PASSWORD_SECRET_KEY introuvable dans Vault. ' +
      'Vérifiez que le secret existe à secret/data/sesame ou secret/sesame.'
    );
  } catch (error) {
    throw new Error(
      `Impossible de récupérer PASSWORD_SECRET_KEY depuis Vault : ${(error as Error).message}`
    );
  }
}

/**
 * Vérifie si Vault est configuré et accessible.
 */
export function isVaultConfigured(): boolean {
  return !!process.env.VAULT_ADDR;
}
