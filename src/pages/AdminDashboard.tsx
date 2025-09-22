import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, DatabaseZap, BarChart3 } from "lucide-react";
import { UserManagementTable } from "@/components/admin/UserManagementTable";

const AdminDashboard = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" /> User Management</TabsTrigger>
          <TabsTrigger value="requests" disabled><DatabaseZap className="mr-2 h-4 w-4" /> Space Requests</TabsTrigger>
          <TabsTrigger value="stats" disabled><BarChart3 className="mr-2 h-4 w-4" /> Storage Stats</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Add, edit, and remove users from the system.</CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagementTable />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Space Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">This feature is coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Storage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">This feature is coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;