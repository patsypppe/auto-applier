// Leaves out the fields that have no value, so a job record only has the optional fields its board filled in.
export function definedOnly<T extends Record<string, unknown>>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>
}
