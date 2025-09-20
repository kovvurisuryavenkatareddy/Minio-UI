import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isRecoveryFlow = useRef(false);

  useEffect(() => {
    setLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        isRecoveryFlow.current = true;
        setLoading(false);
        navigate('/update-password');
        // We don't set the session in our React state to prevent ProtectedRoute
        // from granting access to the main app. The Supabase client itself
        // is aware of the temporary session from the URL hash.
        return;
      }

      if (event === 'SIGNED_IN' && isRecoveryFlow.current) {
        // This is the temporary sign-in that follows a password recovery event.
        // We ignore it to prevent the user from being logged in.
        setLoading(false);
        return;
      }
      
      if (event === 'SIGNED_OUT') {
        isRecoveryFlow.current = false; // Reset the flag on sign out
      }

      // For all normal events, update the session.
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};