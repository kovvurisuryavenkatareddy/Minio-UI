import { useState } from "react";
import { s3Client } from "@/lib/s3Client";
import {
  DeleteBucketCommand,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "./ui/button";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

interface Bucket {
  id: string;
  name: string;
}

interface DeleteBucketDialogProps {
  bucket: Bucket | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBucketDeleted: () => void;
}

export const DeleteBucketDialog = ({ bucket, open, onOpenChange, onBucketDeleted }: DeleteBucketDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!bucket || !s3Client) {
      showError("S3 client not initialized or bucket is missing.");
      return;
    }
    setIsDeleting(true);
    const loadingToast = showLoading(`Preparing to delete bucket "${bucket.name}"...`);

    try {
      // Step 1: List all object versions and delete markers in the bucket
      let isTruncated = true;
      let keyMarker: string | undefined = undefined;
      let versionIdMarker: string | undefined = undefined;
      
      dismissToast(loadingToast);
      const deletingObjectsToast = showLoading(`Deleting objects from bucket "${bucket.name}"...`);

      while (isTruncated) {
        const { Versions, DeleteMarkers, IsTruncated, NextKeyMarker, NextVersionIdMarker } = await s3Client.send(
          new ListObjectVersionsCommand({
            Bucket: bucket.name,
            KeyMarker: keyMarker,
            VersionIdMarker: versionIdMarker,
          })
        );

        const objectsToDelete = [
          ...(Versions || []).map(v => ({ Key: v.Key, VersionId: v.VersionId })),
          ...(DeleteMarkers || []).map(m => ({ Key: m.Key, VersionId: m.VersionId }))
        ];

        // Step 2: Delete all objects and versions if any exist
        if (objectsToDelete.length > 0) {
          // S3 DeleteObjects can handle up to 1000 objects per request
          for (let i = 0; i < objectsToDelete.length; i += 1000) {
            const chunk = objectsToDelete.slice(i, i + 1000);
            await s3Client.send(new DeleteObjectsCommand({
              Bucket: bucket.name,
              Delete: { Objects: chunk },
            }));
          }
        }

        isTruncated = !!IsTruncated;
        keyMarker = NextKeyMarker;
        versionIdMarker = NextVersionIdMarker;
      }
      
      dismissToast(deletingObjectsToast);
      const deletingBucketToast = showLoading(`Deleting bucket "${bucket.name}"...`);

      // Step 3: Delete the now-empty bucket from MinIO
      await s3Client.send(new DeleteBucketCommand({ Bucket: bucket.name }));

      // Step 4: Delete the bucket record from Supabase
      const { error: supabaseError } = await supabase.from("buckets").delete().eq("id", bucket.id);
      if (supabaseError) throw supabaseError;

      dismissToast(deletingBucketToast);
      showSuccess(`Bucket "${bucket.name}" and all its contents have been deleted.`);
      onBucketDeleted();
      onOpenChange(false);
    } catch (err: any) {
      dismissToast(loadingToast);
      console.error(err);
      showError(err.message || "An unexpected error occurred during bucket deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the <strong>{bucket?.name}</strong> bucket and all of its contents, including all file versions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};