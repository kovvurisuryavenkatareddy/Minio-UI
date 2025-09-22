import { useState } from "react";
import { useProfile } from "@/contexts/ProfileContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HardDrive } from "lucide-react";
import { RequestSpaceDialog } from "./RequestSpaceDialog";

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
  const [isRequestDialogOpen, setRequestDialogOpen] = useState(false);

  if (loading) {
    return <div className="px-6 py-4 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-2 w-3/4" /></div>;
  }

  if (!profile) return null;

  const usagePercent = profile.space_limit > 0 ? (profile.space_used / profile.space_limit) * 100 : 0;

  return (
    <>
      <div className="px-6 py-4 border-t">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="font-semibold">Storage</span>
          </div>
          <span>{formatBytes(profile.space_used)} of {formatBytes(profile.space_limit)}</span>
        </div>
        <Progress value={usagePercent} />
        <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setRequestDialogOpen(true)}>
          Request More Space
        </Button>
      </div>
      <RequestSpaceDialog open={isRequestDialogOpen} onOpenChange={setRequestDialogOpen} />
    </>
  );
};