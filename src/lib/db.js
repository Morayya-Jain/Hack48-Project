import { supabase, supabaseInitError } from './supabaseClient'
import { normalizeProfile, toProfilePayload } from './profile'
import {
  classifyProjectFilesError,
  PROJECT_FILES_ERROR_KIND,
} from './supabaseErrors'

function normalizeProjectSkillLevel(value) {
  const normalized = `${value || ''}`.trim().toLowerCase()

  if (
    normalized === 'beginner' ||
    normalized === 'intermediate' ||
    normalized === 'advanced' ||
    normalized === 'master'
  ) {
    return normalized
  }

  if (normalized === 'exploring' || normalized === 'student') {
    return 'intermediate'
  }

  return 'intermediate'
}

function getSupabaseUnavailableResponse() {
  return {
    data: null,
    error: supabaseInitError || new Error('Supabase is not configured.'),
  }
}

function isProjectTitleColumnMissing(error) {
  const message = error?.message || ''
  return /column .*title|schema cache|Could not find the 'title' column/i.test(message)
}

export async function getUserProfile(userId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      return { data: null, error }
    }

    return { data: data ? normalizeProfile(data) : null, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function upsertUserProfile(userId, profileInput) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const payload = {
      user_id: userId,
      ...toProfilePayload(profileInput),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (error) {
      return { data: null, error }
    }

    return { data: normalizeProfile(data), error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function createProject(userId, description, skillLevel, title = '') {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const payload = {
      user_id: userId,
      description,
      skill_level: normalizeProjectSkillLevel(skillLevel),
    }

    if (`${title || ''}`.trim()) {
      payload.title = `${title}`.trim()
    }

    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single()

    if (error && payload.title && isProjectTitleColumnMissing(error)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          description,
          skill_level: normalizeProjectSkillLevel(skillLevel),
        })
        .select()
        .single()

      return { data: legacyData, error: legacyError }
    }

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

export async function markTaskIncomplete(taskId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ completed: false })
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

export async function getProjectFiles(projectId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_index', { ascending: true })
      .order('created_at', { ascending: true })

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function createProjectFiles(projectId, userId, files) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const payload = (files || []).map((file, index) => ({
      project_id: projectId,
      user_id: userId,
      path: file.path,
      name: file.name,
      language: file.language || null,
      content: typeof file.content === 'string' ? file.content : '',
      sort_index: typeof file.sort_index === 'number' ? file.sort_index : index,
    }))

    if (payload.length === 0) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('project_files')
      .insert(payload)
      .select('*')
      .order('sort_index', { ascending: true })

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function upsertProjectFile(file) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const payload = {
      project_id: file.project_id,
      user_id: file.user_id,
      path: file.path,
      name: file.name,
      language: file.language || null,
      content: typeof file.content === 'string' ? file.content : '',
      sort_index: typeof file.sort_index === 'number' ? file.sort_index : 0,
      updated_at: new Date().toISOString(),
    }

    if (file.id && !`${file.id}`.startsWith('local-')) {
      const { data: updatedRows, error: updateError } = await supabase
        .from('project_files')
        .update(payload)
        .eq('id', file.id)
        .select('*')

      if (updateError) {
        return { data: null, error: updateError }
      }

      if (Array.isArray(updatedRows) && updatedRows.length > 0) {
        return { data: updatedRows[0], error: null }
      }
    }

    const { data, error } = await supabase
      .from('project_files')
      .upsert(payload, { onConflict: 'project_id,path' })
      .select('*')
      .single()

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteProjectFile(fileId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('project_files')
      .delete()
      .eq('id', fileId)
      .select('*')
      .single()

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteProject(projectId, userId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { error: filesError } = await supabase
      .from('project_files')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)

    const filesErrorKind = classifyProjectFilesError(filesError)
    if (
      filesError &&
      filesErrorKind !== PROJECT_FILES_ERROR_KIND.MISSING_TABLE &&
      filesErrorKind !== PROJECT_FILES_ERROR_KIND.SCHEMA_OUTDATED
    ) {
      return { data: null, error: filesError }
    }

    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)

    if (tasksError) {
      return { data: null, error: tasksError }
    }

    const { data, error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId)
      .select('*')

    if (error) {
      return { data: null, error }
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        data: null,
        error: new Error('Project was not found or you do not have permission to delete it.'),
      }
    }

    return { data: data[0], error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function replaceProjectFiles(projectId, userId, files) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const nextFiles = (files || []).map((file, index) => ({
      project_id: projectId,
      user_id: userId,
      path: file.path,
      name: file.name,
      language: file.language || null,
      content: typeof file.content === 'string' ? file.content : '',
      sort_index: typeof file.sort_index === 'number' ? file.sort_index : index,
      updated_at: new Date().toISOString(),
    }))

    const { data: currentFiles, error: currentError } = await getProjectFiles(projectId)
    if (currentError) {
      return { data: null, error: currentError }
    }

    const { error: upsertError } = await supabase
      .from('project_files')
      .upsert(nextFiles, { onConflict: 'project_id,path' })
    if (upsertError) {
      return { data: null, error: upsertError }
    }

    const nextPathSet = new Set(nextFiles.map((file) => file.path))
    const staleIds = (currentFiles || [])
      .filter((file) => !nextPathSet.has(file.path))
      .map((file) => file.id)

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('project_files')
        .delete()
        .in('id', staleIds)

      if (deleteError) {
        return { data: null, error: deleteError }
      }
    }

    const { data, error } = await getProjectFiles(projectId)
    if (error) {
      return { data: null, error }
    }

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function markProjectIncomplete(projectId) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .update({ completed: false })
      .eq('id', projectId)
      .select()
      .single()

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updateProjectTitle(projectId, userId, title) {
  if (!supabase) {
    return getSupabaseUnavailableResponse()
  }

  try {
    const normalizedTitle = `${title || ''}`.trim()
    if (!normalizedTitle) {
      return { data: null, error: null }
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ title: normalizedTitle })
      .eq('id', projectId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error && isProjectTitleColumnMissing(error)) {
      return { data: null, error: null }
    }

    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}
