import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { s3Client } from "@/lib/s3Client";
import { ListObjectsV2Command, CommonPrefix } from "@aws-sdk/client-s3";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Folder, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderTreeViewProps {
  bucketName: string;
  prefix: string;
}

const fetchFolders = async (bucketName: string, prefix: string) => {
  if (!s3Client) return [];
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    Delimiter: "/",
  });
  const data = await s3Client.send(command);
  return data.CommonPrefixes || [];
};

export const FolderTreeView = ({ bucketName, prefix }: FolderTreeViewProps) => {
  const params = useParams();
  const activePrefix = params["*"] || "";

  const { data: folders, isLoading } = useQuery({
    queryKey: ["sidebarTree", bucketName, prefix],
    queryFn: () => fetchFolders(bucketName, prefix),
  });

  if (isLoading) {
    return (
      <div className="pl-4 space-y-2 py-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  if (!folders || folders.length === 0) {
    return null;
  }

  return (
    <ul className="pl-4">
      {folders.map((folder: CommonPrefix) => {
        const key = folder.Prefix!;
        const name = key.replace(prefix, "").replace("/", "");
        const isActive = activePrefix.startsWith(key);

        return (
          <li key={key}>
            <Collapsible defaultOpen={isActive}>
              <div
                className={cn(
                  "flex items-center py-1 rounded-md group",
                  activePrefix === key && "bg-accent text-accent-foreground"
                )}
              >
                <CollapsibleTrigger className="p-1 rounded-sm hover:bg-muted">
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <Folder className="h-4 w-4 mx-2 text-blue-500" />
                <Link
                  to={`/bucket/${bucketName}/${key}`}
                  className="text-sm flex-1 truncate"
                >
                  {name}
                </Link>
              </div>
              <CollapsibleContent className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <FolderTreeView bucketName={bucketName} prefix={key} />
              </CollapsibleContent>
            </Collapsible>
          </li>
        );
      })}
    </ul>
  );
};