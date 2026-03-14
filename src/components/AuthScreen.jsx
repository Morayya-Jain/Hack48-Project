import { useState } from 'react'
import logo from '../assets/dojobuild-logo.png'

function AuthScreen({
  onSignIn,
  onSignUp,
  onContinueWithGoogle,
  onResendConfirmation,
  initialMode = 'login',
  onBackToLanding = null,
  isAuthenticating,
  authError,
  authInfo,
}) {
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [resendEligibleEmail, setResendEligibleEmail] = useState('')
  const isLoginMode = mode === 'login'
  const trimmedEmail = email.trim()
  const canShowResendConfirmation =
    !isLoginMode &&
    Boolean(resendEligibleEmail) &&
    resendEligibleEmail.toLowerCase() === trimmedEmail.toLowerCase()

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isLoginMode) {
      await onSignIn(email, password)
      return
    }

    setResendEligibleEmail(trimmedEmail)
    await onSignUp(email, password, fullName)
  }

  const handleResendConfirmation = async () => {
    await onResendConfirmation(email)
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-6xl">
        <section className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-xl lg:grid lg:min-h-[774px] lg:grid-cols-2">
          <div className="flex flex-col items-center justify-center gap-8 border-b border-slate-200 bg-white px-6 py-12 text-center sm:px-10 lg:border-b-0 lg:border-r lg:py-16">
            <img
              src={logo}
              alt="DojoBuild logo"
              className="h-20 w-20 rounded-2xl border border-green-200 bg-white p-3 shadow-sm"
            />
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">DojoBuild</h1>
              <p className="mt-3 text-lg text-slate-700">
                Your AI dojo for learning how to build.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center bg-white px-4 py-8 sm:px-6 lg:h-full lg:px-10">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <header className="text-center">
                {onBackToLanding ? (
                  <div className="mb-4 text-left">
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900"
                      onClick={onBackToLanding}
                      disabled={isAuthenticating}
                    >
                      Back to home
                    </button>
                  </div>
                ) : null}
                <h2 className="text-3xl font-bold text-slate-900">
                  {isLoginMode ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {isLoginMode
                    ? 'Continue your learning journey'
                    : 'Start your learning journey today'}
                </p>
              </header>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                {!isLoginMode ? (
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    Full name
                    <input
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      autoComplete="name"
                      required
                      className="h-12 rounded-xl border border-slate-300 px-3 text-base outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                      placeholder="Enter your full name"
                    />
                  </label>
                ) : null}

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="h-12 rounded-xl border border-slate-300 px-3 text-base outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    placeholder="you@example.com"
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    className="h-12 rounded-xl border border-slate-300 px-3 text-base outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    placeholder="••••••••"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="mt-1 h-12 rounded-xl border border-green-700 bg-green-600 px-4 text-base font-semibold text-white transition hover:border-green-600 hover:bg-green-500 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
                >
                  {isAuthenticating
                    ? 'Authenticating...'
                    : isLoginMode
                      ? 'Log In'
                      : 'Sign Up'}
                </button>

                {canShowResendConfirmation ? (
                  <button
                    type="button"
                    disabled={isAuthenticating}
                    className="self-center text-sm font-medium text-green-700 underline decoration-green-300 underline-offset-4 transition hover:text-green-800 disabled:cursor-not-allowed disabled:text-slate-400"
                    onClick={handleResendConfirmation}
                  >
                    Resend confirmation email
                  </button>
                ) : null}
              </form>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Or continue with
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={isAuthenticating}
                onClick={onContinueWithGoogle}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-800 transition hover:border-green-300 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="#FFC107"
                    d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.239 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.955 3.045l5.657-5.657C34.046 6.053 29.27 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917Z"
                  />
                  <path
                    fill="#FF3D00"
                    d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.955 3.045l5.657-5.657C34.046 6.053 29.27 4 24 4 16.318 4 9.656 8.337 6.306 14.691Z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.219 0-9.623-3.329-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.611 20.083H42V20H24v8h11.303c-.881 2.346-2.536 4.309-4.784 5.57l6.19 5.238C40.271 35.205 44 30 44 24c0-1.341-.138-2.65-.389-3.917Z"
                  />
                </svg>
                Continue with Google
              </button>

              <p className="mt-6 text-center text-sm text-slate-600">
                {isLoginMode ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={() => setMode(isLoginMode ? 'signup' : 'login')}
                  className="font-semibold text-green-700 underline decoration-green-300 underline-offset-4 transition hover:text-green-800 disabled:text-slate-400"
                >
                  {isLoginMode ? 'Sign up' : 'Log in'}
                </button>
              </p>

              {authError ? <p className="mt-4 text-sm text-red-600">{authError}</p> : null}
              {authInfo ? <p className="mt-4 text-sm text-green-700">{authInfo}</p> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default AuthScreen
