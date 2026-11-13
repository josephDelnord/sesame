import PasswordForm from './components/PasswordForm';

export default function App() {
  return (
    <main className="page">
      <header className="header">
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
