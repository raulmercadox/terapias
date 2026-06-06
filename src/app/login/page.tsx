import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-2xl font-bold text-white">
            BG
          </div>
          <h1 className="text-xl font-semibold text-slate-900">B-Genius</h1>
          <p className="text-sm text-slate-500">Sistema de Terapias — Aula Azul</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Centro Psicopedagógico B-Genius
        </p>
      </div>
    </main>
  );
}
