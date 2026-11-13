export interface RouterRecord {
  id: number;
  serialNumber: string;
  clientCode: string;
  ip: string;
  createdAt: string;
  passwordVersion: number;
}

export interface ResolveResponse {
  record: RouterRecord;
  password: string;
}

export interface ApiError {
  error: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * Appelle POST /api/resolve : la base complète les champs manquants
 * (SN, code client, IP) et le backend recalcule le mot de passe.
 */
export async function resolvePassword(partial: {
  serialNumber?: string;
  clientCode?: string;
  ip?: string;
}): Promise<ResolveResponse> {
  const res = await fetch(`${API_URL}/api/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  const data = (await res.json()) as ResolveResponse | ApiError;
  if (!res.ok || 'error' in data) {
    throw new Error((data as ApiError).error ?? 'Erreur inconnue.');
  }
  return data;
}

/**
 * Demande la régénération du mot de passe d'un enregistrement (action
 * administrateur) : POST /api/records/:id/regenerate avec le code admin
 * en en-tête Authorization. Le backend incrémente la version du mot de
 * passe et renvoie l'enregistrement mis à jour avec le nouveau mot de passe.
 */
export async function regeneratePassword(
  recordId: number,
  adminToken: string,
): Promise<ResolveResponse> {
  const res = await fetch(`${API_URL}/api/records/${recordId}/regenerate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
  });
  const data = (await res.json()) as ResolveResponse | ApiError;
  if (!res.ok || 'error' in data) {
    throw new Error((data as ApiError).error ?? 'Erreur inconnue.');
  }
  return data;
}
