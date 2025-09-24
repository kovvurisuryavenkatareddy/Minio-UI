import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserManagementTable } from "@/components/admin/UserManagementTable";

const AdminDashboard = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Add, edit, and remove users from the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagementTable />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;