import express from 'express';
import cors from 'cors';
import { initDb } from './services/db.js';
import { seedIfEmpty } from './services/seed.js';
import recordsRouter from './routes/records.js';
import resolveRouter from './routes/resolve.js';
import regenerateRouter from './routes/regenerate.js';

/**
 * Point d'entrée du backend Sésame : création du serveur Express,
 * montage des routeurs et amorçage de la base au démarrage.
 */
const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(recordsRouter);
app.use(resolveRouter);
app.use(regenerateRouter);

app.listen(PORT, () => {
  initDb();
  seedIfEmpty();
  console.log(`Backend Sésame en écoute sur http://localhost:${PORT}`);
});
