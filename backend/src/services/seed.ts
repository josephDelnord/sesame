import { createRecord, isEmpty } from './db.js';
import { generatePassword } from './password.js';

/**
 * Amorçage de la base : simule le back-end CRM de la VM 1 qui, à la création
 * de chaque client, enregistre l'équipement (SN, code client, IP) et génère
 * le mot de passe via la formule de hash.
 *
 * Les mots de passe générés sont affichés une fois au démarrage ; en
 * production ils seraient transmis au client, jamais stockés en clair.
 */
const SAMPLES = [
  { serialNumber: 'RTR-2024-000117', clientCode: 'CL-7F3A', ip: '192.168.10.24' },
  { serialNumber: 'RTR-2024-000218', clientCode: 'CL-9B2C', ip: '192.168.10.31' },
  { serialNumber: 'RTR-2024-000329', clientCode: 'CL-4D8E', ip: '10.0.44.7' },
  { serialNumber: 'RTR-2025-000414', clientCode: 'CL-1A6F', ip: '10.0.44.12' },
];

export function seedIfEmpty(): void {
  if (!isEmpty()) return;

  for (const sample of SAMPLES) {
    const record = createRecord(sample);
    const password = generatePassword(record.serialNumber, record.clientCode);
    console.log(
      `[seed] ${record.serialNumber} / ${record.clientCode} / ${record.ip} -> mot de passe : ${password}`,
    );
  }
}
