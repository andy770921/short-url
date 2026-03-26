/**
 * Type-safe result wrapper for Server Actions
 * Using discriminated union pattern for compile-time error handling
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
