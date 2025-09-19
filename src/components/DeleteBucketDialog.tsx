import { useState } from "react";
import { s3Client } from "@/lib/s3Client";
import { DeleteBucketCommand } from "@aws-sdk/client-s3";
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
import { showSuccess, showError } from "@/utils/toast";

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
    try {
      // 1. Delete from MinIO
      await s3Client.send(new DeleteBucketCommand({ Bucket: bucket.name }));

      // 2. Delete from Supabase
      const { error: supabaseError } = await supabase.from("buckets").delete().eq("id", bucket.id);
      if (supabaseError) throw supabaseError;

      showSuccess(`Bucket "${bucket.name}" deleted successfully.`);
      onBucketDeleted();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to delete bucket. It might not be empty.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the <strong>{bucket?.name}</strong> bucket.
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