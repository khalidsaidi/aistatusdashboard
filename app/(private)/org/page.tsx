export default function OrgPlaceholder() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto surface-card-strong p-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Organization settings</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
            This page is available to authenticated organizations.
          </p>
        </div>
      </div>
    </main>
  );
}
