/** The old app's address, for screens that haven't moved to Next.js yet. */
const OLD_APP_URL = process.env.NEXT_PUBLIC_OLD_APP_URL ?? 'http://localhost:5173';

/** A placeholder for a screen that moves here in a later PR. */
export function MovingSoon({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">
        This screen is moving to the new Next.js app. Until it does, use it in the current app.
      </p>
      <a
        href={OLD_APP_URL}
        className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Open the current app
      </a>
    </section>
  );
}
