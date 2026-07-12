export function getMissingCompoundPkFields(
  fields: string[] | undefined,
  record: Record<string, unknown>
): string[] {
  if (!fields || fields.length === 0) return []

  return fields.filter(field => {
    const value = record[field]
    return value == null || (typeof value === 'string' && value.trim().length === 0)
  })
}

export class InvalidSyncRecordError extends Error {
  constructor(table: string, missingFields: string[]) {
    super(
      `Invalid ${table} sync record: missing compound key field(s): ${missingFields.join(', ')}`
    )
    this.name = 'InvalidSyncRecordError'
  }
}
