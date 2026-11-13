export interface RouterRecord {
  id: number;
  serialNumber: string;
  clientCode: string;
  ip: string;
  createdAt: string;
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
