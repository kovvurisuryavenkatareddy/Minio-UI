import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { s3Client } from "@/lib/s3Client";
import { CreateBucketCommand } from "@aws-sdk/client-s3";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { showSuccess, showError } from "@/utils/toast";

const formSchema = z.object({
  bucketName: z.string().min(3, "Bucket name must be at least 3 characters long."),
});

interface CreateBucketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBucketCreated: () => void;
}

export const CreateBucketDialog = ({ open, onOpenChange, onBucketCreated }: CreateBucketDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bucketName: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!s3Client) {
      showError("S3 client is not initialized.");
      return;
    }
    setIsSubmitting(true);
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: values.bucketName }));
      showSuccess(`Bucket "${values.bucketName}" created successfully.`);
      onBucketCreated();
      onOpenChange(false);
      form.reset();
    } catch (err) {
      console.error(err);
      showError("Failed to create bucket. Check the console for more details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Bucket</DialogTitle>
          <DialogDescription>
            Enter a unique name for your new bucket.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="bucketName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bucket Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., my-awesome-bucket" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Bucket"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};