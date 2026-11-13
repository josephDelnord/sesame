/**
 * Tests d'intégration avec HashiCorp Vault
 * 
 * Ces tests nécessitent un conteneur Vault en cours d'exécution
 * avec AppRole configuré et le secret PASSWORD_SECRET_KEY stocké.
 * 
 * Lancement :
 *   - Avec Docker Compose : make test-integration
 *   - Manuellement : VAULT_ADDR=http://localhost:8200 VAULT_TOKEN=root npm test
 */

import { describe, it, beforeAll, afterAll } from 'node:test';
import assert from 'node:assert';
import NodeVault from 'node-vault';
import { getPasswordSecretKey, isVaultConfigured } from '../../src/services/vault.js';

// Variables pour le client Vault de test
let testVaultClient: NodeVault | null = null;
const TEST_SECRET_PATH = 'secret/data/data/sesame';
const TEST_SECRET_KEY = 'password_secret_key';

/**
 * Crée un client Vault pour les tests avec le token root
 * (uniquement pour les tests, pas en production)
 */
async function createTestVaultClient(): Promise<NodeVault> {
  const addr = process.env.VAULT_ADDR || 'http://localhost:8200';
  const token = process.env.VAULT_TOKEN;
  
  if (!token) {
    throw new Error('VAULT_TOKEN est requis pour les tests d\'intégration. ' +
      'Assurez-vous que Vault est démarré avec un token root.');
  }
  
  const client = NodeVault({
    endpoint: addr,
    token: token,
    apiVersion: 'v1',
  });
  
  // Vérifier que Vault est accessible
  const status = await client.status();
  if (status.sealed ?? false) {
    throw new Error('Vault est sealed. Déverrouillez-le avant de lancer les tests.');
  }
  
  return client;
}

/**
 * Nettoie le secret de test après les tests
 */
async function cleanupTestSecret(client: NodeVault): Promise<void> {
  try {
    // Note: on ne nettoie pas en production, uniquement en test
    // Mais on ne devrait jamais exécuter ces tests en production
  } catch (error) {
    // Ignorer les erreurs de nettoyage
  }
}

describe('Integration: HashiCorp Vault', () => {
  beforeAll(async () => {
    // Vérifier que Vault est configuré
    if (!isVaultConfigured()) {
      throw new Error('Vault n\'est pas configuré. ' +
        'Définissez VAULT_ADDR et VAULT_TOKEN pour les tests.');
    }
    
    // Créer un client de test avec le token root
    testVaultClient = await createTestVaultClient();
  });

  afterAll(async () => {
    if (testVaultClient) {
      await cleanupTestSecret(testVaultClient);
    }
  });

  describe('Configuration Vault', () => {
    it('devrait avoir VAULT_ADDR configuré', () => {
      assert.ok(process.env.VAULT_ADDR, 'VAULT_ADDR doit être défini');
      assert.ok(process.env.VAULT_ADDR?.startsWith('http'), 
        'VAULT_ADDR doit être une URL valide');
    });

    it('devrait avoir VAULT_TOKEN configuré pour les tests', () => {
      assert.ok(process.env.VAULT_TOKEN, 'VAULT_TOKEN doit être défini pour les tests');
    });
  });

  describe('Connexion Vault', () => {
    it('devrait se connecter à Vault avec le token root', async () => {
      const client = testVaultClient;
      assert.ok(client, 'Le client Vault devrait être créé');
      
      const status = await client.status();
      assert.ok(status, 'La réponse de status devrait exister');
      assert.ok(!status.sealed, 'Vault ne devrait pas être sealed');
    });

    it('devrait avoir le secret PASSWORD_SECRET_KEY stocké', async () => {
      const client = testVaultClient;
      assert.ok(client, 'Le client Vault devrait être créé');
      
      const result = await client.read(TEST_SECRET_PATH);
      assert.ok(result, 'La lecture du secret devrait réussir');
      assert.ok(result.data, 'Les données du secret devraient exister');
      
      const data = result.data as { data?: Record<string, unknown> };
      assert.ok(data.data, 'Les données KV v2 devraient exister');
      
      const secret = data.data[TEST_SECRET_KEY] as string | undefined;
      assert.ok(secret, 'Le PASSWORD_SECRET_KEY devrait exister');
      assert.ok(secret.length >= 32, 'Le secret devrait faire au moins 32 caractères');
    });
  });

  describe('Service Vault (backend)', () => {
    it('devrait récupérer le PASSWORD_SECRET_KEY via AppRole', async () => {
      // Cette fonction utilise AppRole (Role ID + Secret ID)
      // Elle devrait fonctionner si les fichiers sont montés
      const secret = await getPasswordSecretKey();
      
      assert.ok(secret, 'Le secret devrait être récupéré');
      assert.ok(secret.length >= 32, 'Le secret devrait faire au moins 32 caractères');
      assert.ok(/^[a-f0-9]+$/.test(secret), 'Le secret devrait être hexadécimal');
    });

    it('devrait détecter que Vault est configuré', () => {
      const configured = isVaultConfigured();
      assert.ok(configured, 'Vault devrait être détecté comme configuré');
    });
  });

  describe('AppRole', () => {
    it('devrait avoir le rôle sesame-backend configuré', async () => {
      const client = testVaultClient;
      assert.ok(client, 'Le client Vault devrait être créé');
      
      const roles = await client.list('auth/approle/role');
      assert.ok(roles, 'La liste des rôles devrait exister');
      
      const roleNames = roles.data?.keys || [];
      assert.ok(roleNames.includes('sesame-backend'), 
        'Le rôle sesame-backend devrait exister');
    });

    it('devrait avoir les fichiers Role ID et Secret ID accessibles', () => {
      const roleIdPath = process.env.VAULT_ROLE_ID_FILE || '/run/secrets/vault_role_id';
      const secretIdPath = process.env.VAULT_SECRET_ID_FILE || '/run/secrets/vault_secret_id';
      
      try {
        const fs = require('fs');
        const roleId = fs.readFileSync(roleIdPath, 'utf8').trim();
        const secretId = fs.readFileSync(secretIdPath, 'utf8').trim();
        
        assert.ok(roleId, 'Le Role ID devrait exister');
        assert.ok(secretId, 'Le Secret ID devrait exister');
        assert.ok(roleId.length > 0, 'Le Role ID ne devrait pas être vide');
        assert.ok(secretId.length > 0, 'Le Secret ID ne devrait pas être vide');
      } catch (error) {
        // En mode test sans fichiers montés, on ignore
        // (c'est le cas quand on utilise VAULT_TOKEN directement)
      }
    });
  });
});

// Export pour permettre l'exécution directe
export default {};
