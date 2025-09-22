import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/contexts/ProfileContext";
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
import { MoreVertical, UserPlus, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddUserDialog } from "./AddUserDialog";
import { EditUserDialog } from "./EditUserDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";

const fetchUsers = async (): Promise<Profile[]> => {
  const { data, error } = await supabase.from("profiles").select("*, user_email:auth.users(email)");
  
  // This query is a bit complex because we need to get the email from the `auth.users` table.
  // A view or RPC function could simplify this in the future.
  // For now, we'll fetch profiles and then fetch the corresponding users from auth.
  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*");
  if (profilesError) throw profilesError;

  const userIds = profiles.map(p => p.id);
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;

  const usersMap = new Map(usersData.users.map(u => [u.id, u.email]));

  return profiles.map(p => ({ ...p, email: usersMap.get(p.id) || 'N/A' }));
};

export const UserManagementTable = () => {
  const queryClient = useQueryClient();
  const { data: users, isLoading, isError, error } = useQuery<Profile[]>({
    queryKey: ["allUsers"],
    queryFn: fetchUsers,
  });

  const [isAddUserOpen, setAddUserOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<Profile | null>(null);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ["allUsers"] });

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddUserOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Space Used</TableHead>
              <TableHead>Space Limit</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))
            ) : isError ? (
              <TableRow><TableCell colSpan={6}><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert></TableCell></TableRow>
            ) : (
              users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                  <TableCell><Badge variant={user.is_active ? 'outline' : 'destructive'}>{user.is_active ? 'Active' : 'Disabled'}</Badge></TableCell>
                  <TableCell>{formatBytes(user.space_used)}</TableCell>
                  <TableCell>{formatBytes(user.space_limit)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setUserToEdit(user)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setUserToDelete(user)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AddUserDialog open={isAddUserOpen} onOpenChange={setAddUserOpen} onUserAdded={refreshUsers} />
      <EditUserDialog user={userToEdit} open={!!userToEdit} onOpenChange={() => setUserToEdit(null)} onUserUpdated={refreshUsers} />
      <DeleteUserDialog user={userToDelete} open={!!userToDelete} onOpenChange={() => setUserToDelete(null)} onUserDeleted={refreshUsers} />
    </div>
  );
};