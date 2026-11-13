import { useState } from 'react';
import PasswordForm from './components/PasswordForm';

type Theme = 'light' | 'dark';

/** Thème courant appliqué au <html> (défini avant le rendu par index.html). */
function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/** Bascule le thème avec une transition douce couleurs (≤300ms) et le mémorise. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  root.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem('sesame-theme', theme);
  } catch {
    /* stockage indisponible : le thème reste appliqué pour la session */
  }
  window.setTimeout(() => root.classList.remove('theme-transition'), 320);
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const label = theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre';
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      {theme === 'dark' ? (
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <main className="page">
      <header className="header">
        <div className="header-row">
          <div className="brand">
            <span className="logo" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="7.5" cy="12" r="4.25" />
                <path d="M11.75 12H21M16.5 12v4M20 12v2.6" />
              </svg>
            </span>
            <h1>Sésame</h1>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <p className="tagline">
          Saisissez un numéro de série, un code client ou une IP : les champs
          manquants se complètent depuis la base et le mot de passe est
          recalculé.
        </p>
      </header>
      <PasswordForm />
      <footer className="footer">Sésame — mots de passe recalculés, jamais stockés.</footer>
    </main>
  );
}
