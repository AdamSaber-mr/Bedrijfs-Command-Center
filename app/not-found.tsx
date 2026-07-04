import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-[family-name:var(--font-display)] text-6xl font-bold text-accent-500/80">
        404
      </p>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-slate-900 dark:text-white">
        Deze pagina bestaat niet
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-400">
        Het adres klopt niet of de pagina is verplaatst.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-accent-950 transition hover:bg-accent-400"
      >
        Terug naar het dashboard
      </Link>
    </main>
  );
}
