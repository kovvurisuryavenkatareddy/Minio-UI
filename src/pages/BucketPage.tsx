import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { s3Client } from "@/lib/s3Client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ListObjectsV2Command, _Object } from "@aws-sdk/client-s3";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Folder, File, AlertTriangle } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

interface BucketDetails {
  id: string;
  owner_id: string;
  is_public: boolean;
}

const BucketPage = () => {
  const { bucketName } = useParams<{ bucketName: string }>();
  const { session } = useAuth();
  const [bucketDetails, setBucketDetails] = useState<BucketDetails | null>(null);
  const [objects, setObjects] = useState<_Object[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bucketName || !session) return;
    if (!s3Client) {
        setError("S3 client is not initialized.");
        setLoading(false);
        return;
    }

    const fetchBucketData = async () => {
      try {
        // 1. Fetch bucket metadata and check permissions from Supabase
        const { data: bucketData, error: supabaseError } = await supabase
          .from("buckets")
          .select("id, owner_id, is_public")
          .eq("name", bucketName)
          .single();

        if (supabaseError || !bucketData) {
          throw new Error("Bucket not found or you don't have permission to view it.");
        }
        setBucketDetails(bucketData);

        // 2. Fetch objects from MinIO
        const s3Data = await s3Client.send(
          new ListObjectsV2Command({ Bucket: bucketName })
        );
        setObjects(s3Data.Contents || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to fetch bucket data.");
      } finally {
        setLoading(false);
      }
    };

    fetchBucketData();
  }, [bucketName, session]);

  const handlePrivacyChange = async (isPublic: boolean) => {
    if (!bucketDetails) return;
    try {
      const { error } = await supabase
        .from("buckets")
        .update({ is_public: isPublic })
        .eq("id", bucketDetails.id);
      
      if (error) throw error;

      setBucketDetails({ ...bucketDetails, is_public: isPublic });
      showSuccess(`Bucket is now ${isPublic ? 'public' : 'private'}.`);
    } catch (err) {
      console.error(err);
      showError("Failed to update bucket privacy.");
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  const isOwner = session?.user.id === bucketDetails?.owner_id;

  return (
    <div className="container mx-auto p-4">
      <Button asChild variant="outline" className="mb-4">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Buckets
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center">
                <Folder className="mr-2 h-5 w-5" />
                {bucketName}
              </CardTitle>
              <CardDescription>Objects in this bucket.</CardDescription>
            </div>
            {isOwner && bucketDetails && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="privacy-switch">Private</Label>
                <Switch
                  id="privacy-switch"
                  checked={bucketDetails.is_public}
                  onCheckedChange={handlePrivacyChange}
                />
                <Label htmlFor="privacy-switch">Public</Label>
              </div>
            )}
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
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!loading && !error && bucketDetails && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Last Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objects.length > 0 ? (
                  objects.map((obj) => (
                    <TableRow key={obj.Key}>
                      <TableCell className="font-medium flex items-center">
                        <File className="mr-2 h-4 w-4 text-muted-foreground" />
                        {obj.Key}
                      </TableCell>
                      <TableCell>{formatBytes(obj.Size || 0)}</TableCell>
                      <TableCell>
                        {obj.LastModified?.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      No objects found in this bucket.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BucketPage;