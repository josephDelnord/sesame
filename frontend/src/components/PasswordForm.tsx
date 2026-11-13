import { useState, type ChangeEvent, type FormEvent } from 'react';
import { resolvePassword } from '../api';

interface FieldState {
  serialNumber: string;
  clientCode: string;
  ip: string;
}

const EMPTY_FORM: FieldState = { serialNumber: '', clientCode: '', ip: '' };

export default function PasswordForm() {
  const [fields, setFields] = useState<FieldState>(EMPTY_FORM);
  const [password, setPassword] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const setField = (name: keyof FieldState) => (e: ChangeEvent<HTMLInputElement>) => {
    setFields((prev) => ({ ...prev, [name]: e.target.value }));
    setPassword(null);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPassword(null);
    setCopied(false);

    if (!fields.serialNumber && !fields.clientCode && !fields.ip) {
      setError('Renseignez au moins un champ avant de valider.');
      return;
    }

    setLoading(true);
    try {
      const { record, password: result } = await resolvePassword({
        serialNumber: fields.serialNumber || undefined,
        clientCode: fields.clientCode || undefined,
        ip: fields.ip || undefined,
      });
      // Complétion automatique des champs manquants depuis la base.
      setFields({
        serialNumber: record.serialNumber,
        clientCode: record.clientCode,
        ip: record.ip,
      });
      setPassword(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copie impossible : le mot de passe est masqué ?');
    }
  };

  const masked = '•'.repeat(12);

  return (
    <div className="card">
      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>Numéro de série (SN)</span>
          <input
            type="text"
            value={fields.serialNumber}
            onChange={setField('serialNumber')}
            placeholder="RTR-2024-000117"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Code client</span>
          <input
            type="text"
            value={fields.clientCode}
            onChange={setField('clientCode')}
            placeholder="CL-7F3A"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Adresse IP</span>
          <input
            type="text"
            value={fields.ip}
            onChange={setField('ip')}
            placeholder="192.168.10.24"
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Recherche…' : 'Valider'}
        </button>
      </form>

      {error && <p className="message error" role="alert">{error}</p>}

      {password && (
        <div className="result">
          <h2>Mot de passe recalculé</h2>
          <div className="password-row">
            <output className="password" aria-label="Mot de passe recalculé">
              {visible ? password : masked}
            </output>
            <div className="actions">
              <button type="button" onClick={() => setVisible((v) => !v)}>
                {visible ? 'Masquer' : 'Afficher'}
              </button>
              <button type="button" onClick={handleCopy}>
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
