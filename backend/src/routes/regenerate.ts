import { Router, type Request, type Response } from 'express';
import { getRecordById, regeneratePassword, passwordOf } from '../services/db.js';
import { isAdmin } from '../middleware/admin.js';

/**
 * Régénération du mot de passe d'un enregistrement (action administrateur) :
 * incrémente la version du mot de passe, ce qui en calcule un nouveau,
 * différent du précédent mais tout aussi recalculable.
 */
export const regenerateRouter = Router();

regenerateRouter.post(
  '/api/records/:id/regenerate',
  async (req: Request, res: Response) => {
    // Vérification asynchrone de l'admin (ADMIN_TOKEN vient de Vault)
    const isAdminUser = await isAdmin(req);
    if (!isAdminUser) {
      res.status(401).json({ error: 'Code administrateur invalide.' });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: 'Identifiant invalide.' });
      return;
    }

    if (!getRecordById(id)) {
      res.status(404).json({ error: 'Aucun enregistrement avec cet identifiant.' });
      return;
    }

    const record = regeneratePassword(id);
    if (!record) {
      res.status(500).json({ error: 'Échec de la régénération.' });
      return;
    }

    const password = passwordOf(record);
    console.log(
      `[admin] Régénération de ${record.serialNumber}/${record.clientCode} -> version ${record.passwordVersion}`,
    );
    res.json({ record, password });
  },
);

export default regenerateRouter;
