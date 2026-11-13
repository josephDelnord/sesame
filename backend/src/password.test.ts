import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword, meetsCriteria, PASSWORD_MIN_LENGTH } from './password.js';

test('le mot de passe est déterministe (recalculable)', () => {
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

test('la version 0 reproduit exactement la formule d\'origine (compatibilité)', () => {
  // Valeur produite par la formule AVANT l'ajout du paramètre version :
  // si ce test échoue, les mots de passe existants ont changé.
  assert.equal(
    generatePassword('RTR-2025-000909', 'CL-CRM01', 12, 0),
    '-jECSouuxX2K',
  );
  // Le comportement par défaut reste la version 0.
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
