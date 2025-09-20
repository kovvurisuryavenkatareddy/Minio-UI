import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { s3Client, connectionError } from "@/lib/s3Client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Server, Trash2, PlusCircle, Globe, Lock } from "lucide-react";
import { CreateBucketDialog } from "./CreateBucketDialog";
import { DeleteBucketDialog } from "./DeleteBucketDialog";
import { Badge } from "./ui/badge";

interface Bucket {
  id: string;
  name: string;
  owner_id: string;
  is_public: boolean;
}

const BucketList = () => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [bucketToDelete, setBucketToDelete] = useState<Bucket | null>(null);
  const { session } = useAuth();

  const fetchBuckets = useCallback(async () => {
    setLoading(true);
    if (connectionError) {
      setError(connectionError);
      setLoading(false);
      return;
    }
    if (!s3Client) {
      setError("S3 client could not be initialized.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: supabaseError } = await supabase.from("buckets").select("*");
      if (supabaseError) throw supabaseError;

      setBuckets(data || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(
        "Failed to fetch buckets. Please check your credentials and that your MinIO server is accessible (you may need to configure its CORS policy)."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center">
                <Server className="mr-2 h-5 w-5" />
                MinIO Buckets
              </CardTitle>
              <CardDescription>Click on a bucket to view its contents.</CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Bucket
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!loading && !error && (
            <ul className="space-y-2">
              {buckets.length > 0 ? (
                buckets.map((bucket) => (
                  <li
                    key={bucket.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Link to={`/bucket/${bucket.name}`} className="font-medium hover:underline">
                        {bucket.name}
                      </Link>
                      {bucket.is_public ? (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Public
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                           <Lock className="h-3 w-3" /> Private
                        </Badge>
                      )}
                    </div>
                    {session?.user.id === bucket.owner_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setBucketToDelete(bucket)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </li>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No buckets found. Why not create one?</p>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
      <CreateBucketDialog
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onBucketCreated={fetchBuckets}
      />
      {bucketToDelete && (
        <DeleteBucketDialog
          bucket={bucketToDelete}
          open={!!bucketToDelete}
          onOpenChange={() => setBucketToDelete(null)}
          onBucketDeleted={fetchBuckets}
        />
      )}
    </>
  );
};

export default BucketList;