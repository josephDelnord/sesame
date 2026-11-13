/** lecture d'un champ de requête : chaîne nettoyée, ou undefined si vide/absent. */
export function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
