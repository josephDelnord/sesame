import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { initDb, listRecords, findRecord, createRecord, passwordOf } from './db.js';
import { seedIfEmpty } from './seed.js';
import { generatePassword, meetsCriteria, PASSWORD_LENGTH } from './password.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

interface ResolveInput {
  serialNumber?: unknown;
  clientCode?: unknown;
  ip?: unknown;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/** Liste des enregistrements (sans les mots de passe, jamais stockés). */
app.get('/api/records', (_req: Request, res: Response) => {
  res.json({ records: listRecords() });
});

/**
 * Création d'un enregistrement côté CRM.
 * Le mot de passe est généré ici (back-end) et renvoyé une seule fois.
 */
app.post('/api/records', (req: Request, res: Response) => {
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

/**
 * Recalcul du mot de passe à partir de données partielles.
 * Les champs manquants sont complétés depuis la base avant recalcul.
 */
app.post('/api/resolve', (req: Request, res: Response) => {
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

  if (!record) {
    res.status(404).json({
      error: 'Aucun enregistrement trouvé avec les informations fournies.',
    });
    return;
  }

  const password = passwordOf(record);
  res.json({ record, password });
});

app.listen(PORT, () => {
  initDb();
  seedIfEmpty();
  console.log(`Backend Sésame en écoute sur http://localhost:${PORT}`);
});
