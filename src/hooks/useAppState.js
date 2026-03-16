import { useCallback, useState } from 'react'

const initialState = {
  user: null,
  profile: null,
  currentProjectId: null,
  projectDescription: '',
  skillLevel: 'beginner',
  tasks: [],
  currentTaskIndex: 0,
  userCode: '',
  projectFiles: [],
  activeFileId: null,
  feedbackHistory: [],
  hintsUsed: 0,
  exampleViewed: false,
  isGeneratingRoadmap: false,
  isCheckingCode: false,
  isAskingFollowUp: false,
  isLoadingProjects: false,
  isLoadingProfile: false,
  isSavingProfile: false,
  isAuthenticating: false,
  isSavingFiles: false,
  fileError: '',
  isImporting: false,
  isExporting: false,
  projectLanguages: null,
}

export function useAppState() {
  const [user, setUser] = useState(initialState.user)
  const [profile, setProfile] = useState(initialState.profile)
  const [currentProjectId, setCurrentProjectId] = useState(
    initialState.currentProjectId,
  )
  const [projectDescription, setProjectDescription] = useState(
    initialState.projectDescription,
  )
  const [skillLevel, setSkillLevel] = useState(initialState.skillLevel)
  const [tasks, setTasks] = useState(initialState.tasks)
  const [currentTaskIndex, setCurrentTaskIndex] = useState(
    initialState.currentTaskIndex,
  )
  const [userCode, setUserCode] = useState(initialState.userCode)
  const [projectFiles, setProjectFiles] = useState(initialState.projectFiles)
  const [activeFileId, setActiveFileId] = useState(initialState.activeFileId)
  const [feedbackHistory, setFeedbackHistory] = useState(initialState.feedbackHistory)
  const [hintsUsed, setHintsUsed] = useState(initialState.hintsUsed)
  const [exampleViewed, setExampleViewed] = useState(initialState.exampleViewed)
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(
    initialState.isGeneratingRoadmap,
  )
  const [isCheckingCode, setIsCheckingCode] = useState(initialState.isCheckingCode)
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(
    initialState.isAskingFollowUp,
  )
  const [isLoadingProjects, setIsLoadingProjects] = useState(
    initialState.isLoadingProjects,
  )
  const [isLoadingProfile, setIsLoadingProfile] = useState(
    initialState.isLoadingProfile,
  )
  const [isSavingProfile, setIsSavingProfile] = useState(
    initialState.isSavingProfile,
  )
  const [isAuthenticating, setIsAuthenticating] = useState(
    initialState.isAuthenticating,
  )
  const [isSavingFiles, setIsSavingFiles] = useState(initialState.isSavingFiles)
  const [fileError, setFileError] = useState(initialState.fileError)
  const [isImporting, setIsImporting] = useState(initialState.isImporting)
  const [isExporting, setIsExporting] = useState(initialState.isExporting)
  const [projectLanguages, setProjectLanguages] = useState(initialState.projectLanguages)

  const updateUserCode = useCallback((code) => {
    setUserCode(code ?? '')
  }, [])

  const appendFeedback = useCallback((entry) => {
    setFeedbackHistory((prev) => [...prev, entry])
  }, [])

  const markTaskComplete = useCallback((taskId) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: true,
            }
          : task,
      ),
    )
  }, [])

  const markTaskIncomplete = useCallback((taskId) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: false,
            }
          : task,
      ),
    )
  }, [])

  const incrementHints = useCallback(() => {
    setHintsUsed((prev) => prev + 1)
  }, [])

  const setExampleViewedState = useCallback((valueOrUpdater) => {
    setExampleViewed((prev) => {
      if (typeof valueOrUpdater === 'function') {
        return Boolean(valueOrUpdater(prev))
      }

      return Boolean(valueOrUpdater)
    })
  }, [])

  const resetTaskSupportState = useCallback(() => {
    setFeedbackHistory([])
    setHintsUsed(0)
    setExampleViewed(false)
  }, [])

  const resetApp = useCallback(() => {
    setCurrentProjectId(initialState.currentProjectId)
    setProjectDescription(initialState.projectDescription)
    setSkillLevel(initialState.skillLevel)
    setTasks(initialState.tasks)
    setCurrentTaskIndex(initialState.currentTaskIndex)
    setUserCode(initialState.userCode)
    setProjectFiles(initialState.projectFiles)
    setActiveFileId(initialState.activeFileId)
    setFeedbackHistory(initialState.feedbackHistory)
    setHintsUsed(initialState.hintsUsed)
    setExampleViewed(initialState.exampleViewed)
    setIsGeneratingRoadmap(initialState.isGeneratingRoadmap)
    setIsCheckingCode(initialState.isCheckingCode)
    setIsAskingFollowUp(initialState.isAskingFollowUp)
    setIsLoadingProjects(initialState.isLoadingProjects)
    setIsLoadingProfile(initialState.isLoadingProfile)
    setIsSavingProfile(initialState.isSavingProfile)
    setIsSavingFiles(initialState.isSavingFiles)
    setFileError(initialState.fileError)
    setIsImporting(initialState.isImporting)
    setIsExporting(initialState.isExporting)
    setProjectLanguages(initialState.projectLanguages)
  }, [])

  return {
    user,
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
    isAuthenticating,
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
    appendFeedback,
    markTaskComplete,
    markTaskIncomplete,
    incrementHints,
    setExampleViewed: setExampleViewedState,
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
  }
}
