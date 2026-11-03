import { Test, TestingModule } from '@nestjs/testing';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SUPABASE_CLIENT } from './supabase/supabase.constants';

describe('AppController', () => {
  let appController: AppController;
  let mockSupabase: any;
  let limit: jest.Mock;

  const createController = async (supabase: unknown) => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: SUPABASE_CLIENT, useValue: supabase }],
    }).compile();

    return app.get<AppController>(AppController);
  };

  beforeEach(async () => {
    limit = jest.fn().mockResolvedValue({ data: [], error: null });
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ limit }),
      }),
    };

    appController = await createController(mockSupabase);
  });

  describe('health', () => {
    it('should return health status', () => {
      const health = appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('database health', () => {
    let loggerError: jest.SpyInstance;

    beforeEach(() => {
      loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    afterEach(() => {
      loggerError.mockRestore();
    });

    it('should query the urls table and return ok', async () => {
      const health = await appController.getDatabaseHealth();

      expect(mockSupabase.from).toHaveBeenCalledWith('urls');
      expect(limit).toHaveBeenCalledWith(1);
      expect(health.status).toBe('ok');
      expect(health.timestamp).toBeDefined();
    });

    it('should throw 503 when the query fails', async () => {
      limit.mockResolvedValue({ data: null, error: { message: 'connection refused' } });

      await expect(appController.getDatabaseHealth()).rejects.toThrow(ServiceUnavailableException);
    });

    it('should log driver error details instead of returning them', async () => {
      limit.mockResolvedValue({ data: null, error: { message: 'connection refused' } });

      await expect(appController.getDatabaseHealth()).rejects.toThrow('Database is unreachable');
      expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('connection refused'));
    });

    it('should throw 503 when Supabase is not configured', async () => {
      const controller = await createController(null);

      await expect(controller.getDatabaseHealth()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
