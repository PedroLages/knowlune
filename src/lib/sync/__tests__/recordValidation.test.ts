import { describe, expect, it } from 'vitest'
import { getMissingCompoundPkFields, InvalidSyncRecordError } from '../recordValidation'

describe('recordValidation', () => {
  it('accepts complete compound keys', () => {
    expect(
      getMissingCompoundPkFields(['courseId', 'videoId'], {
        courseId: 'course-1',
        videoId: 'video-1',
      })
    ).toEqual([])
  })

  it('reports undefined and empty compound key fields', () => {
    expect(
      getMissingCompoundPkFields(['courseId', 'videoId', 'itemId'], {
        courseId: '',
        videoId: undefined,
        itemId: 'item-1',
      })
    ).toEqual(['courseId', 'videoId'])
  })

  it('creates a diagnostic error without serializing the full record', () => {
    const error = new InvalidSyncRecordError('progress', ['courseId'])
    expect(error.name).toBe('InvalidSyncRecordError')
    expect(error.message).toBe(
      'Invalid progress sync record: missing compound key field(s): courseId'
    )
  })
})
