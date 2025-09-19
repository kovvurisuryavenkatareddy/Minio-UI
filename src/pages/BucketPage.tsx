import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { s3Client } from "@/lib/s3Client";
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
import { ArrowLeft, Folder, File } from "lucide-react";

const BucketPage = () => {
  const { bucketName } = useParams<{ bucketName: string }>();
  const [objects, setObjects] = useState<_Object[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bucketName) return;
    if (!s3Client) {
        setError("S3 client is not initialized.");
        setLoading(false);
        return;
    }

    const fetchObjects = async () => {
      try {
        const data = await s3Client.send(
          new ListObjectsV2Command({ Bucket: bucketName })
        );
        setObjects(data.Contents || []);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch objects from the bucket.");
      } finally {
        setLoading(false);
      }
    };

    fetchObjects();
  }, [bucketName]);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  return (
    <div className="container mx-auto p-4">
      <Button asChild variant="outline" className="mb-4">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Buckets
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Folder className="mr-2 h-5 w-5" />
            {bucketName}
          </CardTitle>
          <CardDescription>Objects in this bucket.</CardDescription>
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