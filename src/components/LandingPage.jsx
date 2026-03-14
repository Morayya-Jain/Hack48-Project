import { useCallback } from 'react'
import laptopImage from '../assets/landing-laptop.png'
import logo from '../assets/dojobuild-logo-riya.png'

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4 10h12m0 0-4-4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-green-600" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-green-600" fill="none" aria-hidden="true">
      <path
        d="M12 4v3m0 10v3M4 12h3m10 0h3M7.75 7.75l2.12 2.12m4.26 4.26 2.12 2.12m0-8.5-2.12 2.12m-4.26 4.26-2.12 2.12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-green-600" fill="none" aria-hidden="true">
      <path
        d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21V5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function LandingPage({ onGetStarted = () => {} }) {
  const scrollToFeatures = useCallback(() => {
    if (typeof document === 'undefined') {
      return
    }

    const section = document.getElementById('landing-features')
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 md:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="DojoBuild logo" className="h-8 w-8 rounded-md object-cover" />
            <p className="text-lg font-semibold text-slate-900 md:text-xl">DojoBuild</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onClick={scrollToFeatures}
            >
              Dashboard
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-green-700 bg-green-600 px-3 text-sm font-semibold text-white transition hover:border-green-600 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200"
              onClick={onGetStarted}
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 py-16 sm:px-6 md:px-8 md:py-24">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
          <svg
            width="1920"
            height="600"
            viewBox="0 0 1920 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="min-w-[1200px]"
          >
            <path
              d="M0 300C320 150 640 450 960 300C1280 150 1600 450 1920 300V600H0V300Z"
              fill="#86efac"
            />
            <path
              d="M0 350C320 200 640 500 960 350C1280 200 1600 500 1920 350V600H0V350Z"
              fill="#bbf7d0"
            />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Learn to Build with AI
          </h1>
          <p className="mt-4 text-lg text-slate-600 sm:text-xl md:text-2xl">
            Your mentor, not your engineer.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-green-700 bg-green-600 px-5 text-sm font-semibold text-white transition hover:border-green-600 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200"
              onClick={onGetStarted}
            >
              Start Your Dojo
              <ArrowRightIcon />
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onClick={scrollToFeatures}
            >
              See How It Works
            </button>
          </div>

          <div className="mx-auto mt-10 w-full max-w-4xl md:mt-14">
            <img
              src={laptopImage}
              alt="DojoBuild platform interface"
              className="w-full drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section id="landing-features" className="border-y border-slate-200 bg-slate-50 px-4 py-16 sm:px-6 md:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Why DojoBuild</h2>
            <p className="mx-auto mt-4 max-w-3xl text-base text-slate-600 md:text-xl">
              Most AI tools build for you. DojoBuild teaches you how to build step-by-step.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:mt-14 md:grid-cols-3 md:gap-7">
            <article className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
                <TargetIcon />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900">Guided Challenges</h3>
              <p className="mt-3 text-slate-600">Break complex projects into buildable steps.</p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
                <SparklesIcon />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900">Socratic Coaching</h3>
              <p className="mt-3 text-slate-600">AI gives hints and questions instead of answers.</p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
                <BookIcon />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-900">Learn by Building</h3>
              <p className="mt-3 text-slate-600">Real projects with real understanding.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 text-center sm:px-6 md:px-8 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Ready to start building?</h2>
          <p className="mt-4 text-lg text-slate-600 md:text-xl">
            Join DojoBuild and learn to create real projects with AI as your guide.
          </p>
          <button
            type="button"
            className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-green-700 bg-green-600 px-5 text-sm font-semibold text-white transition hover:border-green-600 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200"
            onClick={onGetStarted}
          >
            Get Started
            <ArrowRightIcon />
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500 sm:px-6 md:px-8 md:text-sm">
        <p>© 2026 DojoBuild. Build real skills, not just generated code.</p>
      </footer>
    </main>
  )
}

export default LandingPage
