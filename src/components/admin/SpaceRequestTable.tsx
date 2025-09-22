import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Check, X } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

interface SpaceRequest {
  id: string;
  created_at: string;
  requested_space: number;
  reason: string;
  status: string;
  profiles: { email: string };
}

export const SpaceRequestTable = () => {
  const queryClient = useQueryClient();
  const [rejectionState, setRejectionState] = useState<{id: string, notes: string} | null>(null);

  const { data: requests, isLoading, isError, error } = useQuery<SpaceRequest[]>({
    queryKey: ["allSpaceRequests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space_requests")
        .select("*, profiles(email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SpaceRequest[];
    },
  });

  const handleApprove = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc('approve_space_request', { p_request_id: requestId });
      if (error) throw error;
      showSuccess("Request approved.");
      queryClient.invalidateQueries({ queryKey: ["allSpaceRequests"] });
      queryClient.invalidateQueries({ queryKey: ["storageStats"] });
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleReject = async () => {
    if (!rejectionState) return;
    try {
      const { error } = await supabase.rpc('reject_space_request', { p_request_id: rejectionState.id, p_notes: rejectionState.notes });
      if (error) throw error;
      showSuccess("Request rejected.");
      queryClient.invalidateQueries({ queryKey: ["allSpaceRequests"] });
      setRejectionState(null);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const formatBytes = (bytes: number) => (bytes / (1024*1024*1024)).toFixed(2) + ' GB';
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge>Approved</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
            : isError ? <TableRow><TableCell colSpan={6}><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert></TableCell></TableRow>
            : requests?.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{req.profiles.email}</TableCell>
                  <TableCell>{new Date(req.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{formatBytes(req.requested_space)}</TableCell>
                  <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                  <TableCell>{getStatusBadge(req.status)}</TableCell>
                  <TableCell className="text-right">
                    {req.status === 'pending' && (
                      <div className="space-x-2">
                        <Button size="icon" variant="outline" onClick={() => handleApprove(req.id)}><Check className="h-4 w-4 text-green-600" /></Button>
                        <Button size="icon" variant="outline" onClick={() => setRejectionState({id: req.id, notes: ''})}><X className="h-4 w-4 text-red-600" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!rejectionState} onOpenChange={() => setRejectionState(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Request</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection (optional)" value={rejectionState?.notes} onChange={(e) => setRejectionState(s => s ? {...s, notes: e.target.value} : null)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionState(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};