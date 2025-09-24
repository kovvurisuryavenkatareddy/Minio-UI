import { useState, useRef } from "react";
import { s3Client } from "@/lib/s3Client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { FolderUp } from "lucide-react";

interface UploadFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  bucketName: string;
  currentPrefix: string;
}

export const UploadFolderDialog = ({ open, onOpenChange, onUploadComplete, bucketName, currentPrefix }: UploadFolderDialogProps) => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(event.target.files);
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      showError("Please select a folder to upload.");
      return;
    }
    if (!s3Client) {
      showError("S3 client is not initialized.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const loadingToast = showLoading(`Uploading ${files.length} file(s)...`);

    try {
      const totalFiles = files.length;
      let totalSize = 0;
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const fileKey = `${currentPrefix}${file.webkitRelativePath}`;
        
        const fileBuffer = await file.arrayBuffer();
        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
          Body: fileBuffer,
          ContentType: file.type,
        }));
        totalSize += file.size;
        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      if (totalSize > 0) {
        const { error } = await supabase.rpc('adjust_space_used', { space_change: totalSize });
        if (error) {
          console.error("Failed to update space usage:", error);
          showError("Folder uploaded, but failed to update space usage.");
        }
      }

      dismissToast(loadingToast);
      showSuccess(`Folder and its ${totalFiles} file(s) uploaded successfully.`);
      onUploadComplete();
      onOpenChange(false);
      setFiles(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      dismissToast(loadingToast);
      console.error(err);
      showError(err.message || "Failed to upload folder.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Folder</DialogTitle>
          <DialogDescription>
            Select a folder to upload. All files and sub-folders will be included.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="folder-upload">Folder</Label>
            <Input 
              id="folder-upload" 
              type="file" 
              onChange={handleFileChange} 
              ref={fileInputRef} 
              {...{ webkitdirectory: "true" }}
            />
          </div>
          {files && files.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <p>{files.length} file(s) selected from folder.</p>
            </div>
          )}
          {isUploading && <Progress value={uploadProgress} />}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !files || files.length === 0}>
            <FolderUp className="mr-2 h-4 w-4" />
            {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : "Upload Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};