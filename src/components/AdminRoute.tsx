import { useProfile } from '@/contexts/ProfileContext';
import { Navigate, Outlet } from 'react-router-dom';
import { Skeleton } from './ui/skeleton';

const AdminRoute = () => {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <Skeleton className="h-12 w-1/2 mb-4" />
            <Skeleton className="h-32 w-full max-w-2xl" />
        </div>
    );
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;