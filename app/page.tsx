// Intentionally minimal: the root page must not list or link to any team
// storefront (isolation requirement).
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-900">
      <main className="px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Urheilukauppa</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Official team merchandise.
        </p>
      </main>
    </div>
  );
}
