import { useState } from "react";
import { s3Client } from "@/lib/s3Client";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
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

interface S3Object {
  key: string;
  size: number;
}

interface DeleteMultipleObjectsDialogProps {
  bucketName: string;
  objects: S3Object[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onObjectsDeleted: () => void;
}

export const DeleteMultipleObjectsDialog = ({ bucketName, objects, open, onOpenChange, onObjectsDeleted }: DeleteMultipleObjectsDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { updateSpaceUsage } = useProfile();

  const handleDelete = async () => {
    if (!s3Client) {
      showError("S3 client not initialized.");
      return;
    }
    if (objects.length === 0) {
        showError("No files selected for deletion.");
        return;
    }

    setIsDeleting(true);
    try {
      const totalSize = objects.reduce((sum, obj) => sum + obj.size, 0);
      const objectKeys = objects.map(obj => obj.key);

      for (let i = 0; i < objectKeys.length; i += 1000) {
        const chunk = objectKeys.slice(i, i + 1000);
        const deleteParams = {
          Bucket: bucketName,
          Delete: {
            Objects: chunk.map(Key => ({ Key })),
          },
        };
        await s3Client.send(new DeleteObjectsCommand(deleteParams));
      }

      await updateSpaceUsage(-totalSize);
      showSuccess(`${objects.length} file(s) deleted successfully.`);
      onObjectsDeleted();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to delete selected files.");
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
            This action cannot be undone. This will permanently delete the selected <strong>{objects.length}</strong> file(s).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Selected"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};