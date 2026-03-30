import { UrlCodeGenerator } from './url-code-generator';

describe('UrlCodeGenerator', () => {
  let generator: UrlCodeGenerator;

  beforeEach(() => {
    generator = new UrlCodeGenerator();
  });

  describe('md5ToBase62', () => {
    it('should produce a non-empty base62 string', () => {
      const result = generator.md5ToBase62('https://example.com');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result).toMatch(/^[0-9a-zA-Z]+$/);
    });

    it('should produce consistent results for the same input', () => {
      const a = generator.md5ToBase62('https://example.com');
      const b = generator.md5ToBase62('https://example.com');
      expect(a).toBe(b);
    });

    it('should produce different results for different inputs', () => {
      const a = generator.md5ToBase62('https://example.com');
      const b = generator.md5ToBase62('https://other.com');
      expect(a).not.toBe(b);
    });
  });

  describe('getCandidate', () => {
    it('should return a substring when offset is within bounds', () => {
      const base62 = 'abcdefghij';
      const result = generator.getCandidate(base62, 0, 6);
      expect(result).toBe('abcdef');
    });

    it('should shift substring when offset is within bounds', () => {
      const base62 = 'abcdefghij';
      const result = generator.getCandidate(base62, 2, 6);
      expect(result).toBe('cdefgh');
    });

    it('should return fully random code when offset is out of bounds', () => {
      const base62 = 'abcd';
      const result = generator.getCandidate(base62, 10, 6);
      expect(result.length).toBe(6);
      expect(result).toMatch(/^[0-9a-zA-Z]{6}$/);
    });
  });

  describe('randomSuffix', () => {
    it('should return a string of the requested length', () => {
      expect(generator.randomSuffix(4).length).toBe(4);
      expect(generator.randomSuffix(2).length).toBe(2);
    });

    it('should only contain base62 characters', () => {
      expect(generator.randomSuffix(20)).toMatch(/^[0-9a-zA-Z]+$/);
    });
  });
});
