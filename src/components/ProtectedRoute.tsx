import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import { Skeleton } from './ui/skeleton';

const ProtectedRoute = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <Skeleton className="h-12 w-1/2 mb-4" />
            <Skeleton className="h-32 w-full max-w-2xl" />
        </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;