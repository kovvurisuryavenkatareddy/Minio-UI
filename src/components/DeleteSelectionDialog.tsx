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
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

interface SelectedItem {
  key: string;
  type: 'file' | 'folder';
  size: number;
}

interface DeleteSelectionDialogProps {
  bucketName: string;
  selectedItems: SelectedItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeletionComplete: () => void;
}

export const DeleteSelectionDialog = ({ bucketName, selectedItems, open, onOpenChange, onDeletionComplete }: DeleteSelectionDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!s3Client) {
      showError("S3 client not initialized.");
      return;
    }
    if (selectedItems.length === 0) {
      showError("No items selected for deletion.");
      return;
    }

    setIsDeleting(true);
    const loadingToast = showLoading("Preparing to delete selection...");

    try {
      const keysToDelete: string[] = [];
      let totalSize = 0;

      const files = selectedItems.filter(item => item.type === 'file');
      const folders = selectedItems.filter(item => item.type === 'folder');

      for (const file of files) {
        keysToDelete.push(file.key);
        totalSize += file.size || 0;
      }

      for (const folder of folders) {
        dismissToast(loadingToast);
        showLoading(`Listing files in ${folder.key.split('/').slice(-2, -1)[0]}...`);
        
        let continuationToken: string | undefined = undefined;
        do {
          const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: folder.key,
            ContinuationToken: continuationToken,
          });
          const listResponse = await s3Client.send(listCommand);
          
          if (listResponse.Contents) {
            for (const object of listResponse.Contents) {
              if (object.Key) {
                keysToDelete.push(object.Key);
                totalSize += object.Size || 0;
              }
            }
          }
          continuationToken = listResponse.NextContinuationToken;
        } while (continuationToken);
      }

      if (keysToDelete.length === 0) {
        dismissToast(loadingToast);
        showSuccess("Selection contains no files to delete.");
        onDeletionComplete();
        onOpenChange(false);
        return;
      }

      dismissToast(loadingToast);
      showLoading(`Deleting ${keysToDelete.length} file(s)...`);

      for (let i = 0; i < keysToDelete.length; i += 1000) {
        const chunk = keysToDelete.slice(i, i + 1000);
        const deleteParams = {
          Bucket: bucketName,
          Delete: { Objects: chunk.map(Key => ({ Key })) },
        };
        await s3Client.send(new DeleteObjectsCommand(deleteParams));
      }

      if (totalSize > 0) {
        const { error } = await supabase.rpc('adjust_space_used', { space_change: -totalSize });
        if (error) {
          console.error("Failed to update space usage:", error);
          showError("Items deleted, but failed to update space usage.");
        }
      }

      dismissToast(loadingToast);
      showSuccess(`${selectedItems.length} item(s) and their contents deleted successfully.`);
      onDeletionComplete();
      onOpenChange(false);
    } catch (err: any) {
      dismissToast(loadingToast);
      console.error(err);
      showError(err.message || "Failed to delete selected items.");
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
            This action cannot be undone. This will permanently delete the selected <strong>{selectedItems.length}</strong> item(s) and all their contents.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Selection"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};