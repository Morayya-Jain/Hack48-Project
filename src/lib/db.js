import { supabase, supabaseInitError } from './supabaseClient'

function getSupabaseUnavailableResponse() {
  return {
    data: null,
    error: supabaseInitError || new Error('Supabase is not configured.'),
  }
}

export async function createProject(userId, description, skillLevel) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        description,
        skill_level: skillLevel,
      })
      .select()
      .single()

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function saveTasks(projectId, userId, tasks) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const payload = tasks.map((task, index) => ({
      project_id: projectId,
      user_id: userId,
      task_index: index,
      title: task.title,
      description: task.description,
      hint: task.hint,
      example_output: task.exampleOutput,
      language: task.language || null,
      completed: false,
    }))

    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select()
      .order('task_index', { ascending: true })

    if (
      error &&
      /column .*language|schema cache|Could not find the 'language' column/i.test(
        error.message || '',
      )
    ) {
      const legacyPayload = payload.map((task) => {
        const nextTask = { ...task }
        delete nextTask.language
        return nextTask
      })

      const { data: legacyData, error: legacyError } = await supabase
        .from('tasks')
        .insert(legacyPayload)
        .select()
        .order('task_index', { ascending: true })

      if (legacyError) {
        return { data: null, error: legacyError }
      }

      const mergedData = (legacyData ?? []).map((row, index) => ({
        ...row,
        language: tasks[index]?.language || '',
      }))

      return { data: mergedData, error: null }
    }

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getUserProjects(userId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getProjectTasks(projectId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('task_index', { ascending: true })

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function markTaskComplete(taskId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ completed: true })
      .eq('id', taskId)
      .select()
      .single()

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function markProjectComplete(projectId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .update({ completed: true })
      .eq('id', projectId)
      .select()
      .single()

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}
