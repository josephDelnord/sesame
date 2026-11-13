import { createHash, createHmac } from 'node:crypto';

/**
 * Formule de génération du mot de passe client.
 *
 * Le mot de passe est déterministe et recalculable.
 * - Version 0 : utilise SHA-256 pur (compatibilité avec les anciens mots de passe).
 * - Versions >= 1 : utilise HMAC-SHA256 avec une clé secrète serveur.
 *   Sans cette clé, il est impossible de recréer le mot de passe même avec
 *   les mêmes paramètres (SN, code client, version).
 * Le même couple (SN, code client) + version produit toujours le même mot de passe.
 */

// 🔐 Clé secrète pour les versions >= 1 (HMAC)
const HMAC_SECRET = process.env.PASSWORD_SECRET_KEY;
if (HMAC_SECRET && HMAC_SECRET.length < 32) {
  throw new Error(
    'PASSWORD_SECRET_KEY doit faire au moins 32 caractères dans .env. ' +
    'Générez-en une avec: openssl rand -hex 64'
  );
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_LENGTH = 12;

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!@#$%&*+-_=';
const MIXED = UPPER + LOWER + DIGITS + SPECIAL;

function sha256(input: string): Buffer {
  return createHash('sha256').update(input, 'utf8').digest();
}

function hmacSha256(input: string): Buffer {
  if (!HMAC_SECRET) {
    throw new Error(
      'PASSWORD_SECRET_KEY est requis dans .env pour les versions >= 1 (HMAC). ' +
      'Générez-en une avec: openssl rand -hex 64'
    );
  }
  return createHmac('sha256', HMAC_SECRET).update(input, 'utf8').digest();
}

// Sélecteur de fonction de hash selon la version
function hashForVersion(input: string, version: number): Buffer {
  return version === 0 ? sha256(input) : hmacSha256(input);
}

/**
 * Génère le mot de passe client associé à un numéro de série et un code client.
 *
 * Critères garantis : longueur PASSWORD_LENGTH (>= 8), au moins une majuscule,
 * une minuscule, un chiffre et un caractère spécial.
 *
 * `version` permet la rotation (régénération admin) : la version 0 est la
 * formule d'origine (compatibilité assurée avec les mots de passe existants),
 * chaque version ultérieure produit un mot de passe différent mais tout
 * aussi déterministe et recalculable.
 */
export function generatePassword(
  serialNumber: string,
  clientCode: string,
  length = PASSWORD_LENGTH,
  version = 0,
): string {
  const len = Math.max(PASSWORD_MIN_LENGTH, length);
  const versionSuffix = version > 0 ? `::v${version}` : '';
  const hash = hashForVersion(`${serialNumber}::${clientCode}${versionSuffix}`, version);

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

  // Mélange déterministe (Fisher-Yates piloté par un second hash) pour que les
  // classes garanties ne soient pas toujours aux quatre premières positions.
  const order = hashForVersion(`order:${serialNumber}::${clientCode}${versionSuffix}`, version);
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
