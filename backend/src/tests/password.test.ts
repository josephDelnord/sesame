import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initPasswords, generatePassword, meetsCriteria, PASSWORD_MIN_LENGTH } from '../services/password.js';

// Initialiser le module password avant tous les tests
// Utilise le .env pour récupérer PASSWORD_SECRET_KEY
let passwordInitialized = false;
test.before(async () => {
  await initPasswords();
  passwordInitialized = true;
});

test('le mot de passe est déterministe (recalculable)', () => {
  if (!passwordInitialized) assert.fail('Password module not initialized');
  assert.equal(
    generatePassword('RTR-2024-000117', 'CL-7F3A'),
    generatePassword('RTR-2024-000117', 'CL-7F3A'),
  );
});

test('le mot de passe respecte les critères prédéfinis', () => {
  for (let i = 0; i < 200; i++) {
    const sn = `RTR-${i}`;
    const code = `CL-${i}`;
    const password = generatePassword(sn, code);
    assert.ok(password.length >= PASSWORD_MIN_LENGTH, 'longueur minimale de 8 caractères');
    assert.ok(meetsCriteria(password), `critères non respectés pour ${password}`);
  }
});

test('des SN différents produisent des mots de passe différents', () => {
  const a = generatePassword('RTR-2024-000117', 'CL-7F3A');
  const b = generatePassword('RTR-2024-000218', 'CL-7F3A');
  assert.notEqual(a, b);
});

test('des codes clients différents produisent des mots de passe différents', () => {
  const a = generatePassword('RTR-2024-000117', 'CL-7F3A');
  const b = generatePassword('RTR-2024-000117', 'CL-9B2C');
  assert.notEqual(a, b);
});

test('la version 0 utilise le sel statique (HMAC-SHA256)', () => {
  // La version 0 utilise maintenant HMAC-SHA256 avec le sel statique.
  // Vérification du déterminisme : même input = même output
  const pwd1 = generatePassword('RTR-2025-000909', 'CL-CRM01', 12, 0);
  const pwd2 = generatePassword('RTR-2025-000909', 'CL-CRM01', 12, 0);
  assert.equal(pwd1, pwd2, 'La version 0 doit être déterministe');
  
  // Vérification que le comportement par défaut reste la version 0.
  assert.equal(
    generatePassword('RTR-2025-000909', 'CL-CRM01'),
    generatePassword('RTR-2025-000909', 'CL-CRM01', 12, 0),
  );
});

test('une version supérieure produit un mot de passe différent et déterministe', () => {
  const v0 = generatePassword('RTR-2024-000117', 'CL-7F3A', 12, 0);
  const v1 = generatePassword('RTR-2024-000117', 'CL-7F3A', 12, 1);
  const v2 = generatePassword('RTR-2024-000117', 'CL-7F3A', 12, 2);
  assert.notEqual(v1, v0);
  assert.notEqual(v2, v1);
  assert.equal(v1, generatePassword('RTR-2024-000117', 'CL-7F3A', 12, 1));
  assert.ok(meetsCriteria(v1));
  assert.ok(meetsCriteria(v2));
});

test('toutes les versions respectent les critères prédéfinis', () => {
  for (let i = 0; i < 50; i++) {
    for (let version = 0; version < 3; version++) {
      const password = generatePassword(`RTR-${i}`, `CL-${i}`, 12, version);
      assert.ok(meetsCriteria(password), `critères non respectés pour ${password} (v${version})`);
    }
  }
});
