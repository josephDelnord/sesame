/**
 * Module d'intégration avec HashiCorp Vault pour la récupération
 * du sel statique PASSWORD_SECRET_KEY.
 * 
 * Utilise AppRole pour l'authentification (plus sécurisé que le token root).
 * En développement, les Role ID et Secret ID sont montés via Docker secrets.
 */

import NodeVault from 'node-vault';
import { readFileSync } from 'fs';

// Type pour le client Vault
interface VaultClient {
  read(path: string): Promise<{ data?: { data?: Record<string, unknown> } }>;
  approleLogin(params: { role_id: string; secret_id: string }): Promise<void>;
}

// Singleton pour le client Vault
let vaultClient: VaultClient | null = null;

/**
 * Récupère le Role ID depuis un fichier ou une variable d'environnement.
 */
function getRoleId(): string | null {
  // Essayer de lire depuis le fichier monté par Docker
  try {
    const roleIdPath = process.env.VAULT_ROLE_ID_FILE || '/run/secrets/vault_role_id';
    return readFileSync(roleIdPath, 'utf8').trim();
  } catch {
    // Retourner null si le fichier n'existe pas
    return null;
  }
}

/**
 * Récupère le Secret ID depuis un fichier ou une variable d'environnement.
 */
function getSecretId(): string | null {
  try {
    const secretIdPath = process.env.VAULT_SECRET_ID_FILE || '/run/secrets/vault_secret_id';
    return readFileSync(secretIdPath, 'utf8').trim();
  } catch {
    return null;
  }
}

/**
 * Crée ou retourne le client Vault singleton.
 * Utilise AppRole pour l'authentification.
 * Retourne null si Vault n'est pas configuré.
 */
async function getVaultClient(): Promise<VaultClient | null> {
  if (!process.env.VAULT_ADDR) {
    return null;
  }

  if (!vaultClient) {
    const client = NodeVault({
      endpoint: process.env.VAULT_ADDR,
      apiVersion: 'v1',
    });
    
    // Authentification avec AppRole si les fichiers sont disponibles
    const roleId = getRoleId();
    const secretId = getSecretId();
    
    if (roleId && secretId) {
      try {
        await client.approleLogin({ role_id: roleId, secret_id: secretId });
        vaultClient = client;
      } catch (error) {
        return null;
      }
    } else if (process.env.VAULT_TOKEN) {
      // Fallback sur le token direct (pour le dev sans AppRole)
      client.token = process.env.VAULT_TOKEN;
      vaultClient = client as VaultClient;
    } else {
      return null;
    }
  }
  return vaultClient;
}

/**
 * Récupère le PASSWORD_SECRET_KEY depuis Vault.
 * Vault est OBLIGATOIRE. Il n'y a plus de fallback sur .env.
 * Utilise AppRole pour l'authentification.
 * 
 * @throws Error si Vault n'est pas configuré ou si le secret est introuvable
 */
export async function getPasswordSecretKey(): Promise<string> {
  const vault = await getVaultClient();

  if (!vault) {
    throw new Error(
      'Vault est OBLIGATOIRE. Configurez VAULT_ADDR et soit : ' +
      '(1) VAULT_ROLE_ID_FILE + VAULT_SECRET_ID_FILE pour AppRole, ' +
      '(2) VAULT_TOKEN pour l\'authentification directe.'
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
