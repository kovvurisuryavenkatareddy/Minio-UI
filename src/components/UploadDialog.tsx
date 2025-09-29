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
import { Progress } from "@/components/ui/progress";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { UploadCloud, File as FileIcon, FolderUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileToUpload {
  file: File;
  path: string;
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
  bucketName: string;
  currentPrefix: string;
}

export const UploadDialog = ({ open, onOpenChange, onUploadComplete, bucketName, currentPrefix }: UploadDialogProps) => {
  const [filesToUpload, setFilesToUpload] = useState<FileToUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFilesToUpload([]);
    setIsUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const newFiles: FileToUpload[] = Array.from(selectedFiles).map(file => ({
      file,
      // @ts-ignore - webkitRelativePath is key for folder uploads
      path: file.webkitRelativePath || file.name,
    }));
    setFilesToUpload(prev => [...prev, ...newFiles]);
  };

  const processEntries = async (entries: FileSystemEntry[]) => {
    const newFiles: FileToUpload[] = [];
    const loadingToast = showLoading("Processing dropped items...");

    const traverseFileTree = async (entry: FileSystemEntry | null) => {
      if (!entry) return;

      if (entry.isFile) {
        await new Promise<void>(resolve => {
          (entry as FileSystemFileEntry).file(file => {
            const fullPath = entry.fullPath.startsWith('/') ? entry.fullPath.substring(1) : entry.fullPath;
            newFiles.push({ file, path: fullPath });
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader();
        const childEntries = await new Promise<FileSystemEntry[]>(resolve => {
          dirReader.readEntries(entries => resolve(entries));
        });
        for (const childEntry of childEntries) {
          await traverseFileTree(childEntry);
        }
      }
    };

    for (const entry of entries) {
      await traverseFileTree(entry);
    }
    
    dismissToast(loadingToast);
    if (newFiles.length > 0) {
        setFilesToUpload(prev => [...prev, ...newFiles]);
    } else {
        showError("Could not find any files in the dropped items. Drag-and-drop for empty folders is not supported.");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.items) {
      const entries = Array.from(e.dataTransfer.items)
        .map(item => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null);
      processEntries(entries);
    } else {
      const newFiles: FileToUpload[] = Array.from(e.dataTransfer.files).map(file => ({
        file,
        path: file.name,
      }));
      setFilesToUpload(prev => [...prev, ...newFiles]);
    }
  };

  const handleUpload = async () => {
    if (filesToUpload.length === 0) {
      showError("No files to upload.");
      return;
    }
    if (!s3Client) {
      showError("S3 client is not initialized.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const loadingToast = showLoading(`Uploading ${filesToUpload.length} file(s)...`);

    try {
      let totalSize = 0;
      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, path } = filesToUpload[i];
        const fileKey = `${currentPrefix}${path}`;
        
        const fileBuffer = await file.arrayBuffer();
        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
          Body: fileBuffer,
          ContentType: file.type,
        }));
        totalSize += file.size;
        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }

      if (totalSize > 0) {
        const { error } = await supabase.rpc('adjust_space_used', { space_change: totalSize });
        if (error) {
          console.error("Failed to update space usage:", error);
          showError("Upload complete, but failed to update space usage.");
        }
      }

      dismissToast(loadingToast);
      showSuccess(`${filesToUpload.length} file(s) uploaded successfully.`);
      onUploadComplete();
      onOpenChange(false);
    } catch (err: any) {
      dismissToast(loadingToast);
      console.error(err);
      showError(err.message || "Failed to upload files.");
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Files and Folders</DialogTitle>
          <DialogDescription>
            Drag and drop files or folders, or use the buttons below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center",
              "transition-colors",
              isDragging ? "border-primary bg-primary/10" : "border-gray-300 dark:border-gray-600"
            )}
          >
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-muted-foreground">
              Drag & drop files or folders here
            </p>
          </div>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileIcon className="mr-2 h-4 w-4" /> Select Files
            </Button>
            <Button variant="outline" onClick={() => folderInputRef.current?.click()}>
              <FolderUp className="mr-2 h-4 w-4" /> Select Folder
            </Button>
            <Input
              type="file"
              multiple
              onChange={handleFilesSelected}
              ref={fileInputRef}
              className="hidden"
            />
            <Input 
              type="file" 
              onChange={handleFilesSelected} 
              ref={folderInputRef} 
              {...{ webkitdirectory: "true" }}
              className="hidden"
            />
          </div>
          {filesToUpload.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <p>{filesToUpload.length} file(s) queued for upload:</p>
              <ul className="list-disc pl-5 max-h-32 overflow-y-auto border rounded-md p-2 mt-1">
                {filesToUpload.map((f, i) => <li key={i} className="truncate">{f.path}</li>)}
              </ul>
            </div>
          )}
          {isUploading && <Progress value={uploadProgress} />}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || filesToUpload.length === 0}>
            <UploadCloud className="mr-2 h-4 w-4" />
            {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : `Upload ${filesToUpload.length} item(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};