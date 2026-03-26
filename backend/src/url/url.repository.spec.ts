import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { UrlRepository } from './url.repository';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';

const mockRecord = {
  shortUrl: 'abc123',
  longUrl: 'https://example.com',
  creationTime: '2026-03-26T00:00:00.000Z',
  expirationTime: '2026-04-25T00:00:00.000Z',
};

describe('UrlRepository', () => {
  let repo: UrlRepository;
  let mockSupabase: any;

  beforeEach(async () => {
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlRepository,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(30) } },
      ],
    }).compile();

    repo = module.get<UrlRepository>(UrlRepository);
  });

  describe('findByShortCode', () => {
    it('should return null when not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      });
      expect(await repo.findByShortCode('xyz')).toBeNull();
    });

    it('should return the record when found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockRecord, error: null }),
      });
      expect(await repo.findByShortCode('abc123')).toEqual(mockRecord);
    });
  });

  describe('findByLongUrl', () => {
    it('should return null when not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      expect(await repo.findByLongUrl('https://unknown.com')).toBeNull();
    });

    it('should return the record when found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockRecord, error: null }),
      });
      expect(await repo.findByLongUrl('https://example.com')).toEqual(mockRecord);
    });
  });

  describe('isShortCodeTaken', () => {
    it('should return false when code is free', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });
      expect(await repo.isShortCodeTaken('free')).toBe(false);
    });

    it('should return true when code is taken', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { shortUrl: 'taken' }, error: null }),
      });
      expect(await repo.isShortCodeTaken('taken')).toBe(true);
    });
  });

  describe('create', () => {
    it('should return the created record', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockRecord, error: null }),
      });
      const result = await repo.create('abc123', 'https://example.com');
      expect(result).toEqual(mockRecord);
    });

    it('should throw ConflictException on Supabase error', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'duplicate' } }),
      });
      await expect(repo.create('abc123', 'https://example.com')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
