import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { s3Client } from "@/lib/s3Client";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HardDrive, Folder, File, AlertTriangle } from "lucide-react";

interface Bucket {
  id: string;
  name: string;
}

interface SearchResultItem {
  type: 'folder' | 'file';
  name: string;
  path: string;
  bucketName: string;
  lastModified?: Date;
  size?: number;
}

const fetchSearchResults = async (query: string) => {
  if (!query) return { buckets: [], objects: [] };

  const { data: allBuckets, error: bucketsError } = await supabase.from("buckets").select("id, name");
  if (bucketsError) throw new Error(bucketsError.message);

  const matchingBuckets = (allBuckets || []).filter(b => b.name.toLowerCase().includes(query.toLowerCase()));

  const objectSearchPromises = (allBuckets || []).map(async (bucket) => {
    if (!s3Client) return [];
    try {
      const command = new ListObjectsV2Command({ Bucket: bucket.name, Prefix: query });
      const data = await s3Client.send(command);
      
      const folders: SearchResultItem[] = (data.CommonPrefixes || []).map(p => ({
        type: 'folder',
        name: p.Prefix!.split('/').slice(-2, -1)[0],
        path: `/bucket/${bucket.name}/${p.Prefix!}`,
        bucketName: bucket.name,
      }));

      const files: SearchResultItem[] = (data.Contents || []).filter(f => f.Key !== query && !f.Key?.endsWith('/')).map(f => {
        const containingFolder = f.Key!.substring(0, f.Key!.lastIndexOf('/') + 1);
        return {
          type: 'file',
          name: f.Key!.split('/').pop()!,
          path: `/bucket/${bucket.name}/${containingFolder}`,
          bucketName: bucket.name,
          lastModified: f.LastModified,
          size: f.Size,
        };
      });

      return [...folders, ...files];
    } catch (error) {
      console.warn(`Could not search in bucket ${bucket.name}:`, error);
      return [];
    }
  });

  const objectResultsNested = await Promise.all(objectSearchPromises);
  const matchingObjects = objectResultsNested.flat();

  return { buckets: matchingBuckets, objects: matchingObjects };
};

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchSearchResults(query),
    enabled: !!query,
  });

  const formatBytes = (bytes?: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  const renderResults = (items: (SearchResultItem | Bucket)[]) => {
    if (items.length === 0) {
      return <p className="text-muted-foreground text-center py-8">No results found.</p>;
    }
    return (
      <ul className="space-y-2">
        {items.map((item, index) => {
          const isBucket = 'id' in item;
          const resultItem = isBucket ? {
            type: 'bucket', name: item.name, path: `/bucket/${item.name}`, bucketName: item.name
          } : item as SearchResultItem;

          const icon = {
            bucket: <HardDrive className="h-5 w-5 text-primary" />,
            folder: <Folder className="h-5 w-5 text-blue-500" />,
            file: <File className="h-5 w-5 text-muted-foreground" />,
          }[resultItem.type as 'bucket' | 'folder' | 'file'];

          return (
            <li key={`${resultItem.path}-${index}`}>
              <Link to={resultItem.path}>
                <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50">
                  <div className="flex items-center gap-3 truncate">
                    {icon}
                    <div className="truncate">
                      <p className="font-medium truncate">{resultItem.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        In bucket: {resultItem.bucketName}
                      </p>
                    </div>
                  </div>
                  {resultItem.type === 'file' && (
                    <div className="text-sm text-muted-foreground text-right flex-shrink-0 ml-4">
                      <p>{formatBytes(resultItem.size)}</p>
                      <p>{resultItem.lastModified?.toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Search Results for "{query}"
      </h1>
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Search Limitation</AlertTitle>
        <AlertDescription>
          Object search is prefix-based. For example, searching for "img" will find "img/photo.jpg" but not "photos/img.jpg".
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({(data?.buckets.length || 0) + (data?.objects.length || 0)})</TabsTrigger>
            <TabsTrigger value="buckets">Buckets ({data?.buckets.length || 0})</TabsTrigger>
            <TabsTrigger value="objects">Files & Folders ({data?.objects.length || 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4"><Card><CardContent className="pt-6">{renderResults([...(data?.buckets || []), ...(data?.objects || [])])}</CardContent></Card></TabsContent>
          <TabsContent value="buckets" className="mt-4"><Card><CardContent className="pt-6">{renderResults(data?.buckets || [])}</CardContent></Card></TabsContent>
          <TabsContent value="objects" className="mt-4"><Card><CardContent className="pt-6">{renderResults(data?.objects || [])}</CardContent></Card></TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default SearchPage;