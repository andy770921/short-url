import TanStackQueryProvider from '@/vendors/tanstack-query/provider';
import { ThemeProvider } from '@/components/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TanStackQueryProvider>{children}</TanStackQueryProvider>
    </ThemeProvider>
  );
}
