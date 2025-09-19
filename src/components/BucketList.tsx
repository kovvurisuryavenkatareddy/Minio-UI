import { useEffect, useState } from "react";
import { s3Client, connectionError } from "@/lib/s3Client";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Server } from "lucide-react";

interface Bucket {
  Name?: string;
  CreationDate?: Date;
}

const BucketList = () => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    const fetchBuckets = async () => {
      try {
        const data = await s3Client.send(new ListBucketsCommand({}));
        setBuckets(data.Buckets ||);
      } catch (err) {
        console.error(err);
        setError(
          "Failed to fetch buckets. Please check your credentials and that your MinIO server is accessible (you may need to configure its CORS policy)."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchBuckets();
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Server className="mr-2 h-5 w-5" />
          MinIO Buckets
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
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
                  key={bucket.Name}
                  className="rounded-md border p-3 text-sm"
                >
                  {bucket.Name}
                </li>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No buckets found.</p>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default BucketList;