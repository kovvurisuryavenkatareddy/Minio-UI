import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

const Login = () => {
  const { session } = useAuth();
  const [view, setView] = useState<'sign_in' | 'sign_up' | 'forgot_password'>('sign_in');

  if (session) {
    return <Navigate to="/" />;
  }

  const renderView = () => {
    switch (view) {
      case 'sign_up':
        return <SignUpForm setView={setView} />;
      case 'forgot_password':
        return <ForgotPasswordForm setView={setView} />;
      default:
        return <LoginForm setView={setView} />;
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md dark:bg-gray-800">
        {renderView()}
      </div>
    </div>
  );
};

export default Login;