import { createHmac } from 'node:crypto';

/**
 * Formule de génération du mot de passe client.
 *
 * Le mot de passe est déterministe et recalculable via HMAC-SHA256
 * avec un sel statique (PASSWORD_SECRET_KEY). Sans ce sel, il est
 * IMPOSSIBLE de recréer le mot de passe même avec les mêmes paramètres.
 */

// 🔐 Sel statique OBLIGATOIRE : doit être défini dans .env (min 32 caractères)
const secret = process.env.PASSWORD_SECRET_KEY;
if (!secret || secret.length < 32) {
  throw new Error(
    'PASSWORD_SECRET_KEY est OBLIGATOIRE (min 32 caractères) dans .env. ' +
    'Générez-en une avec: openssl rand -hex 64'
  );
}
const PASSWORD_SECRET: string = secret;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_LENGTH = 12;

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!@#$%&*+-_=';
const MIXED = UPPER + LOWER + DIGITS + SPECIAL;

function hmacSha256(input: string): Buffer {
  return createHmac('sha256', PASSWORD_SECRET).update(input, 'utf8').digest();
}

/**
 * Génère le mot de passe client associé à un numéro de série et un code client.
 *
 * Critères garantis : longueur PASSWORD_LENGTH (>= 8), au moins une majuscule,
 * une minuscule, un chiffre et un caractère spécial.
 *
 * `version` permet la rotation (régénération admin) : chaque version produit
 * un mot de passe différent mais toujours déterministe et recalculable.
 * Tous les mots de passe utilisent HMAC-SHA256 avec le sel statique.
 */
export function generatePassword(
  serialNumber: string,
  clientCode: string,
  length = PASSWORD_LENGTH,
  version = 0,
): string {
  const len = Math.max(PASSWORD_MIN_LENGTH, length);
  const versionSuffix = version > 0 ? `::v${version}` : '';
  const hash = hmacSha256(`${serialNumber}::${clientCode}${versionSuffix}`);

  // Quatre positions de classe garantie (au moins 8 caractères demandés).
  const chars: string[] = [
    UPPER[hash[0] % UPPER.length],
    LOWER[hash[1] % LOWER.length],
    DIGITS[hash[2] % DIGITS.length],
    SPECIAL[hash[3] % SPECIAL.length],
  ];
  for (let i = 4; i < len; i++) {
    chars.push(MIXED[hash[i] % MIXED.length]);
  }

  // Mélange déterministe (Fisher-Yates piloté par un second HMAC) pour que les
  // classes garanties ne soient pas toujours aux quatre premières positions.
  const order = hmacSha256(`order:${serialNumber}::${clientCode}${versionSuffix}`);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = order[i % order.length] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/** Vérifie qu'une chaîne respecte les critères prédéfinis du mot de passe. */
export function meetsCriteria(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%&*+\-_=]/.test(password)
  );
}
