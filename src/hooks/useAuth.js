import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseInitError } from '../lib/supabaseClient'

const SESSION_LOAD_TIMEOUT_MS = 8000

async function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(timeoutMessage))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function getEmailRedirectTo() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return `${window.location.origin}/`
}

function formatAuthError(error) {
  const fallback = 'Authentication failed. Please try again.'

  if (!error?.message) {
    return fallback
  }

  const message = error.message
  if (message.toLowerCase().includes('email not confirmed')) {
    return 'Please confirm your email before logging in. Check your inbox and spam folder.'
  }

  return message
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [isAuthenticating, setIsAuthenticating] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [authInfo, setAuthInfo] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setAuthError(supabaseInitError?.message || 'Supabase is not configured.')
      setUser(null)
      setIsAuthenticating(false)
      return
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlError = params.get('error_description') || params.get('error')

      if (urlError) {
        setAuthError(decodeURIComponent(urlError.replace(/\+/g, ' ')))
      }
    }

    let isMounted = true

    const loadSession = async () => {
      setIsAuthenticating(true)
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_LOAD_TIMEOUT_MS,
          'Session check timed out. Please verify your Supabase connection.',
        )

        if (!isMounted) {
          return
        }

        if (error) {
          setAuthError(formatAuthError(error))
          setUser(null)
        } else {
          setUser(data.session?.user ?? null)
          setAuthError(null)
        }
      } catch (error) {
        if (isMounted) {
          setAuthError(formatAuthError(error))
        }
      } finally {
        if (isMounted) {
          setIsAuthenticating(false)
        }
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthError(null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email, password, fullName = '') => {
    if (!supabase) {
      const error = supabaseInitError || new Error('Supabase is not configured.')
      setAuthError(error.message)
      return { data: null, error }
    }

    setIsAuthenticating(true)
    setAuthError(null)
    setAuthInfo(null)

    try {
      const emailRedirectTo = getEmailRedirectTo()
      const trimmedFullName = String(fullName ?? '').trim()
      const signUpOptions = {}

      if (emailRedirectTo) {
        signUpOptions.emailRedirectTo = emailRedirectTo
      }

      if (trimmedFullName) {
        signUpOptions.data = { full_name: trimmedFullName }
      }

      const signUpPayload =
        Object.keys(signUpOptions).length > 0
          ? { email, password, options: signUpOptions }
          : { email, password }
      const { data, error } = await supabase.auth.signUp(signUpPayload)

      if (error) {
        setAuthError(formatAuthError(error))
        return { data: null, error }
      }

      if (!data.session) {
        setAuthInfo(
          'Sign up successful. Check your email for a confirmation link, then log in.',
        )
      }

      setUser(data.session?.user ?? null)
      return { data, error: null }
    } catch (error) {
      setAuthError(formatAuthError(error))
      return { data: null, error }
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      const error = supabaseInitError || new Error('Supabase is not configured.')
      setAuthError(error.message)
      return { data: null, error }
    }

    setIsAuthenticating(true)
    setAuthError(null)
    setAuthInfo(null)

    try {
      const redirectTo = getEmailRedirectTo()
      const signInPayload = redirectTo
        ? { provider: 'google', options: { redirectTo } }
        : { provider: 'google' }

      const { data, error } = await supabase.auth.signInWithOAuth(signInPayload)

      if (error) {
        setAuthError(formatAuthError(error))
        return { data: null, error }
      }

      return { data, error: null }
    } catch (error) {
      setAuthError(formatAuthError(error))
      return { data: null, error }
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) {
      const error = supabaseInitError || new Error('Supabase is not configured.')
      setAuthError(error.message)
      return { data: null, error }
    }

    setIsAuthenticating(true)
    setAuthError(null)
    setAuthInfo(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setAuthError(formatAuthError(error))
        return { data: null, error }
      }

      setUser(data.user ?? null)
      return { data, error: null }
    } catch (error) {
      setAuthError(formatAuthError(error))
      return { data: null, error }
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      const error = supabaseInitError || new Error('Supabase is not configured.')
      setAuthError(error.message)
      return { data: null, error }
    }

    setIsAuthenticating(true)
    setAuthError(null)
    setAuthInfo(null)

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setAuthError(formatAuthError(error))
        return { data: null, error }
      }

      setUser(null)
      return { data: true, error: null }
    } catch (error) {
      setAuthError(formatAuthError(error))
      return { data: null, error }
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const resendConfirmation = useCallback(async (email) => {
    if (!supabase) {
      const error = supabaseInitError || new Error('Supabase is not configured.')
      setAuthError(error.message)
      return { data: null, error }
    }

    setIsAuthenticating(true)
    setAuthError(null)
    setAuthInfo(null)

    try {
      const trimmedEmail = email?.trim()
      if (!trimmedEmail) {
        const error = new Error('Enter your email first to resend confirmation.')
        setAuthError(error.message)
        return { data: null, error }
      }

      const emailRedirectTo = getEmailRedirectTo()
      const resendPayload = emailRedirectTo
        ? { type: 'signup', email: trimmedEmail, options: { emailRedirectTo } }
        : { type: 'signup', email: trimmedEmail }

      const { data, error } = await supabase.auth.resend(resendPayload)

      if (error) {
        setAuthError(formatAuthError(error))
        return { data: null, error }
      }

      setAuthInfo(
        'If this account exists and is unconfirmed, a new confirmation email has been sent.',
      )
      return { data, error: null }
    } catch (error) {
      setAuthError(formatAuthError(error))
      return { data: null, error }
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  return {
    user,
    isAuthenticating,
    authError,
    authInfo,
    setAuthError,
    setAuthInfo,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resendConfirmation,
  }
}
