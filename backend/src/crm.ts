/**
 * Connecteur vers le CRM de l'entreprise.
 *
 * Utilisé comme source complémentaire à la base locale : quand un
 * enregistrement n'est pas trouvé en base, le backend interroge le CRM
 * avec les données partielles disponibles (SN, code client, IP), puis
 * importe l'équipement trouvé pour recalculer le mot de passe.
 *
 * Configuration (variables d'environnement) :
 * - CRM_API_URL      : URL de base du CRM, ex. https://crm.exemple.fr/api
 *                      (si absent, le connecteur est désactivé)
 * - CRM_SEARCH_PATH  : chemin de recherche, par défaut "/search"
 * - CRM_API_KEY      : clé d'API envoyée en en-tête "Authorization: Bearer ..."
 *
 * Contrat attendu du CRM : POST {CRM_API_URL}{CRM_SEARCH_PATH} reçoit
 * `{ serialNumber?, clientCode?, ip? }` et répond:
 * - 200 + { record: { serialNumber, clientCode, ip } } si trouvé ;
 * - 200 + { record: null } ou 404 si aucun équipement ne correspond.
 */

const CRM_TIMEOUT_MS = 5000;

export interface CrmRecord {
  serialNumber: string;
  clientCode: string;
  ip: string;
}

type PartialFields = {
  serialNumber?: string;
  clientCode?: string;
  ip?: string;
};

export class CrmError extends Error {}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function crmBaseUrl(): string | undefined {
  const url = process.env.CRM_API_URL?.trim();
  return url ? url.replace(/\/+$/, '') : undefined;
}

function crmSearchUrl(): string {
  const path = process.env.CRM_SEARCH_PATH?.trim() || '/search';
  return `${crmBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function searchCrm(
  partial: PartialFields,
  fetchFn: FetchLike = fetch,
): Promise<CrmRecord | null> {
  const base = crmBaseUrl();
  if (!base) return null;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.CRM_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let res: Response;
  try {
    res = await fetchFn(crmSearchUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(partial),
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
    });
  } catch {
    throw new CrmError('Le CRM est injoignable.');
  }

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new CrmError(`Le CRM a répondu avec le code HTTP ${res.status}.`);
  }

  let data: { record?: Partial<CrmRecord> | null };
  try {
    data = (await res.json()) as { record?: Partial<CrmRecord> | null };
  } catch {
    throw new CrmError('Réponse du CRM illisible (JSON invalide).');
  }

  const record = data?.record;
  if (!record?.serialNumber || !record.clientCode || !record.ip) {
    throw new CrmError('Réponse du CRM invalide : serialNumber, clientCode et ip sont requis.');
  }
  return {
    serialNumber: String(record.serialNumber),
    clientCode: String(record.clientCode),
    ip: String(record.ip),
  };
}
