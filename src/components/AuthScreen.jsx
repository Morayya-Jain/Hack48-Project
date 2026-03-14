import { useState } from 'react'
import {
  buttonPrimary,
  buttonSecondary,
  buttonTab,
  sizeLg,
  sizeSm,
} from '../lib/buttonStyles'

function AuthScreen({
  onSignIn,
  onSignUp,
  onResendConfirmation,
  isAuthenticating,
  authError,
  authInfo,
}) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (mode === 'login') {
      await onSignIn(email, password)
      return
    }

    await onSignUp(email, password)
  }

  const handleResendConfirmation = async () => {
    await onResendConfirmation(email)
  }

  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Coding Mentor</h1>
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('login')}
          disabled={isAuthenticating}
          className={`${mode === 'login' ? buttonPrimary : buttonTab} ${sizeSm}`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          disabled={isAuthenticating}
          className={`${mode === 'signup' ? buttonPrimary : buttonTab} ${sizeSm}`}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="border p-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            className="border p-2"
          />
        </label>

        <button
          type="submit"
          disabled={isAuthenticating}
          className={`${buttonPrimary} ${sizeLg}`}
        >
          {isAuthenticating
            ? 'Authenticating...'
            : mode === 'login'
              ? 'Log In'
              : 'Create Account'}
        </button>
        <button
          type="button"
          disabled={isAuthenticating || !email.trim()}
          className={`${buttonSecondary} ${sizeLg}`}
          onClick={handleResendConfirmation}
        >
          Resend confirmation email
        </button>
      </form>

      {authError && <p className="text-red-600 mt-3">{authError}</p>}
      {authInfo && <p className="text-green-700 mt-3">{authInfo}</p>}
    </main>
  )
}

export default AuthScreen
