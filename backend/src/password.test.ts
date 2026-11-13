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
