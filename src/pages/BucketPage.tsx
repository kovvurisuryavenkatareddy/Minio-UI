import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { s3Client } from "@/lib/s3Client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ListObjectsV2Command, _Object } from "@aws-sdk/client-s3";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Folder, File, AlertTriangle, Users, Trash2, Send } from "lucide-react";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";

interface BucketDetails {
  id: string;
  owner_id: string;
  is_public: boolean;
}

interface BucketMember {
  user_id: string;
  email: string;
  is_owner: boolean;
}

const BucketPage = () => {
  const { bucketName } = useParams<{ bucketName: string }>();
  const { session } = useAuth();
  const [bucketDetails, setBucketDetails] = useState<BucketDetails | null>(null);
  const [objects, setObjects] = useState<_Object[]>([]);
  const [members, setMembers] = useState<BucketMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmails, setInviteEmails] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const fetchBucketData = useCallback(async () => {
    if (!bucketName || !session) return;
    if (!s3Client) {
      setError("S3 client is not initialized.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // 1. Fetch bucket metadata and check permissions from Supabase
      const { data: bucketData, error: supabaseError } = await supabase
        .from("buckets")
        .select("id, owner_id, is_public")
        .eq("name", bucketName)
        .single();

      if (supabaseError || !bucketData) {
        throw new Error("Bucket not found or you don't have permission to view it.");
      }
      setBucketDetails(bucketData);

      // 2. Fetch objects from MinIO
      const s3Data = await s3Client.send(
        new ListObjectsV2Command({ Bucket: bucketName })
      );
      setObjects(s3Data.Contents || []);

      // 3. Fetch members if user has access
      const { data: memberData, error: memberError } = await supabase.rpc('get_bucket_members', { p_bucket_id: bucketData.id });
      if (memberError) throw new Error(`Failed to fetch members: ${memberError.message}`);
      setMembers(memberData || []);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch bucket data.");
    } finally {
      setLoading(false);
    }
  }, [bucketName, session]);

  useEffect(() => {
    fetchBucketData();
  }, [fetchBucketData]);

  const handlePrivacyChange = async (isPublic: boolean) => {
    if (!bucketDetails) return;
    try {
      const { error } = await supabase
        .from("buckets")
        .update({ is_public: isPublic })
        .eq("id", bucketDetails.id);
      
      if (error) throw error;

      setBucketDetails({ ...bucketDetails, is_public: isPublic });
      showSuccess(`Bucket is now ${isPublic ? 'public' : 'private'}.`);
    } catch (err) {
      console.error(err);
      showError("Failed to update bucket privacy.");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmails || !bucketDetails) return;

    const emails = inviteEmails
      .split(/[\n,;]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (emails.length === 0) {
      showError("Please enter at least one valid email address.");
      return;
    }

    setIsInviting(true);
    const loadingToast = showLoading(`Inviting ${emails.length} user(s)...`);

    const results = {
      success: [] as string[],
      failed: [] as { email: string; message: string }[],
    };

    for (const email of emails) {
      try {
        const { data, error } = await supabase.rpc('invite_user_to_bucket', {
          p_bucket_id: bucketDetails.id,
          p_user_email: email,
        });
        if (error) throw error;
        if (data.includes('already a member')) {
          results.failed.push({ email, message: 'Already a member.' });
        } else {
          results.success.push(email);
        }
      } catch (err: any) {
        results.failed.push({ email, message: err.message });
      }
    }

    dismissToast(loadingToast);

    if (results.success.length > 0) {
      showSuccess(`${results.success.length} user(s) invited successfully.`);
    }
    if (results.failed.length > 0) {
      showError(`${results.failed.length} invitation(s) failed. Check console for details.`);
      console.error("Failed invitations:", results.failed);
    }

    if (results.success.length > 0) {
      setInviteEmails("");
      fetchBucketData(); // Refresh member list
    }
    
    setIsInviting(false);
  };

  const handleRemoveMember = async (userIdToRemove: string) => {
    if (!bucketDetails) return;
    try {
      const { data, error } = await supabase.rpc('remove_bucket_member', {
        p_bucket_id: bucketDetails.id,
        p_user_id_to_remove: userIdToRemove
      });
      if (error) throw error;
      showSuccess(data);
      fetchBucketData(); // Refresh member list
    } catch (err: any) {
      console.error(err);
      showError(err.message);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  const isOwner = session?.user.id === bucketDetails?.owner_id;

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Skeleton className="h-10 w-40 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Button asChild variant="outline" className="mb-4">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Buckets
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 grid gap-6">
      <div>
        <Button asChild variant="outline" className="mb-4">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Buckets
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center">
                  <Folder className="mr-2 h-5 w-5" />
                  {bucketName}
                </CardTitle>
                <CardDescription>Objects in this bucket.</CardDescription>
              </div>
              {isOwner && bucketDetails && (
                <div className="flex items-center space-x-2">
                  <Label htmlFor="privacy-switch">Private</Label>
                  <Switch
                    id="privacy-switch"
                    checked={bucketDetails.is_public}
                    onCheckedChange={handlePrivacyChange}
                  />
                  <Label htmlFor="privacy-switch">Public</Label>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Last Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objects.length > 0 ? (
                  objects.map((obj) => (
                    <TableRow key={obj.Key}>
                      <TableCell className="font-medium flex items-center">
                        <File className="mr-2 h-4 w-4 text-muted-foreground" />
                        {obj.Key}
                      </TableCell>
                      <TableCell>{formatBytes(obj.Size || 0)}</TableCell>
                      <TableCell>
                        {obj.LastModified?.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      No objects found in this bucket.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Manage Access
            </CardTitle>
            <CardDescription>Invite users to collaborate on this private bucket.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {members.map(member => (
                <li key={member.user_id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{member.email}</span>
                    {member.is_owner && <Badge>Owner</Badge>}
                  </div>
                  {!member.is_owner && (
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveMember(member.user_id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <form onSubmit={handleInvite} className="flex w-full items-start space-x-2">
              <Textarea
                placeholder="Enter emails separated by commas or new lines."
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                required
              />
              <Button type="submit" disabled={isInviting}>
                <Send className="mr-2 h-4 w-4" />
                {isInviting ? 'Inviting...' : 'Invite'}
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default BucketPage;