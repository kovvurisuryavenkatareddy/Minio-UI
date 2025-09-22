import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { showSuccess, showError } from "@/utils/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";

const formSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive."),
  unit: z.enum(["MB", "GB"]),
  reason: z.string().optional(),
});

interface RequestSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RequestSpaceDialog = ({ open, onOpenChange }: RequestSpaceDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const { data: pastRequests, isLoading } = useQuery({
    queryKey: ["spaceRequests", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space_requests")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user && open,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 10, unit: "GB", reason: "" },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const multiplier = values.unit === "GB" ? 1024 * 1024 * 1024 : 1024 * 1024;
    const requested_space = values.amount * multiplier;

    try {
      const { error } = await supabase.from("space_requests").insert({
        user_id: session!.user.id,
        requested_space,
        reason: values.reason,
      });
      if (error) throw error;
      showSuccess("Your space request has been submitted.");
      queryClient.invalidateQueries({ queryKey: ["spaceRequests", session?.user.id] });
      form.reset();
    } catch (err: any) {
      showError(err.message || "Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge variant="default">Approved</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request More Storage</DialogTitle>
          <DialogDescription>
            Submit a request for additional storage space. An admin will review it shortly.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-end gap-2">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem className="flex-1"><FormLabel>Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem><FormControl>
                  <select {...field} className="h-10 rounded-md border px-2">
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                  </select>
                </FormControl></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem><FormLabel>Reason (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., For new project files" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Your Past Requests</h3>
          <div className="rounded-md border max-h-60 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  : pastRequests?.map(req => (
                    <TableRow key={req.id}>
                      <TableCell>{new Date(req.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{(req.requested_space / (1024*1024*1024)).toFixed(2)} GB</TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};