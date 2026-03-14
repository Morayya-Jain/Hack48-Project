function ConfigureDojoLoadingScreen() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8"
    >
      <section className="mx-auto w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-100 p-6">
            <svg
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-16 w-16 animate-spin text-emerald-500 md:h-20 md:w-20"
              style={{ animationDuration: '3s' }}
            >
              <circle cx="32" cy="32" r="11" />
              <circle cx="32" cy="32" r="3" fill="currentColor" stroke="none" />
              <line x1="32" y1="6" x2="32" y2="14" />
              <line x1="32" y1="50" x2="32" y2="58" />
              <line x1="6" y1="32" x2="14" y2="32" />
              <line x1="50" y1="32" x2="58" y2="32" />
              <line x1="13.5" y1="13.5" x2="19.5" y2="19.5" />
              <line x1="44.5" y1="44.5" x2="50.5" y2="50.5" />
              <line x1="13.5" y1="50.5" x2="19.5" y2="44.5" />
              <line x1="44.5" y1="19.5" x2="50.5" y2="13.5" />
            </svg>
          </div>
        </div>

        <div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900 md:text-4xl">
            Let's Configure Your Dojo.
          </h1>
          <p className="text-sm text-slate-500 md:text-base">
            This will help us setup your default settings.
          </p>
          <p className="text-sm text-slate-500 md:text-base">You can change this anytime.</p>
        </div>
      </section>
    </main>
  )
}

export default ConfigureDojoLoadingScreen
