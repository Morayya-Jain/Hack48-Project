import { useCallback, useState } from 'react'

const initialState = {
  user: null,
  currentProjectId: null,
  projectDescription: '',
  skillLevel: 'beginner',
  tasks: [],
  currentTaskIndex: 0,
  userCode: '',
  feedbackHistory: [],
  hintsUsed: 0,
  exampleViewed: false,
  isGeneratingRoadmap: false,
  isCheckingCode: false,
  isAskingFollowUp: false,
  isLoadingProjects: false,
  isAuthenticating: false,
}

export function useAppState() {
  const [user, setUser] = useState(initialState.user)
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
  const [isAuthenticating, setIsAuthenticating] = useState(
    initialState.isAuthenticating,
  )

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
    setUserCode('')
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
    setFeedbackHistory(initialState.feedbackHistory)
    setHintsUsed(initialState.hintsUsed)
    setExampleViewed(initialState.exampleViewed)
    setIsGeneratingRoadmap(initialState.isGeneratingRoadmap)
    setIsCheckingCode(initialState.isCheckingCode)
    setIsAskingFollowUp(initialState.isAskingFollowUp)
    setIsLoadingProjects(initialState.isLoadingProjects)
  }, [])

  return {
    user,
    currentProjectId,
    projectDescription,
    skillLevel,
    tasks,
    currentTaskIndex,
    userCode,
    feedbackHistory,
    hintsUsed,
    exampleViewed,
    isGeneratingRoadmap,
    isCheckingCode,
    isAskingFollowUp,
    isLoadingProjects,
    isAuthenticating,
    setUser,
    setCurrentProjectId,
    setProjectDescription,
    setSkillLevel,
    setTasks,
    setCurrentTaskIndex,
    updateUserCode,
    appendFeedback,
    markTaskComplete,
    incrementHints,
    setExampleViewed: setExampleViewedState,
    resetTaskSupportState,
    resetApp,
    setIsGeneratingRoadmap,
    setIsCheckingCode,
    setIsAskingFollowUp,
    setIsLoadingProjects,
    setIsAuthenticating,
    setFeedbackHistory,
  }
}
