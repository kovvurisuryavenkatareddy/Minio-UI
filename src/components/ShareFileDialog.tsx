import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { s3Client } from "@/lib/s3Client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/utils/toast";
import { Copy, Link as LinkIcon } from "lucide-react";

const formSchema = z.object({
  days: z.coerce.number().min(0).default(0),
  hours: z.coerce.number().min(0).max(23).default(0),
  minutes: z.coerce.number().min(0).max(59).default(15),
});

interface ShareFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketName: string;
  objectKey: string;
}

export const ShareFileDialog = ({ open, onOpenChange, bucketName, objectKey }: ShareFileDialogProps) => {
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      days: 0,
      hours: 0,
      minutes: 15,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { days, hours, minutes } = values;
    const expiresIn = (days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60);

    if (expiresIn <= 0) {
      showError("Expiration time must be greater than 0.");
      return;
    }
    if (expiresIn > 604800) { // 7 days in seconds, a common S3 limit
      showError("Expiration time cannot be more than 7 days.");
      return;
    }

    setIsGenerating(true);
    try {
      const command = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
      const url = await getSignedUrl(s3Client, command, { expiresIn });
      setGeneratedUrl(url);
    } catch (err) {
      console.error(err);
      showError("Failed to generate shareable link.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl);
    showSuccess("Link copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setGeneratedUrl("");
        form.reset();
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share File: {objectKey.split('/').pop()}</DialogTitle>
          <DialogDescription>
            Generate a temporary, shareable link for this file. The maximum duration is 7 days.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="23" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minutes</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="59" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" disabled={isGenerating} className="w-full">
              <LinkIcon className="mr-2 h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate Link"}
            </Button>
          </form>
        </Form>
        {generatedUrl && (
          <div className="mt-4 space-y-2">
            <Label>Shareable Link</Label>
            <div className="flex items-center space-x-2">
              <Input value={generatedUrl} readOnly />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};