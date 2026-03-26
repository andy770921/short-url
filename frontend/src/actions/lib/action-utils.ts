import { ZodSchema, ZodError } from 'zod';
import { ActionResult } from './action-result';

/**
 * Validates input against a Zod schema
 * Converts Zod errors to ActionResult format
 */
export async function validateInput<T>(
  schema: ZodSchema<T>,
  input: unknown,
): Promise<ActionResult<T>> {
  try {
    const data = await schema.parseAsync(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    return { success: false, error: 'Invalid input' };
  }
}

/**
 * Executes an async action with error handling
 * Converts exceptions to ActionResult format
 */
export async function executeAction<T>(
  action: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await action();
    return { success: true, data };
  } catch (error) {
    console.error('Action error:', error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}
