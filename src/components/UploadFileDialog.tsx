import { useState, useRef } from "react";
import { s3Client } from "@/lib/s3Client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
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
import { UploadCloud } from "lucide-react";
import { useProfile } from "@/contexts/ProfileContext";

interface UploadFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  bucketName: string;
  currentPrefix: string;
}

export const UploadFileDialog = ({ open, onOpenChange, onUploadComplete, bucketName, currentPrefix }: UploadFileDialogProps) => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateSpaceUsage } = useProfile();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(event.target.files);
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      showError("Please select at least one file to upload.");
      return;
    }
    if (!s3Client) {
      showError("S3 client is not initialized.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const loadingToast = showLoading(`Uploading ${files.length} file(s)...`);
    let totalSize = 0;

    try {
      const totalFiles = files.length;
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        totalSize += file.size;
        const fileKey = `${currentPrefix}${file.name}`;
        
        const fileBuffer = await file.arrayBuffer();
        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
          Body: fileBuffer,
          ContentType: file.type,
        }));
        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      await updateSpaceUsage(totalSize);
      dismissToast(loadingToast);
      showSuccess(`${totalFiles} file(s) uploaded successfully.`);
      onUploadComplete();
      onOpenChange(false);
      setFiles(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      dismissToast(loadingToast);
      console.error(err);
      showError(err.message || "Failed to upload files.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Select files to upload to the current folder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="files">Files</Label>
            <Input id="files" type="file" multiple onChange={handleFileChange} ref={fileInputRef} />
          </div>
          {files && files.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <p>{files.length} file(s) selected:</p>
              <ul className="list-disc pl-5 max-h-32 overflow-y-auto">
                {Array.from(files).map((file, i) => <li key={i}>{file.name}</li>)}
              </ul>
            </div>
          )}
          {isUploading && <Progress value={uploadProgress} />}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !files || files.length === 0}>
            <UploadCloud className="mr-2 h-4 w-4" />
            {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};