import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="app-surface grid min-h-screen place-items-center px-4 text-black">
      <section className="ui-panel w-full max-w-sm p-6 text-center">
        <h1 className="text-xl font-semibold">העמוד לא נמצא</h1>
        <p className="mt-2 text-sm text-black/60">ייתכן שהקישור שגוי או שהעמוד הוסר.</p>
        <Link href="/" className="mt-5 inline-flex min-h-10 items-center rounded-md bg-black px-5 text-sm font-semibold text-white">
          חזרה לאתר
        </Link>
      </section>
    </main>
  );
}
