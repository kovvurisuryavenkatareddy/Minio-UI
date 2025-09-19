import BucketList from "@/components/BucketList";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 pt-10 relative">
      <header className="w-full max-w-2xl flex justify-between items-center mb-6">
        <div>
          {session && <p className="text-sm text-muted-foreground">Signed in as {session.user.email}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </header>
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center">
          MinIO Bucket Explorer
        </h1>
        <BucketList />
      </div>
      <div className="absolute bottom-0 p-4">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;