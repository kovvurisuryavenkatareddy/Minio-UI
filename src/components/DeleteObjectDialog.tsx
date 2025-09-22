import { useState } from "react";
import { s3Client } from "@/lib/s3Client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
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
import { useProfile } from "@/contexts/ProfileContext";

interface DeleteObjectDialogProps {
  bucketName: string;
  objectKey: string;
  objectSize: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onObjectDeleted: () => void;
}

export const DeleteObjectDialog = ({ bucketName, objectKey, objectSize, open, onOpenChange, onObjectDeleted }: DeleteObjectDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { updateSpaceUsage } = useProfile();

  const handleDelete = async () => {
    if (!s3Client) {
        showError("S3 client not initialized.");
        return;
    }
    setIsDeleting(true);
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }));
      await updateSpaceUsage(-objectSize);
      showSuccess(`File "${objectKey.split('/').pop()}" deleted successfully.`);
      onObjectDeleted();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to delete file.");
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
            This action cannot be undone. This will permanently delete the file <strong>{objectKey.split('/').pop()}</strong>.
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