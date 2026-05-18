import { ToastProvider } from '@/components/shared/Toast';
import LoginScreen from '@/components/login/LoginScreen';

interface PageProps {
  searchParams: { expired?: string };
}

export default function Home({ searchParams }: PageProps) {
  return (
    <ToastProvider>
      <LoginScreen sessionExpired={searchParams.expired === '1'} />
    </ToastProvider>
  );
}
