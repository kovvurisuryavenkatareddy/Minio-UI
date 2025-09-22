import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { showError } from '@/utils/toast';

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'user' | 'admin';
  is_active: boolean;
  space_limit: number;
  space_used: number;
  email?: string;
}

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  updateSpaceUsage: (bytes: number) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: true,
  updateSpaceUsage: async () => {},
});

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

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

  const updateSpaceUsage = async (bytes: number) => {
    if (!profile) return;

    const newUsage = Math.max(0, (profile.space_used || 0) + bytes);
    const oldProfile = { ...profile };

    // Optimistic update of the UI
    setProfile({ ...profile, space_used: newUsage });

    const { error } = await supabase
      .from('profiles')
      .update({ space_used: newUsage })
      .eq('id', profile.id);

    if (error) {
      setProfile(oldProfile); // Rollback on error
      showError("Failed to update space usage.");
      console.error("Space usage update error:", error);
    } else {
      // Invalidate stats so admin dashboard updates
      queryClient.invalidateQueries({ queryKey: ["storageStats"] });
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, loading, updateSpaceUsage }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  return useContext(ProfileContext);
};