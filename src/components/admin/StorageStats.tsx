import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Database } from "lucide-react";

const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const StorageStats = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["totalStorageUsed"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_total_used_space');
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Statistics</CardTitle>
        <CardDescription>
          This shows the total storage used by all files uploaded by users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Used Space</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(data)}</div>
            </CardContent>
          </Card>
        )}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Note on Storage Metrics</AlertTitle>
          <AlertDescription>
            "Total Space" and "Available Space" for the MinIO server are not shown as they are infrastructure-level metrics not accessible by the application.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};