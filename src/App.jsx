import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import CenterPaneTabs from './components/CenterPaneTabs'
import CompletionScreen from './components/CompletionScreen'
import ConfigureDojoLoadingScreen from './components/ConfigureDojoLoadingScreen'
import Dashboard from './components/Dashboard'
import Editor from './components/Editor'
import ErrorBoundary from './components/ErrorBoundary'
import FeedbackPanel from './components/FeedbackPanel'
import PreviewPanel from './components/PreviewPanel'
import FileTree from './components/FileTree'
import HintBox from './components/HintBox'
import LandingPage from './components/LandingPage'
import Onboarding from './components/Onboarding'
import ProfileOnboarding from './components/ProfileOnboarding'
import ProgressBar from './components/ProgressBar'
import Roadmap from './components/Roadmap'
import RunConsole from './components/RunConsole'
import workspaceLogo from './assets/workspace-logo.png'
import { useAppState } from './hooks/useAppState'
import { useAuth } from './hooks/useAuth'
import { useGemini } from './hooks/useGemini'
import { useWorkspacePaneLayout } from './hooks/useWorkspacePaneLayout'
import {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  sizeSm,
} from './lib/buttonStyles'
import {
  createProject,
  createProjectFiles,
  deleteProject as deleteProjectInDb,
  deleteProjectFile,
  getUserProfile,
  markProjectIncomplete,
  getProjectFiles,
  getProjectTasks,
  getUserProjects,
  markProjectComplete,
  markTaskComplete as markTaskCompleteInDb,
  markTaskIncomplete as markTaskIncompleteInDb,
  replaceProjectFiles,
  replaceProjectTasks,
  saveTasks,
  updateProjectTitle,
  upsertUserProfile,
  upsertProjectFile,
} from './lib/db'
import { detectLanguage } from './lib/detectLanguage'
import {
  isProfileComplete,
  normalizeProfile,
  profileToPromptContext,
} from './lib/profile'
import {
  ZIP_IMPORT_LIMITS,
  buildPreviewSrcDoc,
  createStarterFileForLanguage,
  createDefaultProjectFiles,
  editorLanguageFromFile,
  fileNameFromPath,
  findFirstFileByLanguage,
  getAllowedExtensions,
  isFileAllowedByLanguageLock,
  normalizeProjectFiles,
  runtimeLanguageFromFile,
  runtimeLanguageFromPath,
  sanitizeFilePath,
  toPersistedFiles,
  validateZipImportFileDescriptors,
} from './lib/projectFiles'
import {
  buildProjectTitleFallback,
  getProjectDisplayTitle,
  sanitizeProjectTitle,
} from './lib/projectTitle'
import {
  hasRoadmapRepairAttempted,
  markRoadmapRepairAttempted,
  shouldAutoRepairRoadmapTasks,
} from './lib/roadmapQuality'
import { prettyLanguageName, sanitizeLanguage } from './lib/runtimeUtils'
import {
  classifyProjectFilesError,
  PROJECT_FILES_ERROR_KIND,
} from './lib/supabaseErrors'

function toText(value) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value == null) {
    return ''
  }

  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timerId = null
  const timeoutPromise = new Promise((_, reject) => {
    timerId = window.setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timerId !== null) {
      window.clearTimeout(timerId)
    }
  })
}

function normalizeTask(task) {
  return {
    id: task.id,
    title: toText(task.title),
    description: toText(task.description),
    hint: toText(task.hint),
    exampleOutput: toText(task.example_output ?? task.exampleOutput ?? ''),
    language: sanitizeLanguage(task.language),
    completed: Boolean(task.completed),
    task_index: typeof task.task_index === 'number' ? task.task_index : 0,
  }
}

function getUtf8ByteLength(value) {
  const text = toText(value)
  if (!text) {
    return 0
  }

  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length
  }

  return text.length
}

function normalizeProjectSkillLevel(value) {
  const normalized = toText(value).trim().toLowerCase()
  if (
    normalized === 'beginner' ||
    normalized === 'intermediate' ||
    normalized === 'advanced' ||
    normalized === 'master'
  ) {
    return normalized
  }

  return 'intermediate'
}

function normalizeSelectedSkillLevel(value) {
  const normalized = toText(value).trim().toLowerCase()
  if (
    normalized === 'beginner' ||
    normalized === 'intermediate' ||
    normalized === 'advanced' ||
    normalized === 'master'
  ) {
    return normalized
  }

  return ''
}

function buildRoadmapRepairClarifyingAnswers(skillLevel) {
  return {
    skillLevelPreference: normalizeProjectSkillLevel(skillLevel),
    experience: 'Existing project; refresh roadmap quality.',
    scope: 'Keep this project focused on a specific MVP path.',
    time: 'Moderate pace.',
  }
}

function hasStoredProjectTitle(project) {
  return toText(project?.title).trim().length > 0
}

function isProfilesTableMissing(error) {
  const message = error?.message || ''
  return /profiles|schema cache|relation .*profiles|Could not find the 'profiles'|does not exist/i.test(
    message,
  )
}

function getProjectFilesStorageWarning(kind) {
  if (kind === PROJECT_FILES_ERROR_KIND.MISSING_TABLE) {
    return 'Supabase project file storage table is missing. Run supabase db push (or SQL migrations in supabase/migrations) and refresh. Files are saved in this browser session only.'
  }

  return 'Supabase project file storage schema is outdated. Run latest migrations with supabase db push (or execute files in supabase/migrations) and refresh. Files are saved in this browser session only.'
}

function getProjectFilesPermissionMessage() {
  return 'Supabase denied access to project file storage. Check your login and verify the project_files RLS policy uses auth.uid() = user_id.'
}

const SIGNUP_CONFIGURE_MIN_DURATION_MS = 3000

function parseHashWorkspaceState() {
  const fallback = {
    screen: 'dashboard',
    projectId: '',
    taskIndex: null,
    filePath: '',
  }

  if (typeof window === 'undefined') {
    return fallback
  }

  const rawHash = window.location.hash || ''
  const normalizedHash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash
  const [rawPath = '', rawQuery = ''] = normalizedHash.split('?')
  const path = rawPath.replace(/^\/+/, '').trim()

  const params = new URLSearchParams(rawQuery)
  const rawTaskIndex = Number.parseInt(params.get('task') || '', 10)
  const taskIndex =
    Number.isInteger(rawTaskIndex) && rawTaskIndex >= 0 ? rawTaskIndex : null
  const filePath = params.get('file') || ''

  if (!path || path === 'dashboard') {
    return fallback
  }

  if (path === 'new-project') {
    return {
      ...fallback,
      screen: 'new-project',
    }
  }

  if (path === 'profile' || path === 'profile-onboarding') {
    return {
      ...fallback,
      screen: 'profile-onboarding',
    }
  }

  const projectMatch = path.match(/^project\/([^/]+)\/(workspace|completion)$/)
  if (!projectMatch) {
    return fallback
  }

  let projectId = ''
  try {
    projectId = decodeURIComponent(projectMatch[1] || '')
  } catch {
    projectId = projectMatch[1] || ''
  }

  return {
    screen: projectMatch[2],
    projectId,
    taskIndex,
    filePath,
  }
}

function buildHashFromWorkspaceState({
  screen,
  currentProjectId,
  currentTaskIndex,
  activeFilePath = '',
}) {
  if (screen === 'workspace' && currentProjectId) {
    const params = new URLSearchParams()
    if (Number.isInteger(currentTaskIndex) && currentTaskIndex >= 0) {
      params.set('task', String(currentTaskIndex))
    }
    if (activeFilePath) {
      params.set('file', activeFilePath)
    }

    const base = `/project/${encodeURIComponent(currentProjectId)}/workspace`
    const query = params.toString()
    return query ? `#${base}?${query}` : `#${base}`
  }

  if (screen === 'completion' && currentProjectId) {
    return `#/project/${encodeURIComponent(currentProjectId)}/completion`
  }

  if (screen === 'new-project') {
    return '#/new-project'
  }

  if (screen === 'profile-onboarding') {
    return '#/profile-onboarding'
  }

  return '#/dashboard'
}

function buildNavigationIdentity(screen, currentProjectId) {
  if ((screen === 'workspace' || screen === 'completion') && currentProjectId) {
    return `${screen}:${currentProjectId}`
  }

  if (screen === 'new-project' || screen === 'profile-onboarding') {
    return screen
  }

  return 'dashboard'
}

