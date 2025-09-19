import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";

interface PreviewFileDialogProps {
  url: string;
  fileName: string;
  fileType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PreviewFileDialog = ({ url, fileName, fileType, open, onOpenChange }: PreviewFileDialogProps) => {
  const isImage = fileType.startsWith("image/");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{fileName}</DialogTitle>
          <DialogDescription>
            {isImage ? "Image Preview" : "File Preview"}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 max-h-[70vh] overflow-auto">
          {isImage ? (
            <img src={url} alt={fileName} className="max-w-full h-auto mx-auto" />
          ) : (
            <div className="text-center p-8">
              <p className="mb-4">Preview is not available for this file type.</p>
              <Button asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">Open in New Tab</a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};