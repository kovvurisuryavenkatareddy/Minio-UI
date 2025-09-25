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
import { MoreVertical, UserPlus, AlertTriangle, RefreshCw } from "lucide-react";
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
  // RLS policy allows admins to select all profiles.
  const { data, error } = await supabase
    .from('profiles')
    .select('*');
  
  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return data;
};

export const UserManagementTable = () => {
  const queryClient = useQueryClient();
  const { data: users, isLoading, isError, error, isFetching } = useQuery<Profile[]>({
    queryKey: ["allUsers"],
    queryFn: fetchUsers,
    refetchOnWindowFocus: false,
  });

  const [isAddUserOpen, setAddUserOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<Profile | null>(null);
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ["allUsers"] });

  return (
    <div className="space-y-4">
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={refreshUsers} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))
            ) : isError ? (
              <TableRow><TableCell colSpan={4}><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert></TableCell></TableRow>
            ) : (
              users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge></TableCell>
                  <TableCell><Badge variant={user.is_active ? 'outline' : 'destructive'}>{user.is_active ? 'Active' : 'Disabled'}</Badge></TableCell>
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