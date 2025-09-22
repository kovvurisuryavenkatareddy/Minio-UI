import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { s3Client } from "@/lib/s3Client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ListObjectsV2Command, _Object, CommonPrefix, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Folder, File, AlertTriangle, Users, Trash2, Send, MoreVertical, FolderPlus, Eye, Download, FolderUp, RefreshCw, History, Share2, Edit } from "lucide-react";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { UploadFileDialog } from "@/components/UploadFileDialog";
import { DeleteObjectDialog } from "@/components/DeleteObjectDialog";
import { PreviewFileDialog } from "@/components/PreviewFileDialog";
import { UploadFolderDialog } from "@/components/UploadFolderDialog";
import { VersionHistoryDialog } from "@/components/VersionHistoryDialog";
import { ShareFileDialog } from "@/components/ShareFileDialog";
import { DeleteFolderDialog } from "@/components/DeleteFolderDialog";
import { DeleteMultipleObjectsDialog } from "@/components/DeleteMultipleObjectsDialog";

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

type BucketItem = (_Object & { type: 'file' }) | (CommonPrefix & { type: 'folder' });

interface PreviewState {
  url: string;
  fileName: string;
  fileType: string;
}

const BucketPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const bucketName = params.bucketName!;
  const currentPrefix = params['*'] || "";

  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteRole, setInviteRole] = useState("read-only");
  const [isInviting, setIsInviting] = useState(false);
  const [isCreateFolderOpen, setCreateFolderOpen] = useState(false);
  const [isUploadFileOpen, setUploadFileOpen] = useState(false);
  const [isUploadFolderOpen, setUploadFolderOpen] = useState(false);
  const [objectToDelete, setObjectToDelete] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);
  const [objectToShare, setObjectToShare] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isDeleteMultipleOpen, setDeleteMultipleOpen] = useState(false);

  const fetchBucketData = async () => {
    if (!bucketName || !s3Client) {
      throw new Error("Client not initialized or bucket name is missing.");
    }

    const { data: bucketData, error: supabaseError } = await supabase
      .from("buckets")
      .select("id, owner_id, public_level")
      .eq("name", bucketName)
      .single();

    if (supabaseError || !bucketData) {
      throw new Error("Bucket not found or you don't have permission to view it.");
    }

    const s3Data = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucketName, Prefix: currentPrefix, Delimiter: "/" })
    );
    
    const folders: BucketItem[] = (s3Data.CommonPrefixes || []).map(p => ({ ...p, type: 'folder' }));
    const files: BucketItem[] = (s3Data.Contents || []).filter(c => c.Key !== currentPrefix).map(c => ({ ...c, type: 'file' }));
    const items = [...folders, ...files];

    const { data: memberData, error: memberError } = await supabase.rpc('get_bucket_members', { p_bucket_id: bucketData.id });
    if (memberError) throw new Error(`Failed to fetch members: ${memberError.message}`);
    
    return { bucketDetails: bucketData, items, members: memberData || [] };
  };

  const { data, error, isLoading, isFetching, isError } = useQuery({
    queryKey: ['bucketData', bucketName, currentPrefix],
    queryFn: fetchBucketData,
    refetchOnWindowFocus: false,
    enabled: !!bucketName && !!session,
  });

  const { bucketDetails, items = [], members = [] } = data || {};

  const currentUserRole = useMemo(() => {
    return members.find(m => m.user_id === session?.user.id)?.role;
  }, [members, session]);

  const canWrite = currentUserRole === 'owner' || currentUserRole === 'read-write' || bucketDetails?.public_level === 'read-write';

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bucketData', bucketName, currentPrefix] });
    queryClient.invalidateQueries({ queryKey: ['sidebarTree', bucketName] });
  };

  const handleFolderCreated = (newFolderKey: string) => {
    navigate(`/bucket/${bucketName}/${newFolderKey}`);
  };

  const handlePrivacyChange = async (publicLevel: string) => {
    if (!bucketDetails) return;
    try {
      const { error } = await supabase
        .from("buckets")
        .update({ public_level: publicLevel })
        .eq("id", bucketDetails.id);
      if (error) throw error;
      showSuccess(`Bucket access level updated.`);
      queryClient.invalidateQueries({ queryKey: ['bucketData', bucketName, currentPrefix] });
    } catch (err) {
      console.error(err);
      showError("Failed to update bucket privacy.");
    }
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
    queryClient.invalidateQueries({ queryKey: ['bucketData', bucketName, currentPrefix] });
    setIsInviting(false);
  };

  const handleRemoveMember = async (userIdToRemove: string) => {
    if (!bucketDetails) return;
    try {
      const { data, error } = await supabase.rpc('remove_bucket_member', { p_bucket_id: bucketDetails.id, p_user_id_to_remove: userIdToRemove });
      if (error) throw error;
      showSuccess(data);
      queryClient.invalidateQueries({ queryKey: ['bucketData', bucketName, currentPrefix] });
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
      queryClient.invalidateQueries({ queryKey: ['bucketData', bucketName, currentPrefix] });
    } catch (err: any) {
      console.error(err);
      showError(err.message);
    }
  };

  const getPresignedUrl = async (key: string) => {
    if (!s3Client || !bucketName) return null;
    try {
      const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
      return await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    } catch (err) {
      console.error("Error creating presigned URL", err);
      showError("Could not generate link for file.");
      return null;
    }
  };

  const handleDownload = async (key: string) => {
    const url = await getPresignedUrl(key);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', key.split('/').pop() || 'download');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePreview = async (key: string) => {
    const url = await getPresignedUrl(key);
    if (url) {
      const extension = key.split('.').pop()?.toLowerCase() || '';
      const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
      const fileType = imageTypes.includes(extension) ? `image/${extension}` : 'application/octet-stream';
      setPreviewState({ url, fileName: key.split('/').pop() || '', fileType });
    }
  };

  const formatBytes = (bytes?: number, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  const isOwner = session?.user.id === bucketDetails?.owner_id;

  const fileItems = items.filter(item => item.type === 'file') as (_Object & { type: 'file' })[];
  const numSelected = selectedKeys.length;
  const numFiles = fileItems.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(fileItems.map(file => file.Key!));
    } else {
      setSelectedKeys([]);
    }
  };

  const handleSelectOne = (key: string, checked: boolean) => {
    if (checked) {
      setSelectedKeys(prev => [...prev, key]);
    } else {
      setSelectedKeys(prev => prev.filter(k => k !== key));
    }
  };

  const renderBreadcrumbs = () => {
    const parts = currentPrefix.split('/').filter(Boolean);
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="cursor-pointer" onClick={() => navigate(`/bucket/${bucketName}`)}>
              {bucketName}
            </BreadcrumbLink>
          </BreadcrumbItem>
          {parts.map((part, index) => {
            const path = parts.slice(0, index + 1).join('/');
            return (
              <React.Fragment key={path}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === parts.length - 1 ? (
                    <BreadcrumbPage>{part}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="cursor-pointer" onClick={() => navigate(`/bucket/${bucketName}/${path}/`)}>
                      {part}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    );
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (isError) {
    return (
      <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              {renderBreadcrumbs()}
            </div>
            <div className="flex items-center space-x-2">
              {canWrite && numSelected > 0 && (
                <Button variant="destructive" size="sm" onClick={() => setDeleteMultipleOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({numSelected})
                </Button>
              )}
              {isOwner && bucketDetails && (
                <Select value={bucketDetails.public_level} onValueChange={handlePrivacyChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Set access level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="read-only">Public Read-Only</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
              {canWrite && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>Actions</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setUploadFileOpen(true)}>
                      <File className="mr-2 h-4 w-4" /> Upload Files
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setUploadFolderOpen(true)}>
                      <FolderUp className="mr-2 h-4 w-4" /> Upload Folder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCreateFolderOpen(true)}>
                      <FolderPlus className="mr-2 h-4 w-4" /> Create Folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              {canWrite && <TableHead className="w-[40px]">
                <Checkbox
                  checked={numFiles > 0 && numSelected === numFiles ? true : numSelected > 0 ? 'indeterminate' : false}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  aria-label="Select all rows"
                  disabled={numFiles === 0}
                />
              </TableHead>}
              <TableHead>Name</TableHead><TableHead>Size</TableHead><TableHead>Last Modified</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => {
                  const name = item.type === 'folder' ? item.Prefix?.replace(currentPrefix, '').replace('/', '') : item.Key?.replace(currentPrefix, '');
                  return (
                    <TableRow 
                      key={item.type === 'folder' ? item.Prefix : item.Key}
                      onDoubleClick={() => {
                        if (item.type === 'folder' && item.Prefix) {
                          navigate(`/bucket/${bucketName}/${item.Prefix}`);
                        }
                      }}
                      className={item.type === 'folder' ? 'cursor-pointer hover:bg-muted/50' : ''}
                    >
                      {canWrite && <TableCell>
                        {item.type === 'file' && item.Key ? (
                          <Checkbox
                            checked={selectedKeys.includes(item.Key)}
                            onCheckedChange={(checked) => handleSelectOne(item.Key!, !!checked)}
                            aria-label={`Select row for ${name}`}
                          />
                        ) : null}
                      </TableCell>}
                      <TableCell className="font-medium flex items-center">
                        {item.type === 'folder' ? <Folder className="mr-2 h-4 w-4 text-blue-500" /> : <File className="mr-2 h-4 w-4 text-muted-foreground" />}
                        <span>{name}</span>
                      </TableCell>
                      <TableCell>{item.type === 'file' ? formatBytes(item.Size) : '-'}</TableCell>
                      <TableCell>{item.type === 'file' ? item.LastModified?.toLocaleString() : '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {item.type === 'file' && item.Key && (
                              <>
                                <DropdownMenuItem onClick={() => handlePreview(item.Key!)}><Eye className="mr-2 h-4 w-4" /> Preview</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownload(item.Key!)}><Download className="mr-2 h-4 w-4" /> Download</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setObjectToShare(item.Key!)}><Share2 className="mr-2 h-4 w-4" /> Share</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setHistoryTarget(item.Key!)}><History className="mr-2 h-4 w-4" /> Version History</DropdownMenuItem>
                              </>
                            )}
                            {canWrite && (
                              <DropdownMenuItem className="text-destructive" onClick={() => item.type === 'file' ? setObjectToDelete(item.Key!) : setFolderToDelete(item.Prefix!)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow><TableCell colSpan={canWrite ? 5 : 4} className="text-center py-8 text-muted-foreground">This folder is empty.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader><CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Manage Access</CardTitle><CardDescription>Invite users and manage roles for this private bucket.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {members.map(member => (
              <div key={member.user_id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div className="flex items-center gap-3"><span className="font-medium">{member.email}</span><Badge variant={member.is_owner ? "default" : "secondary"}>{member.role}</Badge></div>
                <div className="flex items-center gap-2">
                  {!member.is_owner && (
                    <>
                      <Select value={member.role} onValueChange={(newRole) => handleRoleChange(member.user_id, newRole)}>
                        <SelectTrigger className="w-[130px] h-9">
                          <SelectValue/>
                        </SelectTrigger>
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
          </CardContent>
          <CardFooter>
            <form onSubmit={handleInvite} className="flex w-full items-start space-x-2">
              <Textarea placeholder="Enter emails separated by commas or new lines." value={inviteEmails} onChange={(e) => setInviteEmails(e.target.value)} required />
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read-only">Read-Only</SelectItem>
                  <SelectItem value="read-write">Read/Write</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={isInviting}><Send className="mr-2 h-4 w-4" />{isInviting ? 'Inviting...' : 'Invite'}</Button>
            </form>
          </CardFooter>
        </Card>
      )}

      {bucketName && canWrite && <CreateFolderDialog open={isCreateFolderOpen} onOpenChange={setCreateFolderOpen} onFolderCreated={handleFolderCreated} bucketName={bucketName} currentPrefix={currentPrefix} />}
      {bucketName && canWrite && <UploadFileDialog open={isUploadFileOpen} onOpenChange={setUploadFileOpen} onUploadComplete={handleRefresh} bucketName={bucketName} currentPrefix={currentPrefix} />}
      {bucketName && canWrite && <UploadFolderDialog open={isUploadFolderOpen} onOpenChange={setUploadFolderOpen} onUploadComplete={handleRefresh} bucketName={bucketName} currentPrefix={currentPrefix} />}
      {bucketName && objectToDelete && <DeleteObjectDialog open={!!objectToDelete} onOpenChange={() => setObjectToDelete(null)} onObjectDeleted={handleRefresh} bucketName={bucketName} objectKey={objectToDelete} />}
      {previewState && <PreviewFileDialog {...previewState} open={!!previewState} onOpenChange={() => setPreviewState(null)} />}
      {bucketName && historyTarget && <VersionHistoryDialog open={!!historyTarget} onOpenChange={() => setHistoryTarget(null)} onVersionRestored={handleRefresh} bucketName={bucketName} objectKey={historyTarget} />}
      {bucketName && objectToShare && <ShareFileDialog open={!!objectToShare} onOpenChange={() => setObjectToShare(null)} bucketName={bucketName} objectKey={objectToShare} />}
      {bucketName && folderToDelete && <DeleteFolderDialog open={!!folderToDelete} onOpenChange={() => setFolderToDelete(null)} onFolderDeleted={handleRefresh} bucketName={bucketName} folderPrefix={folderToDelete} />}
      {bucketName && isDeleteMultipleOpen && <DeleteMultipleObjectsDialog open={isDeleteMultipleOpen} onOpenChange={setDeleteMultipleOpen} onObjectsDeleted={() => { handleRefresh(); setSelectedKeys([]); }} bucketName={bucketName} objectKeys={selectedKeys} />}
    </div>
  );
};

export default BucketPage;