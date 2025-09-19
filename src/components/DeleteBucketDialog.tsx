import { useState } from "react";
import { s3Client } from "@/lib/s3Client";
import { DeleteBucketCommand } from "@aws-sdk/client-s3";
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

interface DeleteBucketDialogProps {
  bucketName: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBucketDeleted: () => void;
}

export const DeleteBucketDialog = ({ bucketName, open, onOpenChange, onBucketDeleted }: DeleteBucketDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!bucketName || !s3Client) {
        showError("S3 client not initialized or bucket name is missing.");
        return;
    }
    setIsDeleting(true);
    try {
      await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
      showSuccess(`Bucket "${bucketName}" deleted successfully.`);
      onBucketDeleted();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      showError("Failed to delete bucket. It might not be empty.");
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
            This action cannot be undone. This will permanently delete the <strong>{bucketName}</strong> bucket.
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