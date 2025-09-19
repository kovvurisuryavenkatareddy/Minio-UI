import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { s3Client } from "@/lib/s3Client";
import { CreateBucketCommand, PutBucketVersioningCommand } from "@aws-sdk/client-s3";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/utils/toast";

const formSchema = z.object({
  bucketName: z.string().min(3, "Bucket name must be at least 3 characters long."),
  is_public: z.boolean().default(false),
});

interface CreateBucketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBucketCreated: () => void;
}

export const CreateBucketDialog = ({ open, onOpenChange, onBucketCreated }: CreateBucketDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { session } = useAuth();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bucketName: "",
      is_public: false,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!s3Client) {
      showError("S3 client is not initialized.");
      return;
    }
    if (!session?.user) {
      showError("You must be logged in to create a bucket.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create the bucket in MinIO
      await s3Client.send(new CreateBucketCommand({ Bucket: values.bucketName }));

      // 2. Enable versioning on the new bucket
      await s3Client.send(new PutBucketVersioningCommand({
        Bucket: values.bucketName,
        VersioningConfiguration: {
          Status: "Enabled",
        },
      }));

      // 3. Create the bucket record in Supabase
      const { error: supabaseError } = await supabase.from("buckets").insert({
        name: values.bucketName,
        owner_id: session.user.id,
        is_public: values.is_public,
      });

      if (supabaseError) {
        throw new Error(`Failed to save bucket metadata: ${supabaseError.message}`);
      }

      showSuccess(`Bucket "${values.bucketName}" created successfully with versioning enabled.`);
      onBucketCreated();
      onOpenChange(false);
      form.reset();
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to create bucket. Check the console for more details.");
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
            Enter a unique name for your new bucket. Versioning will be enabled by default.
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
            <FormField
              control={form.control}
              name="is_public"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Public Bucket</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Anyone will be able to view the contents of this bucket.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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