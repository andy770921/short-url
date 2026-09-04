import { isShortCodePath } from './short-code';

describe('isShortCodePath', () => {
  it('matches a generated 6-char code', () => {
    expect(isShortCodePath('/4ymlZa')).toBe(true);
  });

  it('matches a custom alias with dashes and underscores', () => {
    expect(isShortCodePath('/my_link-1')).toBe(true);
  });

  it('does not match the home page', () => {
    expect(isShortCodePath('/')).toBe(false);
  });

  it('does not match nested paths', () => {
    expect(isShortCodePath('/api/urls')).toBe(false);
  });

  it('does not match a static file', () => {
    expect(isShortCodePath('/favicon.ico')).toBe(false);
  });

  it('does not match an alias longer than the allowed maximum', () => {
    expect(isShortCodePath(`/${'a'.repeat(21)}`)).toBe(false);
  });
});
