-- Clean malformed example_output values that contain embedded id field artifacts.
-- Pattern: example_output ending with `", "id": "task-N` (where N is 1-99).
-- The captured value lacks the trailing quote because extractLooseJsonFieldValues
-- captured between quotes, so the stored artifact ends with the digit.
-- This was caused by a regex capture bug in extractLooseJsonFieldValues.

UPDATE tasks
SET example_output = regexp_replace(
  example_output,
  '",\s*"id"\s*:\s*"task-\d+$',
  '',
  'i'
)
WHERE example_output ~ '",\s*"id"\s*:\s*"task-\d+$';
