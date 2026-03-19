import TanStackQueryProvider from '@/vendors/tanstack-query/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <TanStackQueryProvider>{children}</TanStackQueryProvider>;
}