function replaceHashUrl(nextHash) {
  if (typeof window === 'undefined') {
    return
  }

  if (window.location.hash === nextHash) {
    return
  }

  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`
  window.history.replaceState(window.history.state, '', nextUrl)
}

function App() {
  const {
    user,
    isAuthenticating,
    authError,
    authInfo,
    setAuthError,
    signIn,
    signInWithGoogle,
    signOut,
    signUp,
    resendConfirmation,
  } = useAuth()

  const {
    generateRoadmap,
    generateProjectTitle,
    suggestProjectLanguages,
    checkUserCode,
    askFollowUp,
    suggestFollowUpQuestions,
  } = useGemini()

  const {
    user: appUser,
    profile,
    currentProjectId,
    projectDescription,
    skillLevel,
    tasks,
    currentTaskIndex,
    userCode,
    projectFiles,
    activeFileId,
    feedbackHistory,
    hintsUsed,
    exampleViewed,
    isGeneratingRoadmap,
    isCheckingCode,
    isAskingFollowUp,
    isLoadingProjects,
    isLoadingProfile,
    isSavingProfile,
    isAuthenticating: isAuthenticatingState,
    isSavingFiles,
    fileError,
    isImporting,
    isExporting,
    projectLanguages,
    setUser,
    setProfile,
    setCurrentProjectId,
    setProjectDescription,
    setSkillLevel,
    setTasks,
    setCurrentTaskIndex,
    updateUserCode,
    setProjectFiles,
    setActiveFileId,
    markTaskComplete,
    markTaskIncomplete,
    incrementHints,
    setExampleViewed,
    resetTaskSupportState,
    resetApp,
    setIsGeneratingRoadmap,
    setIsCheckingCode,
    setIsAskingFollowUp,
    setIsLoadingProjects,
    setIsLoadingProfile,
    setIsSavingProfile,
    setIsAuthenticating,
    setIsSavingFiles,
    setFileError,
    setIsImporting,
    setIsExporting,
    setFeedbackHistory,
    setProjectLanguages,
  } = useAppState()

  const [projects, setProjects] = useState([])
  const [screen, setScreen] = useState('dashboard')
  const [preAuthScreen, setPreAuthScreen] = useState('landing')
  const [authInitialMode, setAuthInitialMode] = useState('login')
  const [uiError, setUiError] = useState('')
  const [feedbackError, setFeedbackError] = useState('')
  const [previewSrcDoc, setPreviewSrcDoc] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [fileNotice, setFileNotice] = useState('')
  const [projectFilesStorageMode, setProjectFilesStorageMode] = useState('supabase')
  const [projectFilesStorageWarning, setProjectFilesStorageWarning] = useState('')
  const [isCheckingBeforeComplete, setIsCheckingBeforeComplete] = useState(false)
  const [isMarkingTaskComplete, setIsMarkingTaskComplete] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState(null)
  const [currentProjectTitle, setCurrentProjectTitle] = useState('')
  const [isBackfillingProjectTitles, setIsBackfillingProjectTitles] = useState(false)
  const [projectTitleStatusMessage, setProjectTitleStatusMessage] = useState('')
  const [followUpSuggestions, setFollowUpSuggestions] = useState([])
  const [isGeneratingFollowUpSuggestions, setIsGeneratingFollowUpSuggestions] =
    useState(false)
  const [followUpSuggestionsNotice, setFollowUpSuggestionsNotice] = useState('')
  const [isTaskCardExpanded, setIsTaskCardExpanded] = useState(false)
  const [hasInitializedSession, setHasInitializedSession] = useState(false)
  const [isShowingSignupConfigureLoader, setIsShowingSignupConfigureLoader] =
    useState(false)
  const lastCheckSignatureRef = useRef('')
  const lastCheckResultRef = useRef(null)
  const lastCheckSuggestionsRef = useRef([])
  const lastCheckSuggestionsNoticeRef = useRef('')
  const currentSessionHistoryRef = useRef([])
  const saveTimeoutRef = useRef(null)
  const fileNoticeTimeoutRef = useRef(null)
  const lastSavedFileContentRef = useRef({})
  const isBackfillingProjectTitlesRef = useRef(false)
  const hasAttemptedHashRestoreRef = useRef(false)
  const isHashRestoreInProgressRef = useRef(false)
  const lastNavigationIdentityRef = useRef('')
  const hashRestoreNonceRef = useRef(0)
  const importInputRef = useRef(null)
  const roadmapWatchdogTimeoutRef = useRef(null)
  const isSignupTransitionPendingRef = useRef(false)
  const signupConfigureLoaderStartedAtRef = useRef(0)
  const lastInitializedUserIdRef = useRef(null)
  const currentTaskIdRef = useRef(null)
  const {
    workspaceRef,
    centerPaneRef,
    isDesktopLayout,
    leftWidthPct,
    rightWidthPct,
    leftCollapsed,
    rightCollapsed,
    editorHeightPx,
    bottomPaneCollapsed,
    activeDragType,
    railWidthPx,
    splitterSizePx,
    beginLeftResize,
    beginRightResize,
    beginCenterResize,
    beginCenterBottomResize,
    toggleLeftCollapsed,
    toggleRightCollapsed,
    toggleBottomPaneCollapsed,
  } = useWorkspacePaneLayout()

  const showTimedFileNotice = useCallback((message, timeoutMs = 3500) => {
    setFileNotice(message)

    if (fileNoticeTimeoutRef.current) {
      clearTimeout(fileNoticeTimeoutRef.current)
    }

    if (timeoutMs > 0) {
      fileNoticeTimeoutRef.current = window.setTimeout(() => {
        setFileNotice('')
      }, timeoutMs)
    }
  }, [])

  useEffect(() => {
    setUser(user)
  }, [setUser, user])

  useEffect(() => {
    setIsAuthenticating(isAuthenticating)
  }, [isAuthenticating, setIsAuthenticating])

  useEffect(
    () => () => {
      if (fileNoticeTimeoutRef.current) {
        clearTimeout(fileNoticeTimeoutRef.current)
      }
      if (roadmapWatchdogTimeoutRef.current) {
        clearTimeout(roadmapWatchdogTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!isGeneratingRoadmap) {
      if (roadmapWatchdogTimeoutRef.current) {
        clearTimeout(roadmapWatchdogTimeoutRef.current)
        roadmapWatchdogTimeoutRef.current = null
      }
      return
    }

    if (roadmapWatchdogTimeoutRef.current) {
      clearTimeout(roadmapWatchdogTimeoutRef.current)
    }

    roadmapWatchdogTimeoutRef.current = window.setTimeout(() => {
      setIsGeneratingRoadmap(false)
      if (screen === 'new-project') {
        setUiError('Roadmap generation got stuck and was stopped. Please try again.')
      }
    }, 95000)
  }, [isGeneratingRoadmap, screen, setIsGeneratingRoadmap])

  useEffect(() => {
    if (feedbackHistory.length === 0) {
      setFollowUpSuggestions([])
      setFollowUpSuggestionsNotice('')
      setIsGeneratingFollowUpSuggestions(false)
    }
  }, [feedbackHistory.length])

  const showFileLanguageNotice = useCallback((path, language) => {
    const normalizedLanguage = sanitizeLanguage(language)
    if (!normalizedLanguage) {
      return
    }

    showTimedFileNotice(
      `Detected ${prettyLanguageName(normalizedLanguage)} from extension for "${path}".`,
    )
  }, [showTimedFileNotice])

  const showImportLanguageNotice = useCallback((files = []) => {
    const detectedLanguages = Array.from(
      new Set(
        files
          .map((file) => runtimeLanguageFromPath(file?.path || file?.name || ''))
          .map((language) => sanitizeLanguage(language))
          .filter(Boolean),
      ),
    )

    if (detectedLanguages.length === 0) {
      return
    }

    const labels = detectedLanguages.map((language) => prettyLanguageName(language)).join(', ')
    const languageWord = detectedLanguages.length === 1 ? 'language' : 'languages'
    const fileWord = files.length === 1 ? 'file' : 'files'

    showTimedFileNotice(
      `Imported ${files.length} ${fileWord}. Detected ${languageWord}: ${labels}.`,
    )
  }, [showTimedFileNotice])

  const backfillProjectTitles = useCallback(
    async (projectsToBackfill, userId) => {
      if (!userId || isBackfillingProjectTitlesRef.current) {
        return
      }

      const untitledProjects = (projectsToBackfill || []).filter(
        (project) => project?.id && !hasStoredProjectTitle(project),
      )

      if (untitledProjects.length === 0) {
        setProjectTitleStatusMessage('')
        return
      }

      isBackfillingProjectTitlesRef.current = true
      setIsBackfillingProjectTitles(true)
      setProjectTitleStatusMessage('')

      let failedCount = 0

      try {
        for (const project of untitledProjects) {
          const fallbackTitle = buildProjectTitleFallback(project?.description)
          let nextTitle = fallbackTitle

          try {
            const titleResult = await generateProjectTitle(
              project?.description || '',
              normalizeProjectSkillLevel(project?.skill_level),
            )

            if (titleResult.error) {
              console.error(titleResult.error)
            } else {
              nextTitle = sanitizeProjectTitle(titleResult.data, project?.description)
            }
          } catch (error) {
            console.error(error)
          }

          const { data, error } = await updateProjectTitle(project.id, userId, nextTitle)
          if (error) {
            console.error(error)
            failedCount += 1
            continue
          }

          const persistedTitle = sanitizeProjectTitle(
            data?.title || nextTitle,
            project?.description,
          )

          setProjects((prev) =>
            prev.map((item) =>
              item.id === project.id
                ? { ...item, title: persistedTitle }
                : item,
            ),
          )

          if (currentProjectId === project.id) {
            setCurrentProjectTitle(persistedTitle)
          }
        }
      } finally {
        isBackfillingProjectTitlesRef.current = false
        setIsBackfillingProjectTitles(false)
      }

      if (failedCount > 0) {
        setProjectTitleStatusMessage('Some project titles could not be saved right now.')
        return
      }

      setProjectTitleStatusMessage('')
    },
    [currentProjectId, generateProjectTitle],
  )

  const loadProjects = useCallback(
    async (userId) => {
      setIsLoadingProjects(true)
      setProjectTitleStatusMessage('')

      const { data, error } = await getUserProjects(userId)

      if (error) {
        console.error(error)
        setUiError(error.message || 'Could not load projects.')
        setIsLoadingProjects(false)
        return { data: [], error }
      }

      const safeProjects = data ?? []
      setProjects(safeProjects)
      if (currentProjectId) {
        const activeProject = safeProjects.find((project) => project.id === currentProjectId)
        if (activeProject) {
          setCurrentProjectTitle(getProjectDisplayTitle(activeProject))
        }
      }
      setIsLoadingProjects(false)

      void backfillProjectTitles(safeProjects, userId)
      return { data: safeProjects, error: null }
    },
    [backfillProjectTitles, currentProjectId, setIsLoadingProjects],
  )

  const loadProfile = useCallback(
    async (userId) => {
      setIsLoadingProfile(true)

      try {
        const { data, error } = await getUserProfile(userId)

        if (error) {
          console.error(error)
          if (isProfilesTableMissing(error)) {
            setUiError(
              'Profiles table is not configured in Supabase yet. You can still continue and we will keep profile data for this session.',
            )
          } else {
            setUiError(error.message || 'Could not load profile.')
          }
          setProfile(null)
          return { data: null, error }
        }

        const nextProfile = data ? normalizeProfile(data) : null
        setProfile(nextProfile)
        return { data: nextProfile, error: null }
      } catch (error) {
        console.error(error)
        setUiError(error.message || 'Could not load profile.')
        setProfile(null)
        return { data: null, error }
      } finally {
        setIsLoadingProfile(false)
      }
    },
    [setIsLoadingProfile, setProfile],
  )

  const resolveLandingScreen = useCallback((nextProfile, profileError) => {
    if (isProfilesTableMissing(profileError) || !profileError) {
      if (!isProfileComplete(nextProfile)) {
        return 'profile-onboarding'
      }
    }

    return 'dashboard'
  }, [])

  const initializeAuthenticatedUser = useCallback(
    async (userId) => {
      setUiError('')
      const shouldShowSignupConfigureLoader =
        isSignupTransitionPendingRef.current || signupConfigureLoaderStartedAtRef.current > 0

      if (shouldShowSignupConfigureLoader) {
        if (signupConfigureLoaderStartedAtRef.current === 0) {
          signupConfigureLoaderStartedAtRef.current = Date.now()
        }
        setIsShowingSignupConfigureLoader(true)
      }

      try {
        const [, profileResult] = await Promise.all([
          loadProjects(userId),
          loadProfile(userId),
        ])

        const nextProfile = profileResult?.data ?? null
        const nextScreen = resolveLandingScreen(
          nextProfile,
          profileResult?.error ?? null,
        )

        if (shouldShowSignupConfigureLoader) {
          const elapsedMs = Date.now() - signupConfigureLoaderStartedAtRef.current
          const remainingMs = SIGNUP_CONFIGURE_MIN_DURATION_MS - elapsedMs

          if (remainingMs > 0) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, remainingMs)
            })
          }
        }

        setIsEditingProfile(false)
        setScreen(nextScreen)
      } finally {
        isSignupTransitionPendingRef.current = false
        signupConfigureLoaderStartedAtRef.current = 0
        setHasInitializedSession(true)
        setIsShowingSignupConfigureLoader(false)
      }
    },
    [loadProfile, loadProjects, resolveLandingScreen],
  )

  useEffect(() => {
    if (!user) {
      isSignupTransitionPendingRef.current = false
      signupConfigureLoaderStartedAtRef.current = 0
      setIsShowingSignupConfigureLoader(false)
      setHasInitializedSession(false)
      setProjects([])
      setProfile(null)
      setScreen('dashboard')
      setPreAuthScreen('landing')
      setAuthInitialMode('login')
      setIsEditingProfile(false)
      setCurrentProjectTitle('')
      setIsBackfillingProjectTitles(false)
      setProjectTitleStatusMessage('')
      isBackfillingProjectTitlesRef.current = false
      hasAttemptedHashRestoreRef.current = false
      isHashRestoreInProgressRef.current = false
      lastNavigationIdentityRef.current = ''
      hashRestoreNonceRef.current = 0
      lastInitializedUserIdRef.current = null
      resetApp()
      return
    }

    if (lastInitializedUserIdRef.current === user.id && hasInitializedSession) {
      return
    }

    lastInitializedUserIdRef.current = user.id
    setHasInitializedSession(false)
    hasAttemptedHashRestoreRef.current = false
    isHashRestoreInProgressRef.current = false
    lastNavigationIdentityRef.current = ''
    hashRestoreNonceRef.current = 0
    initializeAuthenticatedUser(user.id)
  }, [hasInitializedSession, initializeAuthenticatedUser, resetApp, setProfile, user])

  const syncWorkspaceFiles = useCallback(
    (files, preferredActiveFileId = null) => {
      const normalizedFiles = normalizeProjectFiles(files)
      setProjectFiles(normalizedFiles)

      if (normalizedFiles.length === 0) {
        setActiveFileId(null)
        updateUserCode('')
        lastSavedFileContentRef.current = {}
        return
      }

      const activeFile =
        normalizedFiles.find((file) => file.id === preferredActiveFileId) || normalizedFiles[0]

      setActiveFileId(activeFile.id)
      updateUserCode(activeFile.content || '')
      lastSavedFileContentRef.current = Object.fromEntries(
        normalizedFiles.map((file) => [file.id, file.content || '']),
      )
    },
    [setActiveFileId, setProjectFiles, updateUserCode],
  )

  const isProjectFilesSessionOnly = projectFilesStorageMode === 'session'

  const handleProjectFilesStorageError = useCallback(
    (error, { fallbackMessage = 'Could not access project files.' } = {}) => {
      const kind = classifyProjectFilesError(error)

      if (
        kind === PROJECT_FILES_ERROR_KIND.MISSING_TABLE ||
        kind === PROJECT_FILES_ERROR_KIND.SCHEMA_OUTDATED
      ) {
        setProjectFilesStorageMode('session')
        setProjectFilesStorageWarning(getProjectFilesStorageWarning(kind))
        setFileError('')
        return kind
      }

      if (kind === PROJECT_FILES_ERROR_KIND.PERMISSION_DENIED) {
        setFileError(getProjectFilesPermissionMessage())
        return kind
      }

      setFileError(error?.message || fallbackMessage)
      return kind
    },
    [setFileError],
  )

  const bootstrapProjectFiles = useCallback(
    async ({
      projectId,
      ownerId,
      description,
      fallbackCode = '',
      preferredRuntimeLanguage = '',
      preferredActiveFilePath = '',
      languages = null,
    }) => {
      const defaultFiles = createDefaultProjectFiles(
        description,
        fallbackCode,
        preferredRuntimeLanguage,
        languages,
      )
      const resolvePreferredFileId = (files) => {
        if (!preferredActiveFilePath) {
          return null
        }

        const matchedFile = (files || []).find((file) => file.path === preferredActiveFilePath)
        return matchedFile?.id || null
      }

      if (isProjectFilesSessionOnly) {
        syncWorkspaceFiles(defaultFiles, resolvePreferredFileId(defaultFiles))
        return
      }

      setFileError('')

      try {
        const { data: filesData, error: filesError } = await getProjectFiles(projectId)

        if (filesError) {
          console.error(filesError)
          handleProjectFilesStorageError(filesError, {
            fallbackMessage: 'Could not load project files.',
          })
          syncWorkspaceFiles(defaultFiles, resolvePreferredFileId(defaultFiles))
          return
        }

        const normalizedExistingFiles = normalizeProjectFiles(filesData ?? [])
        if (normalizedExistingFiles.length > 0) {
          syncWorkspaceFiles(
            normalizedExistingFiles,
            resolvePreferredFileId(normalizedExistingFiles),
          )
          return
        }

        const initialPayload = toPersistedFiles(defaultFiles, projectId, ownerId)
        const { data: createdFiles, error: createError } = await createProjectFiles(
          projectId,
          ownerId,
          initialPayload,
        )

        if (createError) {
          console.error(createError)
          handleProjectFilesStorageError(createError, {
            fallbackMessage: 'Could not initialize project files.',
          })
          syncWorkspaceFiles(defaultFiles, resolvePreferredFileId(defaultFiles))
          return
        }

        const nextFiles = createdFiles ?? defaultFiles
        syncWorkspaceFiles(nextFiles, resolvePreferredFileId(nextFiles))
      } catch (error) {
        console.error(error)
        setFileError(error.message || 'Could not initialize project files.')
        syncWorkspaceFiles(defaultFiles, resolvePreferredFileId(defaultFiles))
      }
    },
    [
      handleProjectFilesStorageError,
      isProjectFilesSessionOnly,
      setFileError,
      syncWorkspaceFiles,
    ],
  )

  const handleSignIn = useCallback(
    async (email, password) => {
      const { error } = await signIn(email, password)
      if (error) {
        setUiError(error.message || 'Log in failed.')
        return
      }

      setUiError('')
    },
    [signIn],
  )

  const handleSignUp = useCallback(
    async (email, password, fullName) => {
      isSignupTransitionPendingRef.current = true

      const { data, error } = await signUp(email, password, fullName)
      if (error) {
        isSignupTransitionPendingRef.current = false
        signupConfigureLoaderStartedAtRef.current = 0
        setIsShowingSignupConfigureLoader(false)
        setUiError(error.message || 'Sign up failed.')
        return
      }

      if (!data?.session?.user) {
        isSignupTransitionPendingRef.current = false
        signupConfigureLoaderStartedAtRef.current = 0
        setIsShowingSignupConfigureLoader(false)
        setUiError('')
        return
      }

      if (signupConfigureLoaderStartedAtRef.current === 0) {
        signupConfigureLoaderStartedAtRef.current = Date.now()
      }
      setIsShowingSignupConfigureLoader(true)
      setUiError('')
    },
    [signUp],
  )

  const handleContinueWithGoogle = useCallback(async () => {
    const { error } = await signInWithGoogle()
    if (error) {
      setUiError(error.message || 'Google authentication failed.')
      return
    }

    setUiError('')
  }, [signInWithGoogle])

  const handleLogOut = useCallback(async () => {
    const { error } = await signOut()
    if (error) {
      setUiError(error.message || 'Log out failed.')
      return
    }

    hashRestoreNonceRef.current += 1
    hasAttemptedHashRestoreRef.current = false
    isHashRestoreInProgressRef.current = false
    lastNavigationIdentityRef.current = ''
    resetApp()
    setProjects([])
    setProfile(null)
    setIsEditingProfile(false)
    setCurrentProjectTitle('')
    setIsBackfillingProjectTitles(false)
    setProjectTitleStatusMessage('')
    isBackfillingProjectTitlesRef.current = false
    setScreen('dashboard')
    setPreAuthScreen('landing')
    setAuthInitialMode('login')
    setUiError('')
    setPreviewSrcDoc('')
    setPreviewError('')
    setAuthError(null)
  }, [resetApp, setAuthError, setProfile, signOut])

  const handleResendConfirmation = useCallback(
    async (email) => {
      const { error } = await resendConfirmation(email)
      if (error) {
        setUiError(error.message || 'Could not resend confirmation email.')
        return
      }

      setUiError('')
    },
    [resendConfirmation],
  )

  const handleStartNewProject = useCallback(() => {
    hashRestoreNonceRef.current += 1
    isHashRestoreInProgressRef.current = false
    hasAttemptedHashRestoreRef.current = true
    resetApp()
    setUiError('')
    setFeedbackError('')
    setPreviewSrcDoc('')
    setPreviewError('')
    setIsEditingProfile(false)
    setCurrentProjectTitle('')
    setProjectTitleStatusMessage('')
    setFollowUpSuggestions([])
    setFollowUpSuggestionsNotice('')
    setIsGeneratingFollowUpSuggestions(false)
    setProjectFilesStorageWarning('')
    setProjectFilesStorageMode('supabase')
    setScreen('new-project')
  }, [resetApp])

  const handleOpenAuthScreen = useCallback((mode = 'login') => {
    const nextMode = mode === 'signup' ? 'signup' : 'login'
    setAuthInitialMode(nextMode)
    setPreAuthScreen('auth')
    setUiError('')
    setAuthError(null)
  }, [setAuthError])

  const handleBackToLanding = useCallback(() => {
    setPreAuthScreen('landing')
    setAuthInitialMode('login')
    setUiError('')
    setAuthError(null)
  }, [setAuthError])

  const handleCompleteProfile = useCallback(
    async (profileInput) => {
      if (!user) {
        setUiError('You must be logged in to update your profile.')
        return
      }

      const normalized = normalizeProfile(profileInput)
      const profileWithCompletion = {
        ...normalized,
        completedAt: normalized.completedAt || new Date().toISOString(),
      }

      setIsSavingProfile(true)
      setUiError('')

      try {
        const { data, error } = await upsertUserProfile(user.id, profileWithCompletion)

        if (error) {
          if (isProfilesTableMissing(error)) {
            setUiError(
              'Profiles table is not configured in Supabase yet. Profile preferences are saved for this session only.',
            )
            setProfile(profileWithCompletion)
          } else {
            console.error(error)
            setUiError(error.message || 'Could not save profile.')
            return
          }
        } else if (data) {
          setProfile(data)
        } else {
          setProfile(profileWithCompletion)
        }

        setIsEditingProfile(false)
        setScreen('dashboard')
      } catch (error) {
        console.error(error)
        setUiError(error.message || 'Could not save profile.')
      } finally {
        setIsSavingProfile(false)
      }
    },
    [setIsSavingProfile, setProfile, user],
  )

  const handleGenerateRoadmap = useCallback(
    async (description, clarifyingAnswers, languages = null) => {
      if (!user) {
        setUiError('You must be logged in to create a project.')
        return
      }

      setUiError('')
      setIsGeneratingRoadmap(true)
      setProjectDescription(description)

      try {
        const roadmapResult = await withTimeout(
          generateRoadmap(
            description,
            clarifyingAnswers,
            profileToPromptContext(profile),
            languages,
          ),
          90000,
          'Roadmap generation is taking too long. Please try again.',
        )
        if (roadmapResult.error) {
          setUiError(roadmapResult.error.message)
          return
        }

        const inferredSkillLevel = normalizeProjectSkillLevel(roadmapResult.data?.skillLevel)
        const roadmapTasks = Array.isArray(roadmapResult.data?.tasks)
          ? roadmapResult.data.tasks
          : []

        if (roadmapTasks.length === 0) {
          setUiError('Roadmap generation failed: no tasks were returned.')
          return
        }

        const selectedSkillLevel = normalizeSelectedSkillLevel(
          clarifyingAnswers?.skillLevelPreference,
        )
        const effectiveSkillLevel = selectedSkillLevel || inferredSkillLevel

        setSkillLevel(effectiveSkillLevel)

        const fallbackProjectTitle = buildProjectTitleFallback(description)
        let generatedProjectTitle = fallbackProjectTitle

        try {
          const titleResult = await withTimeout(
            generateProjectTitle(description, effectiveSkillLevel),
            12000,
            'Project title generation timed out. Using a fallback title.',
          )
          if (titleResult.error) {
            console.error(titleResult.error)
          } else {
            generatedProjectTitle = sanitizeProjectTitle(
              titleResult.data,
              description,
            )
          }
        } catch (error) {
          console.error(error)
        }

        const validatedLanguages = Array.isArray(languages) && languages.length > 0 ? languages : null

        const { data: projectData, error: projectError } = await withTimeout(
          createProject(
            user.id,
            description,
            effectiveSkillLevel,
            generatedProjectTitle,
            validatedLanguages,
          ),
          15000,
          'Saving your new project timed out. Please try again.',
        )

        if (projectError || !projectData) {
          console.error(projectError)
          setUiError(projectError?.message || 'Could not create project.')
          return
        }

        const { data: savedTaskData, error: saveError } = await withTimeout(
          saveTasks(
            projectData.id,
            user.id,
            roadmapTasks,
          ),
          15000,
          'Saving roadmap tasks timed out. Please try again.',
        )

        if (saveError || !savedTaskData) {
          console.error(saveError)
          const taskSaveMessage = saveError?.message || 'Could not save tasks.'

          try {
            const { error: rollbackError } = await withTimeout(
              deleteProjectInDb(projectData.id, user.id),
              8000,
              'Could not save tasks, and project rollback timed out.',
            )
            if (rollbackError) {
              console.error(rollbackError)
              setUiError(
                `${taskSaveMessage} Project creation rollback also failed. The project may appear in Dashboard; please delete it and try again.`,
              )
            } else {
              setUiError(taskSaveMessage)
            }
          } catch (rollbackError) {
            console.error(rollbackError)
            setUiError(
              `${taskSaveMessage} Project creation rollback also failed. The project may appear in Dashboard; please delete it and try again.`,
            )
          }
          return
        }

        const normalizedTasks = savedTaskData.map(normalizeTask)

        setProjectLanguages(validatedLanguages)
        setCurrentProjectId(projectData.id)
        setCurrentProjectTitle(
          sanitizeProjectTitle(projectData.title || generatedProjectTitle, description),
        )
        setTasks(normalizedTasks)
        setCurrentTaskIndex(0)
        resetTaskSupportState()
        setFeedbackError('')
        setPreviewSrcDoc('')
        setPreviewError('')
        const initialTaskLanguage = sanitizeLanguage(normalizedTasks[0]?.language)
        try {
          await withTimeout(
            bootstrapProjectFiles({
              projectId: projectData.id,
              ownerId: user.id,
              description,
              fallbackCode: '',
              preferredRuntimeLanguage: initialTaskLanguage,
              languages: validatedLanguages,
            }),
            15000,
            'Project files are taking too long to initialize. Opening workspace with starter files.',
          )
        } catch (bootstrapError) {
          console.error(bootstrapError)
          setFileError(bootstrapError.message || 'Could not initialize project files.')
          syncWorkspaceFiles(
            createDefaultProjectFiles(description, '', initialTaskLanguage, validatedLanguages),
          )
        }

        setScreen('workspace')
        void loadProjects(user.id)
      } catch (error) {
        console.error(error)
        setUiError(error.message || 'Roadmap generation failed.')
      } finally {
        setIsGeneratingRoadmap(false)
      }
    },
    [
      generateRoadmap,
      generateProjectTitle,
      bootstrapProjectFiles,
      loadProjects,
      profile,
      resetTaskSupportState,
      setFileError,
      setCurrentProjectId,
      setCurrentTaskIndex,
      setIsGeneratingRoadmap,
      setProjectDescription,
      setProjectLanguages,
      setCurrentProjectTitle,
      setSkillLevel,
      setTasks,
      syncWorkspaceFiles,
      user,
    ],
  )

  const autoRepairGenericRoadmap = useCallback(
    async ({ project, ownerId }) => {
      if (!project?.id || !ownerId) {
        return
      }

      const storage = typeof window !== 'undefined' ? window.localStorage : null
      if (hasRoadmapRepairAttempted(storage, project.id)) {
        return
      }

      markRoadmapRepairAttempted(storage, project.id)

      showTimedFileNotice(
        'Detected an older generic roadmap. Refreshing task quality in the background...',
        4500,
      )

      try {
        const repairResult = await generateRoadmap(
          project.description,
          buildRoadmapRepairClarifyingAnswers(project.skill_level),
          profileToPromptContext(profile),
        )

        if (
          repairResult.error ||
          !Array.isArray(repairResult.data?.tasks) ||
          repairResult.data.tasks.length < 4
        ) {
          setUiError(
            repairResult.error?.message ||
              'Could not auto-repair this roadmap right now. You can continue coding and try again later.',
          )
          return
        }

        if (shouldAutoRepairRoadmapTasks(repairResult.data.tasks)) {
          setUiError(
            'Auto-repair generated a generic roadmap again. Please try creating a fresh roadmap from New Project.',
          )
          return
        }

        const { data: replacedTasks, error: replaceError } = await replaceProjectTasks(
          project.id,
          ownerId,
          repairResult.data.tasks,
        )

        if (replaceError || !Array.isArray(replacedTasks) || replacedTasks.length === 0) {
          console.error(replaceError)
          setUiError(
            replaceError?.message ||
              'Could not save auto-repaired roadmap tasks for this project.',
          )
          return
        }

        const normalizedReplacedTasks = replacedTasks.map(normalizeTask)
        setProjects((prev) =>
          prev.map((item) =>
            item.id === project.id ? { ...item, completed: false } : item,
          ),
        )

        if (currentProjectId === project.id) {
          setTasks(normalizedReplacedTasks)
          const firstIncomplete = normalizedReplacedTasks.findIndex((task) => !task.completed)
          setCurrentTaskIndex(firstIncomplete === -1 ? 0 : firstIncomplete)
          resetTaskSupportState()
          setFeedbackError('')
        }

        const { error: markIncompleteError } = await markProjectIncomplete(project.id, appUser?.id)
        if (markIncompleteError) {
          console.error(markIncompleteError)
          setUiError(
            markIncompleteError.message ||
              'Roadmap auto-repair completed, but project status could not be marked incomplete.',
          )
          return
        }

        showTimedFileNotice('Roadmap refreshed with specific tasks.', 4500)
      } catch (error) {
        console.error(error)
        setUiError(
          error.message ||
            'Could not auto-repair this roadmap right now. You can continue coding and try again later.',
        )
      }
    },
    [
      appUser?.id,
      currentProjectId,
      generateRoadmap,
      profile,
      resetTaskSupportState,
      setCurrentTaskIndex,
      setProjects,
      setTasks,
      showTimedFileNotice,
    ],
  )

  const handleContinueProject = useCallback(
    async (project, options = {}) => {
      const preferredTaskIndex =
        Number.isInteger(options?.preferredTaskIndex) && options.preferredTaskIndex >= 0
          ? options.preferredTaskIndex
          : null
      const preferredActiveFilePath = toText(options?.preferredActiveFilePath).trim()
      const shouldAbort =
        typeof options?.shouldAbort === 'function' ? options.shouldAbort : () => false
      const ownerId = appUser?.id || user?.id

      if (!ownerId) {
        setUiError('You must be logged in to continue a project.')
        return
      }

      setUiError('')
      setIsLoadingProjects(true)

      try {
        const { data, error } = await getProjectTasks(project.id)
        if (error) {
          console.error(error)
          setUiError(error.message || 'Could not load project tasks.')
          return
        }

        let normalizedTasks = (data ?? []).map(normalizeTask)
        if (normalizedTasks.length === 0) {
          setUiError('This project has no tasks yet. Regenerate or delete it from Dashboard.')
          return
        }

        const shouldRepairRoadmapInBackground = shouldAutoRepairRoadmapTasks(normalizedTasks)

        const firstIncomplete = normalizedTasks.findIndex((task) => !task.completed)
        const resolvedProjectTitle = getProjectDisplayTitle(project)
        const fallbackTaskIndex = firstIncomplete === -1 ? 0 : firstIncomplete
        const nextTaskIndex =
          preferredTaskIndex !== null && preferredTaskIndex < normalizedTasks.length
            ? preferredTaskIndex
            : fallbackTaskIndex

        if (shouldAbort()) {
          return
        }

        await bootstrapProjectFiles({
          projectId: project.id,
          ownerId,
          description: project.description,
          fallbackCode: '',
          preferredActiveFilePath,
        })

        if (shouldAbort()) {
          return
        }

        setProjectLanguages(
          Array.isArray(project.languages) && project.languages.length > 0
            ? project.languages
            : null,
        )
        setCurrentProjectId(project.id)
        setCurrentProjectTitle(resolvedProjectTitle)
        setProjectDescription(project.description)
        setSkillLevel(normalizeProjectSkillLevel(project.skill_level))
        setTasks(normalizedTasks)
        setCurrentTaskIndex(nextTaskIndex)
        resetTaskSupportState()
        setFeedbackError('')
        setPreviewSrcDoc('')
        setPreviewError('')

        if (firstIncomplete === -1 && normalizedTasks.length > 0) {
          setScreen('completion')
        } else {
          setScreen('workspace')
        }

        if (shouldRepairRoadmapInBackground) {
          void autoRepairGenericRoadmap({ project, ownerId })
        }

        if (!hasStoredProjectTitle(project) && appUser?.id) {
          void backfillProjectTitles([project], appUser.id)
        }
      } catch (error) {
        console.error(error)
        setUiError(error.message || 'Could not continue project.')
      } finally {
        setIsLoadingProjects(false)
      }
    },
    [
      resetTaskSupportState,
      appUser,
      autoRepairGenericRoadmap,
      backfillProjectTitles,
      bootstrapProjectFiles,
      setCurrentProjectId,
      setCurrentProjectTitle,
      setCurrentTaskIndex,
      setIsLoadingProjects,
      setProjectDescription,
      setProjectLanguages,
      setSkillLevel,
      setTasks,
      user,
    ],
  )

  useEffect(() => {
    if (!appUser?.id || !hasInitializedSession) {
      return
    }

    if (hasAttemptedHashRestoreRef.current || isHashRestoreInProgressRef.current) {
      return
    }

    if (screen === 'profile-onboarding') {
      hasAttemptedHashRestoreRef.current = true
      return
    }

    const hashState = parseHashWorkspaceState()

    if (
      hashState.screen === 'new-project' &&
      screen === 'dashboard' &&
      tasks.length === 0 &&
      !currentProjectId
    ) {
      hasAttemptedHashRestoreRef.current = true
      setScreen('new-project')
      return
    }

    if (
      (hashState.screen !== 'workspace' && hashState.screen !== 'completion') ||
      !hashState.projectId
    ) {
      hasAttemptedHashRestoreRef.current = true
      return
    }

    const matchingProject = projects.find((project) => project.id === hashState.projectId)
    if (!matchingProject) {
      hasAttemptedHashRestoreRef.current = true
      return
    }

    const restoreNonce = hashRestoreNonceRef.current + 1
    hashRestoreNonceRef.current = restoreNonce
    isHashRestoreInProgressRef.current = true
    void (async () => {
      try {
        await handleContinueProject(matchingProject, {
          preferredTaskIndex: hashState.taskIndex,
          preferredActiveFilePath: hashState.filePath,
          shouldAbort: () => hashRestoreNonceRef.current !== restoreNonce,
        })
      } finally {
        isHashRestoreInProgressRef.current = false
        hasAttemptedHashRestoreRef.current = true
      }
    })()
  }, [
    appUser?.id,
    currentProjectId,
    handleContinueProject,
    hasInitializedSession,
    projects,
    screen,
    tasks.length,
  ])

  const handleDeleteProject = useCallback(
    async (project) => {
      if (!project?.id) {
        setUiError('Could not identify which project to delete.')
        return
      }

      if (!user) {
        setUiError('You must be logged in to delete a project.')
        return
      }

      const isConfirmed =
        typeof window === 'undefined'
          ? true
          : window.confirm(
              'Delete this project permanently? This will remove its roadmap and files, and cannot be undone.',
            )

      if (!isConfirmed) {
        return
      }

      setUiError('')
      setDeletingProjectId(project.id)

      try {
        const { error } = await deleteProjectInDb(project.id, user.id)
        if (error) {
          console.error(error)
          setUiError(error.message || 'Could not delete project.')
          return
        }

        setProjects((prev) => prev.filter((item) => item.id !== project.id))

        if (currentProjectId === project.id) {
          resetApp()
          setCurrentProjectTitle('')
          setScreen('dashboard')
        }

        await loadProjects(user.id)
      } catch (error) {
        console.error(error)
        setUiError(error.message || 'Could not delete project.')
      } finally {
        setDeletingProjectId(null)
      }
    },
    [currentProjectId, loadProjects, resetApp, user],
  )

  const activeFile = useMemo(() => {
    if (projectFiles.length === 0) {
      return null
    }

    return projectFiles.find((file) => file.id === activeFileId) || projectFiles[0]
  }, [activeFileId, projectFiles])

  useEffect(() => {
    if (projectFiles.length === 0) {
      setActiveFileId(null)
      updateUserCode('')
      return
    }

    if (!activeFile) {
      setActiveFileId(projectFiles[0].id)
      updateUserCode(projectFiles[0].content || '')
      return
    }

    updateUserCode(activeFile.content || '')
  }, [activeFile, projectFiles, setActiveFileId, updateUserCode])

  const persistProjectFile = useCallback(
    async (fileToSave, { showSavingState = true } = {}) => {
      if (!currentProjectId || !appUser) {
        return
      }

      if (isProjectFilesSessionOnly) {
        return
      }

      const payload = toPersistedFiles([fileToSave], currentProjectId, appUser.id)[0]
      if (!payload) {
        return
      }

      if (showSavingState) {
        setIsSavingFiles(true)
      }
      setFileError('')

      try {
        const { data, error } = await upsertProjectFile(payload)
        if (error) {
          console.error(error)
          handleProjectFilesStorageError(error, {
            fallbackMessage: 'Could not save file.',
          })
          return
        }

        const normalizedSaved = normalizeProjectFiles([data])[0]
        if (!normalizedSaved) {
          return
        }

        lastSavedFileContentRef.current[normalizedSaved.id] = normalizedSaved.content || ''
        if (fileToSave.id !== normalizedSaved.id) {
          delete lastSavedFileContentRef.current[fileToSave.id]
        }

        setProjectFiles((prev) =>
          normalizeProjectFiles(
            prev.map((file) =>
              file.id === fileToSave.id || file.path === normalizedSaved.path
                ? { ...file, ...normalizedSaved }
                : file,
            ),
          ),
        )

        if (activeFileId === fileToSave.id && normalizedSaved.id !== fileToSave.id) {
          setActiveFileId(normalizedSaved.id)
        }
      } catch (error) {
        console.error(error)
        setFileError(error.message || 'Could not save file.')
      } finally {
        if (showSavingState) {
          setIsSavingFiles(false)
        }
      }
    },
    [
      activeFileId,
      appUser,
      currentProjectId,
      handleProjectFilesStorageError,
      isProjectFilesSessionOnly,
      setActiveFileId,
      setFileError,
      setIsSavingFiles,
      setProjectFiles,
    ],
  )

  useEffect(() => {
    if (!activeFile || !appUser || !currentProjectId) {
      return undefined
    }

    const lastSaved = lastSavedFileContentRef.current[activeFile.id]
    if (lastSaved === activeFile.content) {
      return undefined
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      persistProjectFile(activeFile, { showSavingState: false })
    }, 700)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [activeFile, appUser, currentProjectId, persistProjectFile])

  const handleSelectFile = useCallback(
    (fileId) => {
      const selected = projectFiles.find((file) => file.id === fileId)
      if (!selected) {
        return
      }

      setActiveFileId(fileId)
      updateUserCode(selected.content || '')
      setPreviewError('')
    },
    [projectFiles, setActiveFileId, updateUserCode],
  )

  const handleEditorChange = useCallback(
    (nextCode) => {
      if (!activeFile) {
        return
      }

      setProjectFiles((prev) =>
        prev.map((file) => (file.id === activeFile.id ? { ...file, content: nextCode } : file)),
      )
      updateUserCode(nextCode)
    },
    [activeFile, setProjectFiles, updateUserCode],
  )

  const handleCreateFile = useCallback(
    async (rawPath) => {
      const safePath = sanitizeFilePath(rawPath)
      if (!safePath) {
        setFileError('Invalid file path. Use letters, numbers, -, _, ., and folder segments.')
        return
      }

      if (!isFileAllowedByLanguageLock(safePath, projectLanguages)) {
        const allowed = getAllowedExtensions(projectLanguages)
        setFileError(
          `This file type is not allowed. Project languages: ${(projectLanguages || []).join(', ')}. Allowed extensions: ${allowed.join(', ')}`,
        )
        return
      }

      if (projectFiles.some((file) => file.path === safePath)) {
        setFileError('A file with this path already exists.')
        return
      }

      const detectedLanguage = runtimeLanguageFromPath(safePath)

      const nextFile = {
        id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        path: safePath,
        name: fileNameFromPath(safePath),
        language: detectedLanguage || 'javascript',
        content: '',
        sort_index: projectFiles.length,
      }

      setFileError('')
      if (detectedLanguage) {
        showFileLanguageNotice(safePath, detectedLanguage)
      }
      setProjectFiles((prev) => normalizeProjectFiles([...prev, nextFile]))
      setActiveFileId(nextFile.id)
      updateUserCode('')
      lastSavedFileContentRef.current[nextFile.id] = ''

      await persistProjectFile(nextFile)
    },
    [
      persistProjectFile,
      projectFiles,
      projectLanguages,
      setActiveFileId,
      setFileError,
      setProjectFiles,
      showFileLanguageNotice,
      updateUserCode,
    ],
  )

  const handleRenameFile = useCallback(
    async (fileId, rawPath) => {
      const safePath = sanitizeFilePath(rawPath)
      if (!safePath) {
        setFileError('Invalid file path. Use letters, numbers, -, _, ., and folder segments.')
        return
      }

      if (!isFileAllowedByLanguageLock(safePath, projectLanguages)) {
        const allowed = getAllowedExtensions(projectLanguages)
        setFileError(
          `This file type is not allowed. Project languages: ${(projectLanguages || []).join(', ')}. Allowed extensions: ${allowed.join(', ')}`,
        )
        return
      }

      const target = projectFiles.find((file) => file.id === fileId)
      if (!target) {
        return
      }

      if (projectFiles.some((file) => file.id !== fileId && file.path === safePath)) {
        setFileError('A file with this path already exists.')
        return
      }

      const detectedLanguage = runtimeLanguageFromPath(safePath)
      const nextLanguage = detectedLanguage || target.language || 'javascript'

      const renamed = {
        ...target,
        path: safePath,
        name: fileNameFromPath(safePath),
        language: nextLanguage,
      }

      setFileError('')
      if (detectedLanguage && detectedLanguage !== sanitizeLanguage(target.language || '')) {
        showFileLanguageNotice(safePath, detectedLanguage)
      }
      setProjectFiles((prev) =>
        normalizeProjectFiles(prev.map((file) => (file.id === fileId ? renamed : file))),
      )

      await persistProjectFile(renamed)
    },
    [persistProjectFile, projectFiles, projectLanguages, setFileError, setProjectFiles, showFileLanguageNotice],
  )

  const handleDeleteFile = useCallback(
    async (fileId) => {
      if (projectFiles.length <= 1) {
        setFileError('At least one file is required in the project.')
        return
      }

      const target = projectFiles.find((file) => file.id === fileId)
      if (!target) {
        return
      }

      setFileError('')
      setIsSavingFiles(true)

      try {
        if (!isProjectFilesSessionOnly && !target.id.startsWith('local-')) {
          const { error } = await deleteProjectFile(target.id, appUser?.id)
          if (error) {
            console.error(error)
            handleProjectFilesStorageError(error, {
              fallbackMessage: 'Could not delete file.',
            })
            return
          }
        }

        const remaining = normalizeProjectFiles(projectFiles.filter((file) => file.id !== fileId))
        setProjectFiles(remaining)

        const nextActive = remaining[0] || null
        setActiveFileId(nextActive?.id || null)
        updateUserCode(nextActive?.content || '')
        delete lastSavedFileContentRef.current[fileId]
      } catch (error) {
        console.error(error)
        setFileError(error.message || 'Could not delete file.')
      } finally {
        setIsSavingFiles(false)
      }
    },
    [
      appUser?.id,
      projectFiles,
      setActiveFileId,
      setFileError,
      setIsSavingFiles,
      setProjectFiles,
      updateUserCode,
      handleProjectFilesStorageError,
      isProjectFilesSessionOnly,
    ],
  )

  const handleRunPreview = useCallback(async () => {
    setPreviewError('')

    try {
      const srcDoc = buildPreviewSrcDoc(projectFiles)
      setPreviewSrcDoc(srcDoc)
    } catch (error) {
      console.error(error)
      setPreviewSrcDoc('')
      setPreviewError(error.message || 'Could not build preview.')
    }
  }, [projectFiles])

  // Debounced live preview: auto-rebuild preview 500ms after file content changes
  const previewDebounceRef = useRef(null)
  useEffect(() => {
    const hasHtml = projectFiles.some((f) =>
      f.path.toLowerCase().endsWith('.html'),
    )
    if (!hasHtml) {
      return
    }

    clearTimeout(previewDebounceRef.current)
    previewDebounceRef.current = setTimeout(() => {
      try {
        const srcDoc = buildPreviewSrcDoc(projectFiles)
        setPreviewSrcDoc(srcDoc)
        setPreviewError('')
      } catch (error) {
        console.error(error)
        setPreviewError(error.message || 'Could not build preview.')
      }
    }, 500)

    return () => clearTimeout(previewDebounceRef.current)
  }, [projectFiles])

  const handlePreviewConsole = useCallback(({ level, message }) => {
    const prefix = '[Preview]'
    if (level === 'runtime_error' || level === 'error' || level === 'stderr') {
      console.error(`${prefix} ${message}`)
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`)
    }
  }, [])

  const handleExportProject = useCallback(async () => {
    setIsExporting(true)
    setFileError('')

    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      projectFiles.forEach((file) => {
        zip.file(file.path, file.content || '')
      })

      const blob = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `mentor-project-${currentProjectId || 'export'}.zip`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error(error)
      setFileError(error.message || 'Could not export project.')
    } finally {
      setIsExporting(false)
    }
  }, [
    currentProjectId,
    projectFiles,
    setFileError,
    setIsExporting,
  ])

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportProject = useCallback(
    async (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''

      if (!file || !currentProjectId || !appUser) {
        return
      }

      setIsImporting(true)
      setFileError('')

      try {
        const isZipFile =
          file.name.toLowerCase().endsWith('.zip') ||
          file.type === 'application/zip' ||
          file.type === 'application/x-zip-compressed'

        if (!isZipFile) {
          setFileError('Please import a .zip file.')
          return
        }

        if (file.size > ZIP_IMPORT_LIMITS.maxArchiveBytes) {
          setFileError(
            `Zip file is too large. Maximum size is ${Math.round(ZIP_IMPORT_LIMITS.maxArchiveBytes / (1024 * 1024))} MB.`,
          )
          return
        }

        const { default: JSZip } = await import('jszip')
        const zip = await JSZip.loadAsync(file)
        const entries = Object.values(zip.files)
          .filter(
            (entry) =>
              !entry.dir &&
              !entry.name.startsWith('__MACOSX/') &&
              !entry.name.endsWith('/'),
          )
          .sort((a, b) => a.name.localeCompare(b.name))

        const descriptorValidation = validateZipImportFileDescriptors(
          entries.map((entry) => ({
            path: entry.name,
            sizeBytes: Number(entry?._data?.uncompressedSize),
          })),
          ZIP_IMPORT_LIMITS,
        )

        if (descriptorValidation.error) {
          setFileError(descriptorValidation.error.message)
          return
        }

        const importedFiles = []
        let totalImportedBytes = 0
        for (let index = 0; index < entries.length; index += 1) {
          const entry = entries[index]
          const content = await entry.async('string')
          const fileBytes = getUtf8ByteLength(content)

          if (fileBytes > ZIP_IMPORT_LIMITS.maxFileBytes) {
            setFileError(
              `File "${entry.name}" is too large. Maximum file size is ${Math.round(ZIP_IMPORT_LIMITS.maxFileBytes / 1024)} KB.`,
            )
            return
          }

          totalImportedBytes += fileBytes
          if (totalImportedBytes > ZIP_IMPORT_LIMITS.maxTotalBytes) {
            setFileError(
              `Imported content is too large. Maximum total size is ${Math.round(ZIP_IMPORT_LIMITS.maxTotalBytes / (1024 * 1024))} MB.`,
            )
            return
          }

          importedFiles.push({
            path: entry.name,
            name: fileNameFromPath(entry.name),
            language: runtimeLanguageFromPath(entry.name) || 'javascript',
            content,
            sort_index: index,
          })
        }

        const nextFiles = importedFiles

        if (!Array.isArray(nextFiles) || nextFiles.length === 0) {
          setFileError('Import file has no project files.')
          return
        }

        if (isProjectFilesSessionOnly) {
          syncWorkspaceFiles(nextFiles)
          showImportLanguageNotice(nextFiles)
          return
        }

        const payload = toPersistedFiles(nextFiles, currentProjectId, appUser.id)
        const { data, error } = await replaceProjectFiles(currentProjectId, appUser.id, payload)

        if (error) {
          console.error(error)
          const errorKind = handleProjectFilesStorageError(error, {
            fallbackMessage: 'Could not import project files.',
          })
          if (errorKind !== PROJECT_FILES_ERROR_KIND.PERMISSION_DENIED) {
            syncWorkspaceFiles(nextFiles)
            showImportLanguageNotice(nextFiles)
          }
          return
        }

        const syncedFiles = data || nextFiles
        syncWorkspaceFiles(syncedFiles)
        showImportLanguageNotice(syncedFiles)
      } catch (error) {
        console.error(error)
        setFileError(error.message || 'Could not import project file.')
      } finally {
        setIsImporting(false)
      }
    },
    [
      appUser,
      currentProjectId,
      handleProjectFilesStorageError,
      isProjectFilesSessionOnly,
      setFileError,
      setIsImporting,
      showImportLanguageNotice,
      syncWorkspaceFiles,
    ],
  )

  const currentTask = tasks[currentTaskIndex] ?? null
  currentTaskIdRef.current = currentTask?.id ?? null
  const taskDescription = toText(currentTask?.description).trim()
  const taskDescriptionPreview =
    taskDescription.length > 140
      ? `${taskDescription.slice(0, 140).trimEnd()}...`
      : taskDescription
  const isTaskDescriptionTruncated = taskDescriptionPreview !== taskDescription
  const workspaceTitle = useMemo(
    () =>
      getProjectDisplayTitle({
        title: currentProjectTitle,
        description: projectDescription,
      }),
    [currentProjectTitle, projectDescription],
  )
  const lockedTaskLanguage = sanitizeLanguage(currentTask?.language)
  const activeFileLanguage = useMemo(
    () => runtimeLanguageFromFile(activeFile),
    [activeFile],
  )
  const detectedLanguage = useMemo(
    () =>
      activeFileLanguage ||
      detectLanguage(projectDescription, userCode),
    [activeFileLanguage, projectDescription, userCode],
  )
  const hasLockedLanguageMismatch = Boolean(
    lockedTaskLanguage && activeFileLanguage && activeFileLanguage !== lockedTaskLanguage,
  )
  const runtimeLanguage = lockedTaskLanguage || detectedLanguage
  const editorLanguage = useMemo(
    () => editorLanguageFromFile(activeFile, runtimeLanguage || 'javascript'),
    [activeFile, runtimeLanguage],
  )
  const fileTabs = useMemo(
    () =>
      projectFiles.map((file) => ({
        id: file.id,
        label: file.name || file.path,
      })),
    [projectFiles],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !appUser?.id || !hasInitializedSession) {
      return
    }

    if (!hasAttemptedHashRestoreRef.current) {
      return
    }

    const nextHash = buildHashFromWorkspaceState({
      screen,
      currentProjectId,
      currentTaskIndex,
      activeFilePath: activeFile?.path || '',
    })
    const nextIdentity = buildNavigationIdentity(screen, currentProjectId)

    if (window.location.hash === nextHash) {
      lastNavigationIdentityRef.current = nextIdentity
      return
    }

    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`
    const shouldPushHistoryEntry =
      lastNavigationIdentityRef.current !== '' &&
      lastNavigationIdentityRef.current !== nextIdentity

    if (shouldPushHistoryEntry) {
      window.history.pushState(window.history.state, '', nextUrl)
    } else {
      window.history.replaceState(window.history.state, '', nextUrl)
    }

    lastNavigationIdentityRef.current = nextIdentity
  }, [
    activeFile?.path,
    appUser?.id,
    currentProjectId,
    currentTaskIndex,
    hasInitializedSession,
    screen,
  ])

  const hasHtmlFile = projectFiles.some(f => {
    const p = (f.path || f.name || '').toLowerCase()
    return p.endsWith('.html') || p.endsWith('.htm')
  })
  const showHtmlPreview = runtimeLanguage === 'html' && hasHtmlFile

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed).length,
    [tasks],
  )

  const isAllTasksComplete = tasks.length > 0 && completedCount === tasks.length

  const firstIncompleteIndex = useMemo(
    () => tasks.findIndex((task) => !task.completed),
    [tasks],
  )

  const handleSelectTask = useCallback(
    (taskIndex) => {
      setCurrentTaskIndex(taskIndex)
      resetTaskSupportState()
      setFeedbackError('')
      setFollowUpSuggestions([])
      setFollowUpSuggestionsNotice('')
      setIsGeneratingFollowUpSuggestions(false)
      // Reset scroll on right pane
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0 })
      }
    },
    [resetTaskSupportState, setCurrentTaskIndex],
  )

  useEffect(() => {
    setIsTaskCardExpanded(false)
  }, [currentProjectId])

  const handleResolveTaskLanguageMismatch = useCallback(async () => {
    if (!lockedTaskLanguage) {
      return
    }

    setFileError('')

    try {
      const existingMatch = findFirstFileByLanguage(projectFiles, lockedTaskLanguage)
      if (existingMatch) {
        setActiveFileId(existingMatch.id)
        updateUserCode(existingMatch.content || '')
        setPreviewError('')
        showTimedFileNotice(
          `Switched to "${existingMatch.path}" for ${prettyLanguageName(lockedTaskLanguage)}.`,
        )
        return
      }

      const starterFile = createStarterFileForLanguage(lockedTaskLanguage, projectFiles)
      if (!starterFile) {
        setFileError(
          `Could not create a starter file for ${prettyLanguageName(lockedTaskLanguage)}.`,
        )
        return
      }

      setProjectFiles((prev) => normalizeProjectFiles([...prev, starterFile]))
      setActiveFileId(starterFile.id)
      updateUserCode(starterFile.content || '')
      lastSavedFileContentRef.current[starterFile.id] = starterFile.content || ''
      setPreviewError('')
      showTimedFileNotice(
        `Created "${starterFile.path}" for locked ${prettyLanguageName(lockedTaskLanguage)} task.`,
      )
      await persistProjectFile(starterFile)
    } catch (error) {
      console.error(error)
      setFileError(error.message || 'Could not align files to the task language lock.')
    }
  }, [
    lockedTaskLanguage,
    persistProjectFile,
    projectFiles,
    setActiveFileId,
    setFileError,
    setProjectFiles,
    showTimedFileNotice,
    updateUserCode,
  ])

  const loadFollowUpSuggestions = useCallback(
    async (task, checkSignature, mentorFeedback) => {
      setIsGeneratingFollowUpSuggestions(true)
      setFollowUpSuggestionsNotice('')

      try {
        const result = await suggestFollowUpQuestions(
          task,
          userCode,
          mentorFeedback,
          skillLevel,
          profileToPromptContext(profile),
        )

        if (result.error) {
          const fallback = Array.isArray(result.data) && result.data.length > 0 ? result.data : []
          const nextNotice = fallback.length > 0 ? '' : 'Suggested questions are unavailable right now.'
          setFollowUpSuggestions(fallback)
          setFollowUpSuggestionsNotice(nextNotice)
          lastCheckSuggestionsRef.current = fallback
          lastCheckSuggestionsNoticeRef.current = nextNotice
          return { data: fallback, error: result.error }
        }

        setFollowUpSuggestions(result.data)
        setFollowUpSuggestionsNotice('')
        lastCheckSignatureRef.current = checkSignature
        lastCheckSuggestionsRef.current = result.data
        lastCheckSuggestionsNoticeRef.current = ''
        return { data: result.data, error: null }
      } catch (error) {
        console.error(error)
        const nextNotice = 'Suggested questions are unavailable right now.'
        setFollowUpSuggestions([])
        setFollowUpSuggestionsNotice(nextNotice)
        lastCheckSuggestionsRef.current = []
        lastCheckSuggestionsNoticeRef.current = nextNotice
        return { data: null, error: new Error(error.message || nextNotice) }
      } finally {
        setIsGeneratingFollowUpSuggestions(false)
      }
    },
    [profile, skillLevel, suggestFollowUpQuestions, userCode],
  )

  const runCodeCheck = useCallback(async ({ useCached = true } = {}) => {
    if (!currentTask) {
      return { data: null, error: new Error('No current task selected.') }
    }

    const taskIdAtStart = currentTask.id
    const checkSignature = `${currentTask.id}::${userCode}`

    if (
      useCached &&
      checkSignature === lastCheckSignatureRef.current &&
      lastCheckResultRef.current
    ) {
      setFeedbackError('')
      currentSessionHistoryRef.current = [{ role: 'ai', message: lastCheckResultRef.current.feedback }]
      setFeedbackHistory((prev) => [...prev, { role: 'ai', message: lastCheckResultRef.current.feedback }])
      setFollowUpSuggestions(lastCheckSuggestionsRef.current)
      setFollowUpSuggestionsNotice(lastCheckSuggestionsNoticeRef.current)
      setIsGeneratingFollowUpSuggestions(false)
      return { data: lastCheckResultRef.current, error: null }
    }

    setFeedbackError('')
    setIsCheckingCode(true)
    currentSessionHistoryRef.current = []
    setFollowUpSuggestions([])
    setFollowUpSuggestionsNotice('')
    setIsGeneratingFollowUpSuggestions(false)
    lastCheckSuggestionsRef.current = []
    lastCheckSuggestionsNoticeRef.current = ''

    try {
      const result = await checkUserCode(
        currentTask,
        userCode,
        profileToPromptContext(profile),
        skillLevel,
      )

      // Guard: if user switched tasks while the request was in flight, discard result
      if (currentTaskIdRef.current !== taskIdAtStart) {
        return { data: null, error: new Error('Task changed during code check.') }
      }

      if (result.error) {
        setFeedbackError(result.error.message)
        return { data: null, error: result.error }
      }

      lastCheckSignatureRef.current = checkSignature
      lastCheckResultRef.current = result.data
      currentSessionHistoryRef.current = [{ role: 'ai', message: result.data.feedback }]
      setFeedbackHistory((prev) => [...prev, { role: 'ai', message: result.data.feedback }])
      await loadFollowUpSuggestions(currentTask, checkSignature, result.data.feedback)
      return { data: result.data, error: null }
    } catch (error) {
      console.error(error)
      const normalizedError = new Error(error.message || 'Code check failed.')
      setFeedbackError(normalizedError.message)
      return { data: null, error: normalizedError }
    } finally {
      setIsCheckingCode(false)
    }
  }, [
    checkUserCode,
    currentTask,
    loadFollowUpSuggestions,
    profile,
    setFeedbackHistory,
    setIsCheckingCode,
    skillLevel,
    userCode,
  ])

  const handleCheckCode = useCallback(async () => {
    await runCodeCheck({ useCached: true })
  }, [runCodeCheck])

  const handleFollowUp = useCallback(
    async (userQuestion) => {
      if (!currentTask) {
        return { error: new Error('No current task selected.') }
      }

      const normalizedQuestion = userQuestion.trim()
      if (!normalizedQuestion) {
        return { error: new Error('Question is empty.') }
      }

      setFeedbackError('')
      setIsAskingFollowUp(true)

      setFeedbackHistory((prev) => [...prev, { role: 'user', message: normalizedQuestion }])

      const sessionContext = [
        ...currentSessionHistoryRef.current,
        { role: 'user', message: normalizedQuestion },
      ]

      try {
        const result = await askFollowUp(
          currentTask,
          userCode,
          normalizedQuestion,
          sessionContext,
          skillLevel,
          profileToPromptContext(profile),
        )

        if (result.error) {
          setFeedbackError(result.error.message)
          return { error: result.error }
        }

        currentSessionHistoryRef.current = [...sessionContext, { role: 'ai', message: result.data }]
        setFeedbackHistory((prev) => [...prev, { role: 'ai', message: result.data }])
        return { error: null }
      } catch (error) {
        console.error(error)
        setFeedbackError(error.message || 'Follow-up request failed.')
        return { error }
      } finally {
        setIsAskingFollowUp(false)
      }
    },
    [
      askFollowUp,
      currentTask,
      profile,
      skillLevel,
      setFeedbackHistory,
      setIsAskingFollowUp,
      userCode,
    ],
  )

  useEffect(() => {
    lastCheckSignatureRef.current = ''
    lastCheckResultRef.current = null
    lastCheckSuggestionsRef.current = []
    lastCheckSuggestionsNoticeRef.current = ''
    currentSessionHistoryRef.current = []
  }, [currentTask?.id, userCode])

  const handleMarkCurrentTaskComplete = useCallback(async () => {
    if (!currentTask || isMarkingTaskComplete) {
      return
    }

    setUiError('')
    setFeedbackError('')
    setIsMarkingTaskComplete(true)
    const syncTasksFromDb = async () => {
      if (!currentProjectId) {
        return
      }

      const { data: syncedTasks, error: syncError } = await getProjectTasks(currentProjectId)
      if (syncError || !Array.isArray(syncedTasks)) {
        return
      }

      setTasks(syncedTasks.map(normalizeTask))
    }

    try {
      if (currentTask.completed) {
        const { error: taskError } = await markTaskIncompleteInDb(currentTask.id, appUser?.id)
        if (taskError) {
          console.error(taskError)
          setUiError(taskError.message || 'Could not undo task completion in database.')
          return
        }

        if (currentProjectId) {
          const { error: projectError } = await markProjectIncomplete(currentProjectId, appUser?.id)
          if (projectError) {
            const { error: rollbackError } = await markTaskCompleteInDb(currentTask.id, appUser?.id)
            console.error(projectError)
            if (rollbackError) {
              console.error(rollbackError)
              await syncTasksFromDb()
              setUiError(
                'Could not update project completion state, and task rollback failed. Please refresh and try again.',
              )
            } else {
              setUiError(projectError.message || 'Could not update project completion state.')
            }
            return
          }
        }

        markTaskIncomplete(currentTask.id)
        return
      }

      const checkSignature = `${currentTask.id}::${userCode}`
      let validationResult = null

      if (
        checkSignature === lastCheckSignatureRef.current &&
        lastCheckResultRef.current
      ) {
        validationResult = lastCheckResultRef.current
        currentSessionHistoryRef.current = [{ role: 'ai', message: validationResult.feedback }]
        setFeedbackHistory((prev) => [...prev, { role: 'ai', message: validationResult.feedback }])
      } else {
        setIsCheckingBeforeComplete(true)
        const checkResult = await runCodeCheck({ useCached: true })
        setIsCheckingBeforeComplete(false)

        if (checkResult.error || !checkResult.data) {
          return
        }

        validationResult = checkResult.data
      }

      const hasPassingValidation = validationResult?.status === 'PASS'

      if (!hasPassingValidation) {
        const validationDetails = [
          validationResult?.feedback,
          validationResult?.outputReason,
        ]
          .filter(Boolean)
          .join(' ')

        setUiError(
          validationDetails
            ? `Task is not ready to complete yet. ${validationDetails}`
            : 'Task is not ready to complete yet. Fix the check feedback and try again.',
        )
        return
      }

      const { error: taskError } = await markTaskCompleteInDb(currentTask.id, appUser?.id)
      if (taskError) {
        console.error(taskError)
        setUiError(taskError.message || 'Could not update task status in database.')
        return
      }

      const updatedTasks = tasks.map((task) =>
        task.id === currentTask.id ? { ...task, completed: true } : task,
      )
      markTaskComplete(currentTask.id)

      const nextTaskIndex = updatedTasks.findIndex((task) => !task.completed)

      if (nextTaskIndex === -1) {
        if (currentProjectId) {
          const { error: projectError } = await markProjectComplete(currentProjectId, appUser?.id)
          if (projectError) {
            const { error: rollbackError } = await markTaskIncompleteInDb(currentTask.id, appUser?.id)
            console.error(projectError)
            if (rollbackError) {
              console.error(rollbackError)
              await syncTasksFromDb()
              setUiError(
                'Could not mark project complete, and task rollback failed. Please refresh and try again.',
              )
            } else {
              markTaskIncomplete(currentTask.id)
              setUiError(projectError.message || 'Could not mark project complete.')
            }
            return
          }
        }

        if (user) {
          await loadProjects(user.id)
        }

        setScreen('completion')
        return
      }

      setCurrentTaskIndex(nextTaskIndex)
      resetTaskSupportState()
      setFeedbackError('')
    } catch (error) {
      console.error(error)
      setUiError(error.message || 'Could not complete task.')
    } finally {
      setIsCheckingBeforeComplete(false)
      setIsMarkingTaskComplete(false)
    }
  }, [
    appUser?.id,
    currentProjectId,
    currentTask,
    isMarkingTaskComplete,
    loadProjects,
    markTaskComplete,
    markTaskIncomplete,
    resetTaskSupportState,
    runCodeCheck,
    setCurrentTaskIndex,
    setFeedbackHistory,
    setTasks,
    tasks,
    user,
    userCode,
  ])

  const handleBackToDashboard = useCallback(async () => {
    hashRestoreNonceRef.current += 1
    isHashRestoreInProgressRef.current = false
    hasAttemptedHashRestoreRef.current = true
    replaceHashUrl('#/dashboard')
    lastNavigationIdentityRef.current = 'dashboard'
    resetApp()
    setIsEditingProfile(false)
    setCurrentProjectTitle('')
    setScreen('dashboard')
    setUiError('')
    setFeedbackError('')
    setPreviewSrcDoc('')
    setPreviewError('')
    setProjectTitleStatusMessage('')
    setFollowUpSuggestions([])
    setFollowUpSuggestionsNotice('')
    setIsGeneratingFollowUpSuggestions(false)
    setProjectFilesStorageWarning('')
    setProjectFilesStorageMode('supabase')

    if (user) {
      await loadProjects(user.id)
    }
  }, [loadProjects, resetApp, user])

  const handleEditProfile = useCallback(() => {
    setUiError('')
    setIsEditingProfile(true)
    setScreen('profile-onboarding')
  }, [])

  const handleReopenLastTaskFromCompletion = useCallback(async () => {
    if (isMarkingTaskComplete || tasks.length === 0) {
      return
    }

    let reopenTaskIndex = -1
    for (let index = tasks.length - 1; index >= 0; index -= 1) {
      if (tasks[index]?.completed) {
        reopenTaskIndex = index
        break
      }
    }

    if (reopenTaskIndex === -1) {
      setUiError('No completed task is available to reopen.')
      return
    }

    const reopenTask = tasks[reopenTaskIndex]
    if (!reopenTask?.id) {
      setUiError('Could not identify which task to reopen.')
      return
    }

    setUiError('')
    setIsMarkingTaskComplete(true)

    try {
      const { error: taskError } = await markTaskIncompleteInDb(reopenTask.id, appUser?.id)
      if (taskError) {
        console.error(taskError)
        setUiError(taskError.message || 'Could not reopen task in database.')
        return
      }

      if (currentProjectId) {
        const { error: projectError } = await markProjectIncomplete(currentProjectId, appUser?.id)
        if (projectError) {
          console.error(projectError)
          const { error: rollbackError } = await markTaskCompleteInDb(reopenTask.id, appUser?.id)
          if (rollbackError) {
            console.error(rollbackError)
            setUiError(
              'Could not update project completion state, and task rollback failed. Please refresh and try again.',
            )
          } else {
            setUiError(projectError.message || 'Could not update project completion state.')
          }
          return
        }
      }

      markTaskIncomplete(reopenTask.id)
      setCurrentTaskIndex(reopenTaskIndex)
      resetTaskSupportState()
      setFeedbackError('')
      setScreen('workspace')
    } catch (error) {
      console.error(error)
      setUiError(error.message || 'Could not reopen task.')
    } finally {
      setIsMarkingTaskComplete(false)
    }
  }, [
    appUser?.id,
    currentProjectId,
    isMarkingTaskComplete,
    markTaskIncomplete,
    resetTaskSupportState,
    setCurrentTaskIndex,
    tasks,
  ])

  useEffect(() => {
    if (typeof window === 'undefined' || !appUser?.id || !hasAttemptedHashRestoreRef.current) {
      return
    }

    const handleBrowserNavigation = () => {
      const hashState = parseHashWorkspaceState()

      if (hashState.screen === 'dashboard') {
        if (screen !== 'dashboard' || tasks.length > 0 || currentProjectId) {
          void handleBackToDashboard()
        }
        return
      }

      if (hashState.screen === 'new-project') {
        if (screen !== 'new-project' || tasks.length > 0 || currentProjectId) {
          handleStartNewProject()
        }
        return
      }

      if (
        (hashState.screen !== 'workspace' && hashState.screen !== 'completion') ||
        !hashState.projectId
      ) {
        void handleBackToDashboard()
        return
      }

      if (isHashRestoreInProgressRef.current) {
        return
      }

      const isSameProjectScreen =
        currentProjectId === hashState.projectId &&
        (screen === 'workspace' || screen === 'completion')

      if (isSameProjectScreen) {
        return
      }

      const matchingProject = projects.find((project) => project.id === hashState.projectId)
      if (!matchingProject) {
        void handleBackToDashboard()
        return
      }

      void handleContinueProject(matchingProject, {
        preferredTaskIndex: hashState.taskIndex,
        preferredActiveFilePath: hashState.filePath,
      })
    }

    window.addEventListener('popstate', handleBrowserNavigation)
    window.addEventListener('hashchange', handleBrowserNavigation)

    return () => {
      window.removeEventListener('popstate', handleBrowserNavigation)
      window.removeEventListener('hashchange', handleBrowserNavigation)
    }
  }, [
    appUser?.id,
    currentProjectId,
    handleBackToDashboard,
    handleContinueProject,
    handleStartNewProject,
    projects,
    screen,
    tasks.length,
  ])

  let markAsCompleteLabel = 'Mark as Complete'
  if (isCheckingBeforeComplete) {
    markAsCompleteLabel = 'Checking before completion...'
  } else if (isMarkingTaskComplete) {
    markAsCompleteLabel = 'Updating task status...'
  } else if (currentTask?.completed) {
    markAsCompleteLabel = 'Undo Complete'
  }

  if (isShowingSignupConfigureLoader) {
    return <ConfigureDojoLoadingScreen />
  }

  if (isAuthenticatingState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10">
        <section className="max-w-lg text-center">
          <p className="text-xl font-semibold text-slate-900">Loading BuildDojo...</p>
          <p className="mt-2 text-sm text-slate-600">
            Verifying your session. If this takes too long, refresh and check Supabase env vars.
          </p>
        </section>
      </main>
    )
  }

  if (!appUser) {
    if (preAuthScreen === 'landing') {
      return <LandingPage onGetStarted={() => handleOpenAuthScreen('signup')} />
    }

    return (
      <AuthScreen
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onContinueWithGoogle={handleContinueWithGoogle}
        onResendConfirmation={handleResendConfirmation}
        initialMode={authInitialMode}
        onBackToLanding={handleBackToLanding}
        isAuthenticating={isAuthenticating}
        authError={authError || uiError}
        authInfo={authInfo}
      />
    )
  }

  if (screen === 'profile-onboarding') {
    return (
      <ProfileOnboarding
        initialProfile={profile}
        onComplete={handleCompleteProfile}
        isSaving={isSavingProfile}
        errorMessage={uiError}
        isEditing={isEditingProfile}
        onExit={isEditingProfile ? handleBackToDashboard : null}
      />
    )
  }

  if (screen === 'dashboard' && tasks.length === 0 && !currentProjectId) {
    return (
      <Dashboard
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        deletingProjectId={deletingProjectId}
        isBackfillingProjectTitles={isBackfillingProjectTitles}
        projectTitleStatusMessage={projectTitleStatusMessage}
        onStartNewProject={handleStartNewProject}
        onEditProfile={handleEditProfile}
        onContinueProject={handleContinueProject}
        onDeleteProject={handleDeleteProject}
        onLogOut={handleLogOut}
        errorMessage={uiError}
      />
    )
  }

  if (screen === 'new-project' && tasks.length === 0 && !currentProjectId) {
    return (
      <Onboarding
        onSubmit={handleGenerateRoadmap}
        onSuggestLanguages={suggestProjectLanguages}
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        deletingProjectId={deletingProjectId}
        isBackfillingProjectTitles={isBackfillingProjectTitles}
        projectTitleStatusMessage={projectTitleStatusMessage}
        onContinueProject={handleContinueProject}
        onDeleteProject={handleDeleteProject}
        onLogOut={handleLogOut}
        onBackToDashboard={handleBackToDashboard}
        onEditProfile={handleEditProfile}
        user={appUser}
        isGeneratingRoadmap={isGeneratingRoadmap}
        errorMessage={uiError}
        defaultDescription={projectDescription}
      />
    )
  }

  if (screen === 'completion' || isAllTasksComplete) {
    return (
      <CompletionScreen
        onBackToDashboard={handleBackToDashboard}
        onStartNew={handleStartNewProject}
        onReopenLastTask={handleReopenLastTaskFromCompletion}
        isReopeningTask={isMarkingTaskComplete}
      />
    )
  }

  if (screen !== 'workspace') {
    return (
      <Dashboard
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        deletingProjectId={deletingProjectId}
        isBackfillingProjectTitles={isBackfillingProjectTitles}
        projectTitleStatusMessage={projectTitleStatusMessage}
        onStartNewProject={handleStartNewProject}
        onEditProfile={handleEditProfile}
        onContinueProject={handleContinueProject}
        onDeleteProject={handleDeleteProject}
        onLogOut={handleLogOut}
        errorMessage={uiError}
      />
    )
  }

  const showWorkspaceStatus =
    uiError ||
    isLoadingProjects ||
    isLoadingProfile ||
    isSavingProfile ||
    isGeneratingRoadmap ||
    isCheckingCode ||
    isCheckingBeforeComplete ||
    isMarkingTaskComplete ||
    isAskingFollowUp ||
    isSavingFiles ||
    projectFilesStorageWarning ||
    fileError ||
    fileNotice

  const isLeftDragActive = activeDragType === 'left'
  const isRightDragActive = activeDragType === 'right'
  const isCenterDragActive =
    activeDragType === 'center' || activeDragType === 'center-bottom'
  const isCenterBottomDragActive = activeDragType === 'center-bottom'
  const leftDesktopWidth = leftCollapsed ? `${railWidthPx}px` : `${leftWidthPct}%`
  const rightDesktopWidth = rightCollapsed ? `${railWidthPx}px` : `${rightWidthPct}%`
  const leftPaneStyle = isDesktopLayout
    ? {
      flex: `0 0 ${leftDesktopWidth}`,
      width: leftDesktopWidth,
    }
    : undefined
  const rightPaneStyle = isDesktopLayout
    ? {
      flex: `0 0 ${rightDesktopWidth}`,
      width: rightDesktopWidth,
    }
    : undefined
  const editorHeight = isDesktopLayout ? `${editorHeightPx}px` : undefined

  const leftWorkspacePane = (
    <ErrorBoundary zone="file explorer">
      <FileTree
        files={projectFiles}
        activeFileId={activeFile?.id || null}
        onSelectFile={handleSelectFile}
        onCreateFile={handleCreateFile}
        onRenameFile={handleRenameFile}
        onDeleteFile={handleDeleteFile}
        isBusy={isSavingFiles || isImporting || isExporting}
        errorMessage={fileError}
      />

      <div className="mt-8">
        <Roadmap
          tasks={tasks}
          currentTaskIndex={currentTaskIndex}
          onSelectTask={handleSelectTask}
        />
      </div>
    </ErrorBoundary>
  )

  const consolePane = (
    <ErrorBoundary zone="code runner">
      <RunConsole
        key={currentTask?.id || 'run-console'}
        code={userCode}
        detectedLanguage={detectedLanguage}
        fileLanguage={activeFileLanguage}
        lockedLanguage={lockedTaskLanguage}
        projectLanguages={projectLanguages}
        projectFiles={projectFiles}
        activeFilePath={activeFile?.path || ''}
        hasLockedLanguageMismatch={hasLockedLanguageMismatch}
        onResolveLockedLanguageMismatch={handleResolveTaskLanguageMismatch}
        onRunPreview={handleRunPreview}
        onCheckCode={handleCheckCode}
        fillHeight={isDesktopLayout && !showHtmlPreview}
      />
    </ErrorBoundary>
  )

  const previewPane = showHtmlPreview ? (
    <section className="flex min-h-64 flex-col gap-2 rounded-xl border border-slate-300 bg-white p-3">
      <h2 className="text-lg font-semibold text-slate-900">Live Preview</h2>
      <PreviewPanel
        srcDoc={previewSrcDoc}
        error={previewError}
        onPreviewConsole={handlePreviewConsole}
      />
    </section>
  ) : null

  // Combined console + preview for non-tabbed layouts (mobile, non-HTML projects)
  const runAndPreviewPane = (
    <>
      {consolePane}
      {previewPane}
    </>
  )

  const rightWorkspacePane = (
    <ErrorBoundary zone="mentor panel">
      <div className="flex flex-col gap-4">
        <section className="rounded-xl border border-slate-300 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Task {currentTaskIndex + 1}
              </p>
              <h2 className="truncate text-base font-semibold text-slate-900">
                {currentTask?.title || 'No task selected'}
              </h2>
            </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
            onClick={() => setIsTaskCardExpanded((prev) => !prev)}
            aria-expanded={isTaskCardExpanded}
            aria-label={isTaskCardExpanded ? 'Collapse task details' : 'Expand task details'}
          >
            {isTaskCardExpanded ? '-' : '+'}
          </button>
        </div>

        {isTaskCardExpanded ? (
          <p className="mt-2 text-sm text-slate-700">
            {taskDescription || 'Task details appear here.'}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            {taskDescriptionPreview || 'Task details appear here.'}
          </p>
        )}
        {!isTaskCardExpanded && isTaskDescriptionTruncated ? (
          <p className="mt-1 text-xs text-slate-500">Tap + to view full task details.</p>
        ) : null}

        <button
          type="button"
          className={`${buttonPrimary} mt-2 w-full rounded-md border-emerald-600 bg-emerald-500 px-3 py-1.5 text-xs hover:border-emerald-500 hover:bg-emerald-400`}
          onClick={handleMarkCurrentTaskComplete}
          disabled={
            !currentTask ||
            isCheckingCode ||
            isCheckingBeforeComplete ||
            isMarkingTaskComplete
          }
        >
          {markAsCompleteLabel}
        </button>
      </section>

      <HintBox
        task={currentTask}
        hintsUsed={hintsUsed}
        exampleViewed={exampleViewed}
        onGiveHint={incrementHints}
        onShowExample={() => setExampleViewed((prev) => !prev)}
        isDisabled={!currentTask}
      />
      <FeedbackPanel
        feedbackHistory={feedbackHistory}
        isCheckingCode={isCheckingCode}
        isAskingFollowUp={isAskingFollowUp}
        followUpSuggestions={followUpSuggestions}
        isGeneratingFollowUpSuggestions={isGeneratingFollowUpSuggestions}
        followUpSuggestionsNotice={followUpSuggestionsNotice}
        onCheckCode={handleCheckCode}
        onAskFollowUp={handleFollowUp}
        errorMessage={feedbackError}
      />
      </div>
    </ErrorBoundary>
  )

  return (
    <main className="min-h-svh bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src={workspaceLogo} alt="BuildDojo" className="h-8 w-8 object-contain" />
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              {workspaceTitle}
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${buttonSecondary} ${sizeSm} rounded-xl px-5 py-2`}
              onClick={handleExportProject}
              disabled={isExporting || isImporting || projectFiles.length === 0}
            >
              {isExporting ? 'Exporting...' : 'Download'}
            </button>
            <button
              type="button"
              className={`${buttonSecondary} ${sizeSm} rounded-xl px-5 py-2`}
              onClick={handleImportClick}
              disabled={isImporting || isExporting}
            >
              {isImporting ? 'Importing...' : 'Import'}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/zip,.zip"
              className="hidden"
              onChange={handleImportProject}
            />
            <button
              type="button"
              className={`${buttonSecondary} ${sizeSm} rounded-xl px-5 py-2`}
              onClick={handleBackToDashboard}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`${buttonDanger} ${sizeSm} rounded-xl px-5 py-2`}
              onClick={handleLogOut}
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <ProgressBar completedCount={completedCount} totalCount={tasks.length} />

      {showWorkspaceStatus ? (
        <section className="border-b border-slate-200 bg-white px-4 py-2 text-sm md:px-6">
          {uiError && <p className="text-red-600">{uiError}</p>}
          {isLoadingProjects && <p>Loading projects...</p>}
          {isLoadingProfile && <p>Loading profile...</p>}
          {isSavingProfile && <p>Saving profile...</p>}
          {isGeneratingRoadmap && <p>Generating roadmap...</p>}
          {isCheckingCode && !isCheckingBeforeComplete && <p>Checking code...</p>}
          {isCheckingBeforeComplete && <p>Checking code before completion...</p>}
          {isMarkingTaskComplete && !isCheckingBeforeComplete && <p>Updating task status...</p>}
          {isAskingFollowUp && <p>Getting mentor reply...</p>}
          {isSavingFiles && <p>Saving project files...</p>}
          {projectFilesStorageWarning && (
            <p className="text-amber-700">{projectFilesStorageWarning}</p>
          )}
          {fileError && <p className="text-red-600">{fileError}</p>}
          {fileNotice && <p className="text-emerald-700">{fileNotice}</p>}
        </section>
      ) : null}

      <section
        ref={workspaceRef}
        className="flex flex-col md:h-[calc(100svh-150px)] md:flex-row md:items-stretch"
      >
        <aside
          className={`border-b border-slate-200 bg-white p-4 md:h-[calc(100svh-150px)] md:border-b-0 md:overflow-auto ${
            isDesktopLayout && !leftCollapsed ? 'md:border-r' : ''
          }`}
          style={leftPaneStyle}
        >
          {isDesktopLayout && leftCollapsed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-100"
                onClick={toggleLeftCollapsed}
                aria-label="Expand left pane"
              >
                &gt;
              </button>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 [writing-mode:vertical-rl]">
                Explorer
              </p>
            </div>
          ) : (
            leftWorkspacePane
          )}
        </aside>

        <div
          className="group relative hidden shrink-0 cursor-col-resize items-center justify-center md:flex"
          style={{ width: `${splitterSizePx}px` }}
          onPointerDown={beginLeftResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left pane"
        >
          <div
            className={`h-full w-px bg-slate-300 transition-opacity ${
              isLeftDragActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          />
          {!leftCollapsed ? (
            <button
              type="button"
              className={`absolute left-1/2 top-1/2 inline-flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-sm transition-opacity hover:bg-slate-100 ${
                isLeftDragActive
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
              }`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={toggleLeftCollapsed}
              aria-label="Collapse left pane"
            >
              {'<'}
            </button>
          ) : null}
        </div>

        <div
          ref={centerPaneRef}
          className="flex min-w-0 flex-1 flex-col gap-3 border-b border-slate-200 bg-white p-3 md:h-[calc(100svh-150px)] md:border-b-0 md:border-r md:p-4"
        >
          <ErrorBoundary zone="editor">
          {isDesktopLayout && showHtmlPreview ? (
            <CenterPaneTabs
              codeContent={
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <Editor
                    projectDescription={projectDescription}
                    value={activeFile?.content || ''}
                    onChange={handleEditorChange}
                    readOnly={Boolean(currentTask?.completed) && firstIncompleteIndex !== -1}
                    language={editorLanguage}
                    tabs={fileTabs}
                    activeTabId={activeFile?.id || null}
                    onSelectTab={handleSelectFile}
                    height="100%"
                  />
                </div>
              }
              previewContent={
                <PreviewPanel
                  srcDoc={previewSrcDoc}
                  error={previewError}
                  onPreviewConsole={handlePreviewConsole}
                />
              }
              consoleContent={consolePane}
            />
          ) : (
            <>
              <div className={isDesktopLayout ? 'min-h-0 shrink-0' : ''}>
                <Editor
                  projectDescription={projectDescription}
                  value={activeFile?.content || ''}
                  onChange={handleEditorChange}
                  readOnly={Boolean(currentTask?.completed) && firstIncompleteIndex !== -1}
                  language={editorLanguage}
                  tabs={fileTabs}
                  activeTabId={activeFile?.id || null}
                  onSelectTab={handleSelectFile}
                  height={editorHeight}
                />
              </div>

              {isDesktopLayout && !bottomPaneCollapsed ? (
                <div
                  className="group relative -my-1 flex h-2 shrink-0 cursor-row-resize items-center justify-center"
                  onPointerDown={beginCenterResize}
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Resize editor and output panes"
                >
                  <div
                    className={`h-px w-full bg-slate-300 transition-opacity ${
                      isCenterDragActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                  <button
                    type="button"
                    className={`absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-sm transition-opacity hover:bg-slate-100 ${
                      isCenterDragActive
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                    }`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={toggleBottomPaneCollapsed}
                    aria-label="Collapse run and output pane"
                  >
                    -
                  </button>
                </div>
              ) : null}

              {isDesktopLayout ? (
                bottomPaneCollapsed ? (
                  <div className="flex h-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-50">
                    <button
                      type="button"
                      className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={toggleBottomPaneCollapsed}
                    >
                      Expand Run &amp; Output
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      {runAndPreviewPane}
                    </div>
                    <div
                      className="group relative mt-1 flex h-2 shrink-0 cursor-row-resize items-center justify-center"
                      onPointerDown={beginCenterBottomResize}
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Resize output pane from bottom edge"
                    >
                      <div
                        className={`h-px w-full bg-slate-300 transition-opacity ${
                          isCenterBottomDragActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      />
                    </div>
                  </div>
                )
              ) : (
                runAndPreviewPane
              )}
            </>
          )}
          </ErrorBoundary>
        </div>

        <div
          className="group relative hidden shrink-0 cursor-col-resize items-center justify-center md:flex"
          style={{ width: `${splitterSizePx}px` }}
          onPointerDown={beginRightResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right pane"
        >
          <div
            className={`h-full w-px bg-slate-300 transition-opacity ${
              isRightDragActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          />
          {!rightCollapsed ? (
            <button
              type="button"
              className={`absolute left-1/2 top-1/2 inline-flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 shadow-sm transition-opacity hover:bg-slate-100 ${
                isRightDragActive
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
              }`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={toggleRightCollapsed}
              aria-label="Collapse right pane"
            >
              {'>'}
            </button>
          ) : null}
        </div>

        <aside
          className="bg-white p-4 md:h-[calc(100svh-150px)] md:overflow-auto"
          style={rightPaneStyle}
        >
          {isDesktopLayout && rightCollapsed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-100"
                onClick={toggleRightCollapsed}
                aria-label="Expand right pane"
              >
                &lt;
              </button>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 [writing-mode:vertical-rl]">
                Mentor
              </p>
            </div>
          ) : (
            rightWorkspacePane
          )}
        </aside>
      </section>
    </main>
  )
}

export default App
