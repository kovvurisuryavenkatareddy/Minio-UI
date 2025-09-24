import { useProfile } from "@/contexts/ProfileContext";
import { Skeleton } from "@/components/ui/skeleton";
import { HardDrive } from "lucide-react";

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const SpaceUsageIndicator = () => {
  const { profile, loading } = useProfile();

  if (loading) {
    return <div className="px-6 py-4 space-y-2"><Skeleton className="h-4 w-full" /></div>;
  }

  if (!profile) return null;

  return (
    <div className="px-6 py-4 border-t">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          <span className="font-semibold">Storage Used</span>
        </div>
        <span>{formatBytes(profile.space_used)}</span>
      </div>
    </div>
  );
};