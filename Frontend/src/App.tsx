import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes/AppRoutes';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        // Do not retry on 401, 403, or 404 errors
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403 || status === 404) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
