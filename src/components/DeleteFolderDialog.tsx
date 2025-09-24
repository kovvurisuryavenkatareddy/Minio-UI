import { useState } from "react";
import { s3Client } from "@/lib/s3Client";
import { supabase } from "@/integrations/supabase/client";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
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

interface DeleteFolderDialogProps {
  bucketName: string;
  folderPrefix: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFolderDeleted: () => void;
}

export const DeleteFolderDialog = ({ bucketName, folderPrefix, open, onOpenChange, onFolderDeleted }: DeleteFolderDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!s3Client) {
      showError("S3 client not initialized.");
      return;
    }
    setIsDeleting(true);
    try {
      const listCommand = new ListObjectsV2Command({ Bucket: bucketName, Prefix: folderPrefix });
      const listedObjects = await s3Client.send(listCommand);

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        showSuccess("Folder is already empty and considered deleted.");
        onFolderDeleted();
        onOpenChange(false);
        return;
      }

      const totalSize = listedObjects.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);

      const deleteParams = {
        Bucket: bucketName,
        Delete: {
          Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
        },
      };

      await s3Client.send(new DeleteObjectsCommand(deleteParams));

      if (totalSize > 0) {
        const { error } = await supabase.rpc('adjust_space_used', { space_change: -totalSize });
        if (error) {
          console.error("Failed to update space usage:", error);
          showError("Folder deleted, but failed to update space usage.");
        }
      }

      showSuccess(`Folder "${folderPrefix.split('/').slice(-2, -1)[0]}" and its contents deleted successfully.`);
      onFolderDeleted();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to delete folder.");
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
            This action cannot be undone. This will permanently delete the folder 
            <strong> {folderPrefix.split('/').slice(-2, -1)[0]} </strong> 
            and all of its contents.
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