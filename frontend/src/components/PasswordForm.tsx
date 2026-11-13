import { useState, type ChangeEvent, type FormEvent } from 'react';
import { resolvePassword, regeneratePassword, type RouterRecord } from '../services/api';

interface FieldState {
  serialNumber: string;
  clientCode: string;
  ip: string;
}

const EMPTY_FORM: FieldState = { serialNumber: '', clientCode: '', ip: '' };

export default function PasswordForm() {
  const [fields, setFields] = useState<FieldState>(EMPTY_FORM);
  const [record, setRecord] = useState<RouterRecord | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);

  const setField = (name: keyof FieldState) => (e: ChangeEvent<HTMLInputElement>) => {
    setFields((prev) => ({ ...prev, [name]: e.target.value }));
    setPassword(null);
    setRecord(null);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPassword(null);
    setRecord(null);
    setCopied(false);
    setShowAdmin(false);

    if (!fields.serialNumber && !fields.clientCode && !fields.ip) {
      setError('Renseignez au moins un champ avant de valider.');
      return;
    }

    setLoading(true);
    try {
      const result = await resolvePassword({
        serialNumber: fields.serialNumber || undefined,
        clientCode: fields.clientCode || undefined,
        ip: fields.ip || undefined,
      });
      // Complétion automatique des champs manquants depuis la base.
      setFields({
        serialNumber: result.record.serialNumber,
        clientCode: result.record.clientCode,
        ip: result.record.ip,
      });
      setRecord(result.record);
      setPassword(result.password);
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

  /** Régénération administrateur : version +1 -> nouveau mot de passe. */
  const handleRegenerate = async () => {
    if (!record || !adminToken.trim()) {
      setError('Saisissez le code administrateur.');
      return;
    }
    setRegenLoading(true);
    setError(null);
    setCopied(false);
    try {
      const result = await regeneratePassword(record.id, adminToken.trim());
      setRecord(result.record);
      setPassword(result.password);
      setVisible(true);
      setShowAdmin(false);
      setAdminToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setRegenLoading(false);
    }
  };

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

      {password && record && (
        <div className="result">
          <h2>
            Mot de passe recalculé
            {record.passwordVersion > 0 && ` — version ${record.passwordVersion}`}
          </h2>
          <div className="password-row">
            <output className="password" aria-label="Mot de passe recalculé">
              {visible ? password : masked}
            </output>
            <div className="actions">
              <button type="button" onClick={() => setVisible((v) => !v)}>
                {visible ? 'Masquer' : 'Afficher'}
              </button>
              <button type="button" onClick={handleCopy} className={copied ? 'copied' : ''}>
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </div>

          <div className="regen">
            {showAdmin ? (
              <>
                <label className="field">
                  <span>Code administrateur</span>
                  <input
                    type="password"
                    value={adminToken}
                    onChange={(e) => setAdminToken(e.target.value)}
                    placeholder="Code admin"
                    autoComplete="off"
                  />
                </label>
                <div className="actions">
                  <button type="button" onClick={handleRegenerate} disabled={regenLoading}>
                    {regenLoading ? 'Régénération…' : 'Confirmer la régénération'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setShowAdmin(false);
                      setAdminToken('');
                    }}
                  >
                    Annuler
                  </button>
                </div>
                <p className="hint">
                  Un nouveau mot de passe sera calculé (version +1) ; l'ancien
                  ne sera plus valide côté routage.
                </p>
              </>
            ) : (
              <button type="button" className="secondary" onClick={() => setShowAdmin(true)}>
                Régénérer (admin)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
