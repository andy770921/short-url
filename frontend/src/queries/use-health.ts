import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@repo/shared';

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['api', 'health'],
  });
}
