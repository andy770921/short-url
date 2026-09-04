import { CUSTOM_ALIAS_MAX_LENGTH } from '@repo/shared';

/**
 * A short link is a single path segment of alias-safe characters, e.g. /4ymlZa.
 * Generated codes are 6 chars; custom aliases go up to CUSTOM_ALIAS_MAX_LENGTH.
 */
const SHORT_CODE_PATH = new RegExp(`^/[a-zA-Z0-9_-]{1,${CUSTOM_ALIAS_MAX_LENGTH}}$`);

export const isShortCodePath = (pathname: string): boolean => SHORT_CODE_PATH.test(pathname);
