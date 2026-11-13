import PasswordForm from './components/PasswordForm';

export default function App() {
  return (
    <main className="page">
      <header className="header">
        <h1>Biba — Recalcul de mot de passe client</h1>
        <p>
          Renseignez un ou plusieurs champs : le numéro de série, le code client et
          l'adresse IP sont complétés automatiquement depuis la base, puis le mot
          de passe est recalculé via la formule de hash du back-end.
        </p>
      </header>
      <PasswordForm />
    </main>
  );
}
