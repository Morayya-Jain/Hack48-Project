import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import CompletionScreen from './components/CompletionScreen'
import Dashboard from './components/Dashboard'
import Editor from './components/Editor'
import FeedbackPanel from './components/FeedbackPanel'
import FileTree from './components/FileTree'
import HintBox from './components/HintBox'
import Onboarding from './components/Onboarding'
import ProgressBar from './components/ProgressBar'
import Roadmap from './components/Roadmap'
import RunConsole from './components/RunConsole'
import { useAppState } from './hooks/useAppState'
import { useAuth } from './hooks/useAuth'
import { useGemini } from './hooks/useGemini'
import {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  sizeSm,
} from './lib/buttonStyles'
import {
  createProject,
  createProjectFiles,
  deleteProjectFile,
  markProjectIncomplete,
  getProjectFiles,
  getProjectTasks,
  getUserProjects,
  markProjectComplete,
  markTaskComplete as markTaskCompleteInDb,
  markTaskIncomplete as markTaskIncompleteInDb,
  replaceProjectFiles,
  saveTasks,
  upsertProjectFile,
} from './lib/db'
import { detectLanguage } from './lib/detectLanguage'
import {
  buildExportPackage,
  buildPreviewSrcDoc,
  createDefaultProjectFiles,
  editorLanguageFromFile,
  fileNameFromPath,
  normalizeProjectFiles,
  parseImportPackage,
  runtimeLanguageFromPath,
  sanitizeFilePath,
  toPersistedFiles,
} from './lib/projectFiles'
import { sanitizeLanguage } from './lib/runtimeUtils'

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

function isProjectFilesTableMissing(error) {
  const message = error?.message || ''
  return /project_files|schema cache|relation .*project_files|Could not find the 'project_files'|does not exist/i.test(
    message,
  )
}

