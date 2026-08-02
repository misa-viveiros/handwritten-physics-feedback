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
  const log = createStudySessionLog()
  log.metrics.uploadSource = {
    sourceType: 'pdf',
    pdfPageNumber: 2,
    pdfPageCount: 3,
  }
  const serialized = JSON.stringify(createStudyExportValue(log))

  assert.doesNotMatch(serialized, /api.?key/i)
  assert.doesNotMatch(serialized, /image.?data|base64/i)
  assert.doesNotMatch(serialized, /originalFileName|file.?path/i)
  assert.match(serialized, /"sourceType":"pdf"/)
  assert.match(serialized, /"pdfPageNumber":2/)
})
