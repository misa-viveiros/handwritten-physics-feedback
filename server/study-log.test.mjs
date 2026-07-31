import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createStudyExportValue,
  createStudySessionLog,
} from '../src/studyLog.ts'

test('study export excludes transcription unless explicitly enabled', () => {
  const log = createStudySessionLog()
  const defaultExport = createStudyExportValue(log, ['F = ma'])
  const enabledExport = createStudyExportValue(log, ['F = ma'], true)

  assert.equal('confirmedTranscription' in defaultExport, false)
  assert.deepEqual(enabledExport.confirmedTranscription, ['F = ma'])
})

test('default study log contains no image or credential fields', () => {
  const serialized = JSON.stringify(
    createStudyExportValue(createStudySessionLog()),
  )

  assert.doesNotMatch(serialized, /api.?key/i)
  assert.doesNotMatch(serialized, /image.?data|base64/i)
})
