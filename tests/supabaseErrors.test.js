import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyProjectFilesError,
  isProjectFilesConfigurationError,
  PROJECT_FILES_ERROR_KIND,
} from '../src/lib/supabaseErrors.js'

test('classifyProjectFilesError returns missing_table for 42P01 table errors', () => {
  const kind = classifyProjectFilesError({
    code: '42P01',
    message: 'relation "project_files" does not exist',
  })

  assert.equal(kind, PROJECT_FILES_ERROR_KIND.MISSING_TABLE)
  assert.equal(isProjectFilesConfigurationError({ code: '42P01' }), true)
})

test('classifyProjectFilesError returns schema_outdated for 42703 column errors', () => {
  const kind = classifyProjectFilesError({
    code: '42703',
    message: 'column project_files.sort_index does not exist',
  })

  assert.equal(kind, PROJECT_FILES_ERROR_KIND.SCHEMA_OUTDATED)
  assert.equal(
    isProjectFilesConfigurationError({
      code: '42703',
      message: 'column project_files.updated_at does not exist',
    }),
    true,
  )
})

test('classifyProjectFilesError returns schema_outdated for ON CONFLICT constraint mismatches', () => {
  const kind = classifyProjectFilesError({
    message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
    details: 'upsert on project_files failed for conflict target (project_id,path)',
  })

  assert.equal(kind, PROJECT_FILES_ERROR_KIND.SCHEMA_OUTDATED)
})

test('classifyProjectFilesError returns permission_denied for 42501 errors', () => {
  const kind = classifyProjectFilesError({
    code: '42501',
    message: 'new row violates row-level security policy for table "project_files"',
  })

  assert.equal(kind, PROJECT_FILES_ERROR_KIND.PERMISSION_DENIED)
  assert.equal(
    isProjectFilesConfigurationError({
      code: '42501',
      message: 'permission denied for table project_files',
    }),
    false,
  )
})

test('classifyProjectFilesError returns unknown for unrelated errors', () => {
  const kind = classifyProjectFilesError({
    message: 'fetch failed',
    hint: 'network timeout',
  })

  assert.equal(kind, PROJECT_FILES_ERROR_KIND.UNKNOWN)
  assert.equal(isProjectFilesConfigurationError({ message: 'fetch failed' }), false)
})
