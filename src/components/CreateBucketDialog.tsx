import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { s3Client } from "@/lib/s3Client";
import { CreateBucketCommand, PutBucketVersioningCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { showSuccess, showError } from "@/utils/toast";

const formSchema = z.object({
  bucketName: z.string().min(3, "Bucket name must be at least 3 characters long."),
  public_level: z.string().default("private"),
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
      public_level: "private",
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
      await s3Client.send(new CreateBucketCommand({ Bucket: values.bucketName }));
      await s3Client.send(new PutBucketVersioningCommand({
        Bucket: values.bucketName,
        VersioningConfiguration: { Status: "Enabled" },
      }));

      const { error: supabaseError } = await supabase.from("buckets").insert({
        name: values.bucketName,
        owner_id: session.user.id,
        public_level: values.public_level,
      });

      if (supabaseError) {
        console.error("Supabase insert failed, cleaning up MinIO bucket...");
        await s3Client.send(new DeleteBucketCommand({ Bucket: values.bucketName }));
        throw new Error(`Failed to save bucket metadata: ${supabaseError.message}`);
      }

      showSuccess(`Bucket "${values.bucketName}" created successfully.`);
      onBucketCreated();
      onOpenChange(false);
      form.reset();
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to create bucket.");
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
            Enter a unique name and set the access level for your new bucket.
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
              name="public_level"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Bucket Access Level</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-2 pt-2"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="private" /></FormControl>
                        <FormLabel className="font-normal">Private</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="read-only" /></FormControl>
                        <FormLabel className="font-normal">Public Read-Only</FormLabel>
                      </FormItem>
                    </RadioGroup>
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