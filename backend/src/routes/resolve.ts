import { Router, type Request, type Response } from 'express';
import { findRecord, upsertRecord, passwordOf } from '../services/db.js';
import { searchCrm, CrmError } from '../services/crm.js';
import { readString } from '../utils/fields.js';

/**
 * Recalcul du mot de passe à partir de données partielles.
 * Les champs manquants sont complétés depuis la base — ou depuis le CRM
 * de l'entreprise si le connecteur est configuré — avant recalcul.
 */
export const resolveRouter = Router();

resolveRouter.post('/api/resolve', async (req: Request, res: Response) => {
  const partial = {
    serialNumber: readString(req.body?.serialNumber),
    clientCode: readString(req.body?.clientCode),
    ip: readString(req.body?.ip),
  };

  if (!partial.serialNumber && !partial.clientCode && !partial.ip) {
    res.status(400).json({
      error: 'Renseignez au moins un champ : numéro de série, code client ou adresse IP.',
    });
    return;
  }

  let record;
  try {
    record = findRecord(partial);
  } catch {
    res.status(409).json({
      error: 'Plusieurs enregistrements correspondent à ces informations.',
    });
    return;
  }

  // Base locale infructueuse : interrogation du CRM de l'entreprise
  // (connecteur désactivé si CRM_API_URL n'est pas défini).
  if (!record) {
    try {
      const crmRecord = await searchCrm(partial);
      if (crmRecord) {
        record = upsertRecord(crmRecord).record;
      }
    } catch (err) {
      const error =
        err instanceof CrmError
          ? err.message
          : 'Erreur lors de la consultation du CRM.';
      res.status(502).json({ error });
      return;
    }
  }

  if (!record) {
    res.status(404).json({
      error: 'Aucun enregistrement trouvé avec les informations fournies.',
    });
    return;
  }

  const password = passwordOf(record);
  res.json({ record, password });
});

export default resolveRouter;
