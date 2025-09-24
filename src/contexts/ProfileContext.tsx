import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
  space_used: number;
  email?: string;
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
        } else {
          setProfile({ ...data, email: user.email });
        }
        setLoading(false);
      };
      fetchProfile(session.user);
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [session]);

  return (
    <ProfileContext.Provider value={{ profile, loading }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  return useContext(ProfileContext);
};