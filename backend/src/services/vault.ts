/**
 * Module d'intégration avec HashiCorp Vault pour la récupération
 * des secrets PASSWORD_SECRET_KEY et ADMIN_TOKEN.
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

// Chemin KV v2 pour les secrets
const SECRET_PATH = 'secret/data/data/sesame';

/**
 * Récupère le Role ID depuis un fichier ou une variable d'environnement.
 */
function getRoleId(): string | null {
  try {
    const roleIdPath = process.env.VAULT_ROLE_ID_FILE || '/run/secrets/vault_role_id';
    return readFileSync(roleIdPath, 'utf8').trim();
  } catch {
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
      } catch {
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
 * Récupère un secret depuis Vault KV v2.
 * 
 * @param field - Nom du champ à récupérer (ex: 'password_secret_key', 'admin_token')
 * @param minLength - Longueur minimale requise
 * @param fieldName - Nom affiché dans les messages d'erreur
 * @throws Error si Vault n'est pas configuré ou si le secret est introuvable
 */
async function getSecretFromVault(
  field: string,
  minLength: number,
  fieldName: string
): Promise<string> {
  const vault = await getVaultClient();

  if (!vault) {
    throw new Error(
      'Vault est OBLIGATOIRE. Configurez VAULT_ADDR et soit : ' +
      '(1) VAULT_ROLE_ID_FILE + VAULT_SECRET_ID_FILE pour AppRole, ' +
      '(2) VAULT_TOKEN pour l\'authentification directe.'
    );
  }

  try {
    const result = await vault.read(SECRET_PATH);
    
    // Structure KV v2 : { data: { data: { [field]: "..." } } }
    const v2Data = result?.data as { data?: Record<string, unknown> } | undefined;
    if (v2Data?.data && typeof v2Data.data[field] === 'string') {
      const value = v2Data.data[field] as string;
      if (value.length >= minLength) {
        return value;
      }
      throw new Error(`${fieldName} dans Vault est trop court (min ${minLength} caractères)`);
    }
    
    throw new Error(
      `${fieldName} introuvable dans Vault. ` +
      `Vérifiez que le secret existe à ${SECRET_PATH}.`
    );
  } catch (error) {
    throw new Error(
      `Impossible de récupérer ${fieldName} depuis Vault : ${(error as Error).message}`
    );
  }
}

/**
 * Récupère le PASSWORD_SECRET_KEY depuis Vault.
 * Vault est OBLIGATOIRE. Il n'y a plus de fallback sur .env.
 * 
 * @throws Error si Vault n'est pas configuré ou si le secret est introuvable
 */
export async function getPasswordSecretKey(): Promise<string> {
  return getSecretFromVault('password_secret_key', 32, 'PASSWORD_SECRET_KEY');
}

/**
 * Récupère l'ADMIN_TOKEN depuis Vault.
 * 
 * @throws Error si Vault n'est pas configuré ou si le token est introuvable
 */
export async function getAdminToken(): Promise<string> {
  return getSecretFromVault('admin_token', 16, 'ADMIN_TOKEN');
}

/**
 * Vérifie si Vault est configuré et accessible.
 */
export function isVaultConfigured(): boolean {
  return !!process.env.VAULT_ADDR;
}

// Export pour les tests
export { SECRET_PATH, getVaultClient };
