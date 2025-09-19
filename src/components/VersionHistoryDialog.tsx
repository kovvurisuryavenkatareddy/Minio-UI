import { useEffect, useState, useCallback } from "react";
import { s3Client } from "@/lib/s3Client";
import { ListObjectVersionsCommand, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, ObjectVersion } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MoreVertical, History, Download, Trash2, AlertTriangle } from "lucide-react";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

interface VersionHistoryDialogProps {
  bucketName: string;
  objectKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVersionRestored: () => void;
}

export const VersionHistoryDialog = ({ bucketName, objectKey, open, onOpenChange, onVersionRestored }: VersionHistoryDialogProps) => {
  const [versions, setVersions] = useState<ObjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const command = new ListObjectVersionsCommand({ Bucket: bucketName, Prefix: objectKey });
      const data = await s3Client.send(command);
      // Filter out delete markers and sort by last modified date descending
      const sortedVersions = (data.Versions || []).sort((a, b) => 
        (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
      );
      setVersions(sortedVersions);
      if (sortedVersions.length === 0) {
        setError("No version history found for this file. Versioning might not be enabled for this bucket.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch file versions.");
    } finally {
      setLoading(false);
    }
  }, [bucketName, objectKey, open]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleRestore = async (versionId: string) => {
    const loadingToast = showLoading("Restoring version...");
    try {
      const command = new CopyObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        CopySource: `${bucketName}/${objectKey}?versionId=${versionId}`,
      });
      await s3Client.send(command);
      dismissToast(loadingToast);
      showSuccess("Version restored successfully. The file list will refresh.");
      onVersionRestored();
      onOpenChange(false);
    } catch (err: any) {
      dismissToast(loadingToast);
      console.error(err);
      showError("Failed to restore version.");
    }
  };

  const handleDownload = async (versionId: string) => {
    try {
      const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey, VersionId: versionId });
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', objectKey.split('/').pop() || 'download');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      showError("Failed to generate download link.");
    }
  };

  const handleDelete = async (versionId: string) => {
     const loadingToast = showLoading("Deleting version...");
    try {
      const command = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey, VersionId: versionId });
      await s3Client.send(command);
      dismissToast(loadingToast);
      showSuccess("Version permanently deleted.");
      fetchVersions(); // Refresh the list
    } catch (err: any) {
      dismissToast(loadingToast);
      console.error(err);
      showError("Failed to delete version.");
    }
  };

  const formatBytes = (bytes?: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Version History: {objectKey.split('/').pop()}</DialogTitle>
          <DialogDescription>
            Review and manage previous versions of this file. Restoring a version will make it the current one.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : error ? (
            <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Date Modified</TableHead><TableHead>Size</TableHead><TableHead>Version ID</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.VersionId}>
                    <TableCell>
                      {version.LastModified?.toLocaleString()}
                      {version.IsLatest && <Badge className="ml-2">Latest</Badge>}
                    </TableCell>
                    <TableCell>{formatBytes(version.Size)}</TableCell>
                    <TableCell className="font-mono text-xs">{version.VersionId?.substring(0, 12)}...</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {!version.IsLatest && <DropdownMenuItem onClick={() => handleRestore(version.VersionId!)}><History className="mr-2 h-4 w-4" /> Restore</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => handleDownload(version.VersionId!)}><Download className="mr-2 h-4 w-4" /> Download</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(version.VersionId!)}><Trash2 className="mr-2 h-4 w-4" /> Delete Permanently</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};