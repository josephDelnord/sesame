import { Router, type Request, type Response } from 'express';
import { listRecords, findRecord, createRecord } from '../services/db.js';
import { generatePassword, PASSWORD_LENGTH } from '../services/password.js';
import { readString } from '../utils/fields.js';

/**
 * Routes de gestion des enregistrements (côté CRM) :
 * - GET  /api/records : liste (sans les mots de passe, jamais stockés) ;
 * - POST /api/records : création, le mot de passe est généré ici
 *   (back-end) et renvoyé une seule fois.
 */
export const recordsRouter = Router();

recordsRouter.get('/api/records', (_req: Request, res: Response) => {
  res.json({ records: listRecords() });
});

recordsRouter.post('/api/records', (req: Request, res: Response) => {
  const serialNumber = readString(req.body?.serialNumber) ?? '';
  const clientCode = readString(req.body?.clientCode) ?? '';
  const ip = readString(req.body?.ip) ?? '';

  if (!serialNumber || !clientCode || !ip) {
    res.status(400).json({
      error: 'Champs requis : serialNumber, clientCode, ip.',
    });
    return;
  }

  const existing = findRecord({ serialNumber, clientCode, ip });
  if (existing) {
    res.status(409).json({ error: 'Un enregistrement avec ces données existe déjà.', record: existing });
    return;
  }

  const record = createRecord({ serialNumber, clientCode, ip });
  const password = generatePassword(record.serialNumber, record.clientCode, PASSWORD_LENGTH);
  res.status(201).json({ record, password });
});

export default recordsRouter;
