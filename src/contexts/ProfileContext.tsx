import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { User } from '@supabase/supabase-js';
import { useNavigate, useLocation } from 'react-router-dom';

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
  email?: string;
  requires_password_change?: boolean;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: true,
});

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (session?.user) {
      setLoading(true);
      const fetchProfile = async (user: User) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          setProfile(null);
        } else if (data) {
          if (data.requires_password_change && location.pathname !== '/update-password') {
            navigate('/update-password', { replace: true });
          } else {
            setProfile({ ...data, email: user.email });
          }
        }
        setLoading(false);
      };
      fetchProfile(session.user);
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [session, navigate, location.pathname]);

  return (
    <ProfileContext.Provider value={{ profile, loading }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  return useContext(ProfileContext);
};