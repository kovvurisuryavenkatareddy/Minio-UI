import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Send, Trash2 } from "lucide-react";

interface BucketDetails {
  id: string;
  owner_id: string;
  public_level: string;
}

interface BucketMember {
  user_id: string;
  email: string;
  is_owner: boolean;
  role: string;
}

interface ManageAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketDetails: BucketDetails;
  members: BucketMember[];
  bucketName: string;
}

export const ManageAccessDialog = ({ open, onOpenChange, bucketDetails, members, bucketName }: ManageAccessDialogProps) => {
  const queryClient = useQueryClient();
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteRole, setInviteRole] = useState("read-only");
  const [isInviting, setIsInviting] = useState(false);

  const invalidateAndRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bucketInfo', bucketName] });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmails || !bucketDetails) return;
    const emails = inviteEmails.split(/[\n,;]+/).map(email => email.trim()).filter(Boolean);
    if (emails.length === 0) return showError("Please enter at least one valid email address.");
    
    setIsInviting(true);
    const loadingToast = showLoading(`Inviting ${emails.length} user(s)...`);
    
    for (const email of emails) {
      try {
        const { error } = await supabase.rpc('invite_user_to_bucket', { p_bucket_id: bucketDetails.id, p_user_email: email, p_role: inviteRole });
        if (error) throw error;
      } catch (err: any) {
        showError(`Failed to invite ${email}: ${err.message}`);
      }
    }
    
    dismissToast(loadingToast);
    showSuccess("Invitations sent.");
    setInviteEmails("");
    invalidateAndRefresh();
    setIsInviting(false);
  };

  const handleRemoveMember = async (userIdToRemove: string) => {
    if (!bucketDetails) return;
    try {
      const { data, error } = await supabase.rpc('remove_bucket_member', { p_bucket_id: bucketDetails.id, p_user_id_to_remove: userIdToRemove });
      if (error) throw error;
      showSuccess(data);
      invalidateAndRefresh();
    } catch (err: any) {
      console.error(err);
      showError(err.message);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!bucketDetails) return;
    try {
      const { error } = await supabase.rpc('update_bucket_member_role', { p_bucket_id: bucketDetails.id, p_member_id: memberId, p_new_role: newRole });
      if (error) throw error;
      showSuccess("Member role updated.");
      invalidateAndRefresh();
    } catch (err: any) {
      console.error(err);
      showError(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Access for {bucketName}</DialogTitle>
          <DialogDescription>Invite users and manage roles for this private bucket.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {members.map(member => (
            <div key={member.user_id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div className="flex items-center gap-3"><span className="font-medium">{member.email}</span><Badge variant={member.is_owner ? "default" : "secondary"}>{member.role}</Badge></div>
              <div className="flex items-center gap-2">
                {!member.is_owner && (
                  <>
                    <Select value={member.role} onValueChange={(newRole) => handleRoleChange(member.user_id, newRole)}>
                      <SelectTrigger className="w-[130px] h-9"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read-only">Read-Only</SelectItem>
                        <SelectItem value="read-write">Read/Write</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member.user_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <form onSubmit={handleInvite} className="flex w-full items-start space-x-2 pt-4 border-t">
            <Textarea placeholder="Enter emails separated by commas or new lines." value={inviteEmails} onChange={(e) => setInviteEmails(e.target.value)} required />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="read-only">Read-Only</SelectItem>
                <SelectItem value="read-write">Read/Write</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isInviting}><Send className="mr-2 h-4 w-4" />{isInviting ? 'Inviting...' : 'Invite'}</Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};