function App() {
  const {
    user,
    isAuthenticating,
    authError,
    authInfo,
    setAuthError,
    signIn,
    signOut,
    signUp,
    resendConfirmation,
  } = useAuth()

  const { generateRoadmap, checkUserCode, askFollowUp } = useGemini()

  const {
    user: appUser,
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
    isAuthenticating: isAuthenticatingState,
    isSavingFiles,
    fileError,
    isImporting,
    isExporting,
    setUser,
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
    setIsAuthenticating,
    setIsSavingFiles,
    setFileError,
    setIsImporting,
    setIsExporting,
    setFeedbackHistory,
  } = useAppState()

  const [projects, setProjects] = useState([])
  const [screen, setScreen] = useState('dashboard')
  const [uiError, setUiError] = useState('')
  const [previewSrcDoc, setPreviewSrcDoc] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [isCheckingBeforeComplete, setIsCheckingBeforeComplete] = useState(false)
  const [isMarkingTaskComplete, setIsMarkingTaskComplete] = useState(false)
  const lastCheckSignatureRef = useRef('')
  const lastCheckResultRef = useRef(null)
  const saveTimeoutRef = useRef(null)
  const lastSavedFileContentRef = useRef({})
  const importInputRef = useRef(null)

  useEffect(() => {
    setUser(user)
  }, [setUser, user])

  useEffect(() => {
    setIsAuthenticating(isAuthenticating)
  }, [isAuthenticating, setIsAuthenticating])

  const loadProjects = useCallback(
    async (userId, autoRoute = false) => {
      setIsLoadingProjects(true)

      const { data, error } = await getUserProjects(userId)

      if (error) {
        console.error(error)
        setUiError(error.message || 'Could not load projects.')
        setIsLoadingProjects(false)
        return
      }

      const safeProjects = data ?? []
      setProjects(safeProjects)

      if (autoRoute) {
        setScreen(safeProjects.length === 0 ? 'onboarding' : 'dashboard')
      }

      setIsLoadingProjects(false)
    },
    [setIsLoadingProjects],
  )

  useEffect(() => {
    if (!user) {
      setProjects([])
      setScreen('dashboard')
      resetApp()
      return
    }

    loadProjects(user.id, true)
  }, [loadProjects, resetApp, user])

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

  const bootstrapProjectFiles = useCallback(
    async ({ projectId, ownerId, description, fallbackCode = '' }) => {
      const defaultFiles = createDefaultProjectFiles(description, fallbackCode)
      setFileError('')

      try {
        const { data: filesData, error: filesError } = await getProjectFiles(projectId)

        if (filesError) {
          if (isProjectFilesTableMissing(filesError)) {
            setFileError(
              'Project file storage is not configured in Supabase yet. Run the SQL setup block for project_files.',
            )
            syncWorkspaceFiles(defaultFiles)
            return
          }

          console.error(filesError)
          setFileError(filesError.message || 'Could not load project files.')
          syncWorkspaceFiles(defaultFiles)
          return
        }

        const normalizedExistingFiles = normalizeProjectFiles(filesData ?? [])
        if (normalizedExistingFiles.length > 0) {
          syncWorkspaceFiles(normalizedExistingFiles)
          return
        }

        const initialPayload = toPersistedFiles(defaultFiles, projectId, ownerId)
        const { data: createdFiles, error: createError } = await createProjectFiles(
          projectId,
          ownerId,
          initialPayload,
        )

        if (createError) {
          if (isProjectFilesTableMissing(createError)) {
            setFileError(
              'Project file storage is not configured in Supabase yet. Run the SQL setup block for project_files.',
            )
          } else {
            console.error(createError)
            setFileError(createError.message || 'Could not initialize project files.')
          }

          syncWorkspaceFiles(defaultFiles)
          return
        }

        syncWorkspaceFiles(createdFiles ?? defaultFiles)
      } catch (error) {
        console.error(error)
        setFileError(error.message || 'Could not initialize project files.')
        syncWorkspaceFiles(defaultFiles)
      }
    },
    [setFileError, syncWorkspaceFiles],
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
    async (email, password) => {
      const { error } = await signUp(email, password)
      if (error) {
        setUiError(error.message || 'Sign up failed.')
        return
      }

      setUiError('')
    },
    [signUp],
  )

  const handleLogOut = useCallback(async () => {
    const { error } = await signOut()
    if (error) {
      setUiError(error.message || 'Log out failed.')
      return
    }

    resetApp()
    setProjects([])
    setScreen('dashboard')
    setUiError('')
    setPreviewSrcDoc('')
    setPreviewError('')
    setAuthError(null)
  }, [resetApp, setAuthError, signOut])

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
    resetApp()
    setUiError('')
    setPreviewSrcDoc('')
    setPreviewError('')
    setScreen('onboarding')
  }, [resetApp])

  const handleGenerateRoadmap = useCallback(
    async (description, nextSkillLevel) => {
      if (!user) {
        setUiError('You must be logged in to create a project.')
        return
      }

      setUiError('')
      setIsGeneratingRoadmap(true)
      setProjectDescription(description)
      setSkillLevel(nextSkillLevel)

      try {
        const roadmapResult = await generateRoadmap(description, nextSkillLevel)
        if (roadmapResult.error) {
          setUiError(roadmapResult.error.message)
          return
        }

        const { data: projectData, error: projectError } = await createProject(
          user.id,
          description,
          nextSkillLevel,
        )

        if (projectError || !projectData) {
          console.error(projectError)
          setUiError(projectError?.message || 'Could not create project.')
          return
        }

        const { data: savedTaskData, error: saveError } = await saveTasks(
          projectData.id,
          user.id,
          roadmapResult.data,
        )

        if (saveError || !savedTaskData) {
          console.error(saveError)
          setUiError(saveError?.message || 'Could not save tasks.')
          return
        }

        const normalizedTasks = savedTaskData.map(normalizeTask)

        setCurrentProjectId(projectData.id)
        setTasks(normalizedTasks)
        setCurrentTaskIndex(0)
        resetTaskSupportState()
        setPreviewSrcDoc('')
        setPreviewError('')
        await bootstrapProjectFiles({
          projectId: projectData.id,
          ownerId: user.id,
          description,
          fallbackCode: '',
        })

        await loadProjects(user.id)
        setScreen('workspace')
      } catch (error) {
        console.error(error)
        setUiError(error.message || 'Roadmap generation failed.')
      } finally {
        setIsGeneratingRoadmap(false)
      }
    },
    [
      generateRoadmap,
      bootstrapProjectFiles,
      loadProjects,
      resetTaskSupportState,
      setCurrentProjectId,
      setCurrentTaskIndex,
      setIsGeneratingRoadmap,
      setProjectDescription,
      setSkillLevel,
      setTasks,
      user,
    ],
  )

  const handleContinueProject = useCallback(
    async (project) => {
      setUiError('')
      setIsLoadingProjects(true)

      try {
        const { data, error } = await getProjectTasks(project.id)
        if (error) {
          console.error(error)
          setUiError(error.message || 'Could not load project tasks.')
          return
        }

        const normalizedTasks = (data ?? []).map(normalizeTask)
        const firstIncomplete = normalizedTasks.findIndex((task) => !task.completed)

        setCurrentProjectId(project.id)
        setProjectDescription(project.description)
        setSkillLevel(project.skill_level)
        setTasks(normalizedTasks)
        setCurrentTaskIndex(firstIncomplete === -1 ? 0 : firstIncomplete)
        resetTaskSupportState()
        setPreviewSrcDoc('')
        setPreviewError('')
        await bootstrapProjectFiles({
          projectId: project.id,
          ownerId: appUser.id,
          description: project.description,
          fallbackCode: '',
        })

        if (firstIncomplete === -1 && normalizedTasks.length > 0) {
          setScreen('completion')
        } else {
          setScreen('workspace')
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
      bootstrapProjectFiles,
      setCurrentProjectId,
      setCurrentTaskIndex,
      setIsLoadingProjects,
      setProjectDescription,
      setSkillLevel,
      setTasks,
    ],
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
    async (fileToSave) => {
      if (!currentProjectId || !appUser) {
        return
      }

      const payload = toPersistedFiles([fileToSave], currentProjectId, appUser.id)[0]
      if (!payload) {
        return
      }

      setIsSavingFiles(true)
      setFileError('')

      try {
        const { data, error } = await upsertProjectFile(payload)
        if (error) {
          if (isProjectFilesTableMissing(error)) {
            setFileError(
              'Project file storage is not configured in Supabase yet. Run the SQL setup block for project_files.',
            )
            return
          }

          console.error(error)
          setFileError(error.message || 'Could not save file.')
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
        setIsSavingFiles(false)
      }
    },
    [
      activeFileId,
      appUser,
      currentProjectId,
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
      persistProjectFile(activeFile)
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

      if (projectFiles.some((file) => file.path === safePath)) {
        setFileError('A file with this path already exists.')
        return
      }

      const nextFile = {
        id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        path: safePath,
        name: fileNameFromPath(safePath),
        language: runtimeLanguageFromPath(safePath) || 'javascript',
        content: '',
        sort_index: projectFiles.length,
      }

      setFileError('')
      setProjectFiles((prev) => normalizeProjectFiles([...prev, nextFile]))
      setActiveFileId(nextFile.id)
      updateUserCode('')
      lastSavedFileContentRef.current[nextFile.id] = ''

      await persistProjectFile(nextFile)
    },
    [persistProjectFile, projectFiles, setActiveFileId, setFileError, setProjectFiles, updateUserCode],
  )

  const handleRenameFile = useCallback(
    async (fileId, rawPath) => {
      const safePath = sanitizeFilePath(rawPath)
      if (!safePath) {
        setFileError('Invalid file path. Use letters, numbers, -, _, ., and folder segments.')
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

      const renamed = {
        ...target,
        path: safePath,
        name: fileNameFromPath(safePath),
        language: runtimeLanguageFromPath(safePath) || target.language || 'javascript',
      }

      setFileError('')
      setProjectFiles((prev) =>
        normalizeProjectFiles(prev.map((file) => (file.id === fileId ? renamed : file))),
      )

      await persistProjectFile(renamed)
    },
    [persistProjectFile, projectFiles, setFileError, setProjectFiles],
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
        if (!target.id.startsWith('local-')) {
          const { error } = await deleteProjectFile(target.id)
          if (error) {
            console.error(error)
            setFileError(error.message || 'Could not delete file.')
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
      projectFiles,
      setActiveFileId,
      setFileError,
      setIsSavingFiles,
      setProjectFiles,
      updateUserCode,
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

  const handleExportProject = useCallback(async () => {
    setIsExporting(true)
    setFileError('')

    try {
      const payload = buildExportPackage({
        projectId: currentProjectId,
        projectDescription,
        skillLevel,
        tasks,
        files: projectFiles,
      })

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `mentor-project-${currentProjectId || 'export'}.json`
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
    projectDescription,
    projectFiles,
    setFileError,
    setIsExporting,
    skillLevel,
    tasks,
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
        const raw = await file.text()
        const parsed = parseImportPackage(raw)
        if (parsed.error || !parsed.data) {
          setFileError(parsed.error?.message || 'Invalid import file.')
          return
        }

        const nextFiles = parsed.data.files
        const payload = toPersistedFiles(nextFiles, currentProjectId, appUser.id)
        const { data, error } = await replaceProjectFiles(currentProjectId, appUser.id, payload)

        if (error) {
          if (isProjectFilesTableMissing(error)) {
            setFileError(
              'Project file storage is not configured in Supabase yet. Imported files are available for this session only.',
            )
            syncWorkspaceFiles(nextFiles)
            return
          }

          console.error(error)
          setFileError(error.message || 'Could not import project files.')
          return
        }

        syncWorkspaceFiles(data || nextFiles)
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
      setFileError,
      setIsImporting,
      syncWorkspaceFiles,
    ],
  )

  const currentTask = tasks[currentTaskIndex] ?? null
  const lockedTaskLanguage = sanitizeLanguage(currentTask?.language)
  const detectedLanguage = useMemo(
    () => detectLanguage(projectDescription, userCode),
    [projectDescription, userCode],
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
  const showHtmlPreview = runtimeLanguage === 'html'

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
    },
    [resetTaskSupportState, setCurrentTaskIndex],
  )

  const runCodeCheck = useCallback(async ({ useCached = true } = {}) => {
    if (!currentTask) {
      return { data: null, error: new Error('No current task selected.') }
    }

    const checkSignature = `${currentTask.id}::${userCode}`

    if (
      useCached &&
      checkSignature === lastCheckSignatureRef.current &&
      lastCheckResultRef.current
    ) {
      setUiError('')
      setFeedbackHistory([{ role: 'ai', message: lastCheckResultRef.current.feedback }])
      return { data: lastCheckResultRef.current, error: null }
    }

    setUiError('')
    setIsCheckingCode(true)
    setFeedbackHistory([])

    try {
      const result = await checkUserCode(currentTask, userCode)
      if (result.error) {
        setUiError(result.error.message)
        return { data: null, error: result.error }
      }

      lastCheckSignatureRef.current = checkSignature
      lastCheckResultRef.current = result.data
      setFeedbackHistory([{ role: 'ai', message: result.data.feedback }])
      return { data: result.data, error: null }
    } catch (error) {
      console.error(error)
      const normalizedError = new Error(error.message || 'Code check failed.')
      setUiError(normalizedError.message)
      return { data: null, error: normalizedError }
    } finally {
      setIsCheckingCode(false)
    }
  }, [
    checkUserCode,
    currentTask,
    setFeedbackHistory,
    setIsCheckingCode,
    userCode,
  ])

  const handleCheckCode = useCallback(async () => {
    await runCodeCheck({ useCached: true })
  }, [runCodeCheck])

  const handleFollowUp = useCallback(
    async (userQuestion) => {
      if (!currentTask) {
        return
      }

      const normalizedQuestion = userQuestion.trim()
      if (!normalizedQuestion) {
        return
      }

      setUiError('')
      setIsAskingFollowUp(true)

      const updatedHistory = [
        ...feedbackHistory,
        { role: 'user', message: normalizedQuestion },
      ]

      try {
        const result = await askFollowUp(
          currentTask,
          userCode,
          normalizedQuestion,
          updatedHistory,
          skillLevel,
        )

        if (result.error) {
          setUiError(result.error.message)
          return
        }

        setFeedbackHistory([...updatedHistory, { role: 'ai', message: result.data }])
      } catch (error) {
        console.error(error)
        setUiError(error.message || 'Follow-up request failed.')
      } finally {
        setIsAskingFollowUp(false)
      }
    },
    [
      askFollowUp,
      currentTask,
      feedbackHistory,
      skillLevel,
      setFeedbackHistory,
      setIsAskingFollowUp,
      userCode,
    ],
  )

  useEffect(() => {
    lastCheckSignatureRef.current = ''
    lastCheckResultRef.current = null
  }, [currentTask?.id, userCode])

  const handleMarkCurrentTaskComplete = useCallback(async () => {
    if (!currentTask || isMarkingTaskComplete) {
      return
    }

    setUiError('')
    setIsMarkingTaskComplete(true)

    try {
      if (currentTask.completed) {
        markTaskIncomplete(currentTask.id)

        const { error: taskError } = await markTaskIncompleteInDb(currentTask.id)
        if (taskError) {
          console.error(taskError)
          setUiError(taskError.message || 'Could not undo task completion in database.')
        }

        if (currentProjectId) {
          const { error: projectError } = await markProjectIncomplete(currentProjectId)
          if (projectError) {
            console.error(projectError)
            setUiError(projectError.message || 'Could not update project completion state.')
          }
        }

        return
      }

      const checkSignature = `${currentTask.id}::${userCode}`
      let validationResult = null

      if (
        checkSignature === lastCheckSignatureRef.current &&
        lastCheckResultRef.current
      ) {
        validationResult = lastCheckResultRef.current
        setFeedbackHistory([{ role: 'ai', message: validationResult.feedback }])
      } else {
        setIsCheckingBeforeComplete(true)
        const checkResult = await runCodeCheck({ useCached: true })
        setIsCheckingBeforeComplete(false)

        if (checkResult.error || !checkResult.data) {
          return
        }

        validationResult = checkResult.data
      }

      const hasPassingValidation =
        validationResult?.status === 'PASS' && validationResult?.outputMatch === true

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

      const updatedTasks = tasks.map((task) =>
        task.id === currentTask.id ? { ...task, completed: true } : task,
      )

      markTaskComplete(currentTask.id)

      const { error: taskError } = await markTaskCompleteInDb(currentTask.id)
      if (taskError) {
        console.error(taskError)
        setUiError(taskError.message || 'Could not update task status in database.')
      }

      const nextTaskIndex = updatedTasks.findIndex((task) => !task.completed)

      if (nextTaskIndex === -1) {
        if (currentProjectId) {
          const { error: projectError } = await markProjectComplete(currentProjectId)
          if (projectError) {
            console.error(projectError)
            setUiError(projectError.message || 'Could not mark project complete.')
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
    } catch (error) {
      console.error(error)
      setUiError(error.message || 'Could not complete task.')
    } finally {
      setIsCheckingBeforeComplete(false)
      setIsMarkingTaskComplete(false)
    }
  }, [
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
    tasks,
    user,
    userCode,
  ])

  const handleBackToDashboard = useCallback(async () => {
    resetApp()
    setScreen('dashboard')
    setPreviewSrcDoc('')
    setPreviewError('')

    if (user) {
      await loadProjects(user.id)
    }
  }, [loadProjects, resetApp, user])

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
      markTaskIncomplete(reopenTask.id)

      const { error: taskError } = await markTaskIncompleteInDb(reopenTask.id)
      if (taskError) {
        markTaskComplete(reopenTask.id)
        console.error(taskError)
        setUiError(taskError.message || 'Could not reopen task in database.')
        return
      }

      if (currentProjectId) {
        const { error: projectError } = await markProjectIncomplete(currentProjectId)
        if (projectError) {
          console.error(projectError)
          setUiError(projectError.message || 'Could not update project completion state.')
        }
      }

      setCurrentTaskIndex(reopenTaskIndex)
      resetTaskSupportState()
      setScreen('workspace')
    } catch (error) {
      console.error(error)
      setUiError(error.message || 'Could not reopen task.')
    } finally {
      setIsMarkingTaskComplete(false)
    }
  }, [
    currentProjectId,
    isMarkingTaskComplete,
    markTaskComplete,
    markTaskIncomplete,
    resetTaskSupportState,
    setCurrentTaskIndex,
    tasks,
  ])

  let markAsCompleteLabel = 'Mark as Complete'
  if (isCheckingBeforeComplete) {
    markAsCompleteLabel = 'Checking before completion...'
  } else if (isMarkingTaskComplete) {
    markAsCompleteLabel = 'Updating task status...'
  } else if (currentTask?.completed) {
    markAsCompleteLabel = 'Undo Complete'
  }

  if (isAuthenticatingState) {
    return <p className="p-4">Loading auth state...</p>
  }

  if (!appUser) {
    return (
      <AuthScreen
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onResendConfirmation={handleResendConfirmation}
        isAuthenticating={isAuthenticating}
        authError={authError || uiError}
        authInfo={authInfo}
      />
    )
  }

  if (screen === 'dashboard' && tasks.length === 0 && !currentProjectId) {
    return (
      <Dashboard
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        onStartNewProject={handleStartNewProject}
        onContinueProject={handleContinueProject}
        onLogOut={handleLogOut}
        onRefresh={() => loadProjects(appUser.id)}
        errorMessage={uiError}
      />
    )
  }

  if (screen === 'onboarding' && tasks.length === 0) {
    return (
      <Onboarding
        onSubmit={handleGenerateRoadmap}
        isGeneratingRoadmap={isGeneratingRoadmap}
        errorMessage={uiError}
        defaultDescription={projectDescription}
        defaultSkillLevel={skillLevel}
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

  return (
    <main className="p-3 flex flex-col gap-3">
      <header className="flex items-center justify-between border p-3">
        <h1 className="text-xl font-bold">AI Coding Mentor Workspace</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className={`${buttonSecondary} ${sizeSm}`}
            onClick={handleExportProject}
            disabled={isExporting || isImporting || projectFiles.length === 0}
          >
            {isExporting ? 'Exporting...' : 'Export JSON'}
          </button>
          <button
            type="button"
            className={`${buttonSecondary} ${sizeSm}`}
            onClick={handleImportClick}
            disabled={isImporting || isExporting}
          >
            {isImporting ? 'Importing...' : 'Import JSON'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportProject}
          />
          <button
            type="button"
            className={`${buttonSecondary} ${sizeSm}`}
            onClick={handleBackToDashboard}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`${buttonDanger} ${sizeSm}`}
            onClick={handleLogOut}
          >
            Log Out
          </button>
        </div>
      </header>

      <ProgressBar completedCount={completedCount} totalCount={tasks.length} />

      {uiError && <p className="text-red-600">{uiError}</p>}
      {isLoadingProjects && <p>Loading projects...</p>}
      {isGeneratingRoadmap && <p>Generating roadmap...</p>}
      {isCheckingCode && !isCheckingBeforeComplete && <p>Checking code...</p>}
      {isCheckingBeforeComplete && <p>Checking code before completion...</p>}
      {isMarkingTaskComplete && !isCheckingBeforeComplete && <p>Updating task status...</p>}
      {isAskingFollowUp && <p>Getting mentor reply...</p>}
      {isSavingFiles && <p>Saving project files...</p>}
      {fileError && <p className="text-red-600">{fileError}</p>}

      <section className="grid grid-cols-1 lg:grid-cols-[300px_1fr_360px] gap-3">
        <Roadmap
          tasks={tasks}
          currentTaskIndex={currentTaskIndex}
          onSelectTask={handleSelectTask}
        />

        <div className="flex flex-col gap-3">
          <section className="border p-3">
            <h2 className="text-lg font-semibold">
              Task {currentTaskIndex + 1}: {currentTask?.title}
            </h2>
            <p className="mt-2">{currentTask?.description}</p>
            <button
              type="button"
              className={`${buttonPrimary} ${sizeSm} mt-3`}
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

          <section className="grid grid-cols-1 xl:grid-cols-[250px_1fr] gap-3">
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

            <Editor
              projectDescription={projectDescription}
              value={activeFile?.content || ''}
              onChange={handleEditorChange}
              readOnly={Boolean(currentTask?.completed) && firstIncompleteIndex !== -1}
              language={editorLanguage}
              tabs={fileTabs}
              activeTabId={activeFile?.id || null}
              onSelectTab={handleSelectFile}
            />
          </section>

          <RunConsole
            key={currentTask?.id || 'run-console'}
            code={userCode}
            detectedLanguage={detectedLanguage}
            lockedLanguage={lockedTaskLanguage}
            onRunPreview={handleRunPreview}
          />
          {showHtmlPreview ? (
            <section className="border p-3 flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Live Preview</h2>
              <p className="text-sm text-slate-700">
                Click <strong>Refresh Preview</strong> in Run &amp; Output to update this panel.
              </p>
              {previewError ? <p className="text-red-600">{previewError}</p> : null}
              <iframe
                title="Project preview"
                srcDoc={previewSrcDoc || '<p>Run preview to render your files.</p>'}
                sandbox="allow-scripts"
                className="w-full h-64 border"
              />
            </section>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
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
            onCheckCode={handleCheckCode}
            onAskFollowUp={handleFollowUp}
            errorMessage={uiError}
          />
        </div>
      </section>
    </main>
  )
}

export default App
