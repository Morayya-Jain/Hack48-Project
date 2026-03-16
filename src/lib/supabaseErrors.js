export const PROJECT_FILES_ERROR_KIND = Object.freeze({
  MISSING_TABLE: 'missing_table',
  SCHEMA_OUTDATED: 'schema_outdated',
  PERMISSION_DENIED: 'permission_denied',
  UNKNOWN: 'unknown',
})

function toLowerText(value) {
  if (typeof value === 'string') {
    return value.toLowerCase()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLowerCase()
  }

  return ''
}

function buildErrorSearchText(error) {
  if (!error || typeof error !== 'object') {
    return ''
  }

  return [error.message, error.details, error.hint].map(toLowerText).filter(Boolean).join(' ')
}

function hasProjectFilesReference(text) {
  return text.includes('project_files')
}

function isMissingProjectFilesTableByMessage(text) {
  if (!hasProjectFilesReference(text)) {
    return false
  }

  return (
    text.includes('relation "project_files" does not exist') ||
    text.includes("could not find the table 'project_files' in the schema cache") ||
    text.includes("could not find the relation 'project_files' in the schema cache") ||
    text.includes('undefined table')
  )
}

function isProjectFilesSchemaOutdatedByMessage(text) {
  if (!hasProjectFilesReference(text)) {
    return false
  }

  return (
    text.includes("could not find the '") ||
    text.includes('column ') ||
    text.includes('schema cache') ||
    text.includes('no unique or exclusion constraint matching the on conflict specification') ||
    text.includes('on conflict') ||
    text.includes('does not exist')
  )
}

function isPermissionDeniedByMessage(text) {
  return (
    text.includes('permission denied') ||
    text.includes('row-level security') ||
    text.includes('violates row-level security policy')
  )
}

export function classifyProjectFilesError(error) {
  const code = toLowerText(error?.code)
  const searchText = buildErrorSearchText(error)

  if (code === '42p01' || isMissingProjectFilesTableByMessage(searchText)) {
    return PROJECT_FILES_ERROR_KIND.MISSING_TABLE
  }

  if (
    code === '42703' ||
    code === '42p10' ||
    code === 'pgrst204' ||
    isProjectFilesSchemaOutdatedByMessage(searchText)
  ) {
    return PROJECT_FILES_ERROR_KIND.SCHEMA_OUTDATED
  }

  if (code === '42501' || isPermissionDeniedByMessage(searchText)) {
    return PROJECT_FILES_ERROR_KIND.PERMISSION_DENIED
  }

  return PROJECT_FILES_ERROR_KIND.UNKNOWN
}

export function isProjectFilesConfigurationError(error) {
  const kind = classifyProjectFilesError(error)
  return (
    kind === PROJECT_FILES_ERROR_KIND.MISSING_TABLE ||
    kind === PROJECT_FILES_ERROR_KIND.SCHEMA_OUTDATED
  )
}
