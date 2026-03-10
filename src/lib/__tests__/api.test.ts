import { describe, it, expect } from 'vitest'
import { ApiClientError, queryKeys } from '../api'
import type { ApiError } from '@/types/api'

describe('ApiClientError', () => {
  describe('constructor', () => {
    it('creates error with message and status code', () => {
      const error = new ApiClientError('Test error', 404)

      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(404)
      expect(error.response).toBeUndefined()
    })

    it('creates error with message, status code, and API response', () => {
      const apiResponse: ApiError = {
        error: 'Not Found',
        message: 'Resource not found',
        statusCode: 404,
        code: 'NOT_FOUND',
        details: { resourceId: '123' },
      }
      const error = new ApiClientError('Test error', 404, apiResponse)

      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(404)
      expect(error.response).toEqual(apiResponse)
    })

    it('sets error name to ApiClientError', () => {
      const error = new ApiClientError('Test error', 500)

      expect(error.name).toBe('ApiClientError')
    })

    it('is an instance of Error', () => {
      const error = new ApiClientError('Test error', 500)

      expect(error).toBeInstanceOf(Error)
    })

    it('is an instance of ApiClientError', () => {
      const error = new ApiClientError('Test error', 500)

      expect(error).toBeInstanceOf(ApiClientError)
    })
  })

  describe('status codes', () => {
    it('handles 400 Bad Request', () => {
      const error = new ApiClientError('Bad request', 400)
      expect(error.statusCode).toBe(400)
    })

    it('handles 401 Unauthorized', () => {
      const error = new ApiClientError('Unauthorized', 401)
      expect(error.statusCode).toBe(401)
    })

    it('handles 403 Forbidden', () => {
      const error = new ApiClientError('Forbidden', 403)
      expect(error.statusCode).toBe(403)
    })

    it('handles 404 Not Found', () => {
      const error = new ApiClientError('Not found', 404)
      expect(error.statusCode).toBe(404)
    })

    it('handles 500 Internal Server Error', () => {
      const error = new ApiClientError('Server error', 500)
      expect(error.statusCode).toBe(500)
    })

    it('handles 0 for network errors', () => {
      const error = new ApiClientError('Network error', 0)
      expect(error.statusCode).toBe(0)
    })
  })

  describe('API response details', () => {
    it('preserves API error code', () => {
      const apiResponse: ApiError = {
        error: 'Bad Request',
        message: 'Validation failed',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      }
      const error = new ApiClientError('Validation error', 400, apiResponse)

      expect(error.response?.code).toBe('VALIDATION_ERROR')
    })

    it('preserves API error details', () => {
      const apiResponse: ApiError = {
        error: 'Bad Request',
        message: 'Invalid input',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: { field: 'email', reason: 'Invalid format' },
      }
      const error = new ApiClientError('Validation error', 400, apiResponse)

      expect(error.response?.details).toEqual({ field: 'email', reason: 'Invalid format' })
    })

    it('handles API response without details', () => {
      const apiResponse: ApiError = {
        error: 'Internal Server Error',
        message: 'Something went wrong',
        statusCode: 500,
        code: 'UNKNOWN_ERROR',
      }
      const error = new ApiClientError('Unknown error', 500, apiResponse)

      expect(error.response?.message).toBe('Something went wrong')
      expect(error.response?.details).toBeUndefined()
    })
  })

  describe('error message inheritance', () => {
    it('inherits toString() from Error', () => {
      const error = new ApiClientError('Test error', 404)
      const errorString = error.toString()

      expect(errorString).toContain('ApiClientError')
      expect(errorString).toContain('Test error')
    })

    it('can be caught as Error', () => {
      try {
        throw new ApiClientError('Test error', 404)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error).toBeInstanceOf(ApiClientError)
      }
    })
  })
})

describe('queryKeys', () => {
  describe('courses keys', () => {
    it('provides all courses key', () => {
      expect(queryKeys.courses.all).toEqual(['courses'])
    })

    it('provides detail course key as function', () => {
      const key = queryKeys.courses.detail('123')
      expect(key).toEqual(['courses', '123'])
    })

    it('generates different keys for different course IDs', () => {
      const key1 = queryKeys.courses.detail('1')
      const key2 = queryKeys.courses.detail('2')

      expect(key1).not.toEqual(key2)
      expect(key1).toEqual(['courses', '1'])
      expect(key2).toEqual(['courses', '2'])
    })

    it('returns readonly arrays', () => {
      const key = queryKeys.courses.all
      // TypeScript would catch this at compile time if not readonly
      expect(Array.isArray(key)).toBe(true)
    })
  })

  describe('lessons keys', () => {
    it('provides detail lesson key as function', () => {
      const key = queryKeys.lessons.detail('lesson-1')
      expect(key).toEqual(['lessons', 'lesson-1'])
    })

    it('generates different keys for different lesson IDs', () => {
      const key1 = queryKeys.lessons.detail('lesson-1')
      const key2 = queryKeys.lessons.detail('lesson-2')

      expect(key1).not.toEqual(key2)
    })
  })

  describe('user keys', () => {
    it('provides profile key', () => {
      expect(queryKeys.user.profile).toEqual(['user', 'profile'])
    })

    it('returns readonly array', () => {
      const key = queryKeys.user.profile
      expect(Array.isArray(key)).toBe(true)
    })
  })

  describe('reports keys', () => {
    it('provides all reports key', () => {
      expect(queryKeys.reports.all).toEqual(['reports'])
    })
  })

  describe('key consistency', () => {
    it('returns same reference for static keys', () => {
      const key1 = queryKeys.courses.all
      const key2 = queryKeys.courses.all

      // Should be same reference (const)
      expect(key1).toBe(key2)
    })

    it('returns same value for function keys with same ID', () => {
      const key1 = queryKeys.courses.detail('123')
      const key2 = queryKeys.courses.detail('123')

      expect(key1).toEqual(key2)
    })
  })

  describe('key structure validation', () => {
    it('all courses key has correct length', () => {
      expect(queryKeys.courses.all.length).toBe(1)
    })

    it('detail course key has correct length', () => {
      const key = queryKeys.courses.detail('123')
      expect(key.length).toBe(2)
    })

    it('user profile key has correct length', () => {
      expect(queryKeys.user.profile.length).toBe(2)
    })

    it('reports all key has correct length', () => {
      expect(queryKeys.reports.all.length).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('handles empty string IDs', () => {
      const key = queryKeys.courses.detail('')
      expect(key).toEqual(['courses', ''])
    })

    it('handles numeric string IDs', () => {
      const key = queryKeys.courses.detail('123')
      expect(key).toEqual(['courses', '123'])
    })

    it('handles special characters in IDs', () => {
      const key = queryKeys.lessons.detail('lesson-with-dashes_and_underscores')
      expect(key[1]).toBe('lesson-with-dashes_and_underscores')
    })
  })
})
