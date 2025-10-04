import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { s3Client } from "@/lib/s3Client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ListObjectsV2Command, _Object, CommonPrefix, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Card,
  CardContent,
  CardHeader,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Folder, File, AlertTriangle, Users, Trash2, MoreVertical, FolderPlus, Eye, Download, RefreshCw, History, Share2, UploadCloud } from "lucide-react";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { DeleteObjectDialog } from "@/components/DeleteObjectDialog";
import { PreviewFileDialog } from "@/components/PreviewFileDialog";
import { VersionHistoryDialog } from "@/components/VersionHistoryDialog";
import { ShareFileDialog } from "@/components/ShareFileDialog";
import { DeleteFolderDialog } from "@/components/DeleteFolderDialog";
import { DeleteMultipleObjectsDialog } from "@/components/DeleteMultipleObjectsDialog";
import { ManageAccessDialog } from "@/components/ManageAccessDialog";
import { UploadDialog } from "@/components/UploadDialog";

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

interface SelectedItem {
  key: string;
  type: 'file' | 'folder';
  size: number;
}

interface PreviewState {
  url: string;
  fileName: string;
  fileType: string;
}

const BUCKET_ITEMS_PER_PAGE = 50;

const BucketPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();

  const bucketName = params.bucketName!;
  const currentPrefix = params['*'] || "";

  const [isManageAccessOpen, setManageAccessOpen] = useState(false);
  const [isCreateFolderOpen, setCreateFolderOpen] = useState(false);
  const [isUploadOpen, setUploadOpen] = useState(false);
  const [objectToDelete, setObjectToDelete] = useState<{ key: string; size: number } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);
  const [objectToShare, setObjectToShare] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isDeleteMultipleOpen, setDeleteMultipleOpen] = useState(false);

  const { data: bucketInfo, isError: isBucketInfoError, error: bucketInfoError } = useQuery({
    queryKey: ['bucketInfo', bucketName],
    queryFn: async () => {
      const { data: bucketData, error: supabaseError } = await supabase
        .from("buckets")
        .select("id, owner_id, public_level")
        .eq("name", bucketName)
        .single();
      if (supabaseError || !bucketData) throw new Error("Bucket not found or you don't have permission to view it.");
      
      let memberData: BucketMember[] = [];
      if (session) {
        const { data, error: memberError } = await supabase.rpc('get_bucket_members', { p_bucket_id: bucketData.id });
        if (memberError) console.error(`Failed to fetch members: ${memberError.message}`);
        else memberData = data || [];
      }
      return { bucketDetails: bucketData, members: memberData };
    },
    enabled: !!bucketName,
    refetchOnWindowFocus: false,
  });

  const {
    data: itemsData,
    error: itemsError,
    isLoading: itemsIsLoading,
    isFetching: itemsIsFetching,
    isError: itemsIsError,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
      queryKey: ['bucketItems', bucketName, currentPrefix],
      queryFn: async ({ pageParam }: { pageParam?: string }) => {
          if (!s3Client) throw new Error("S3 client not initialized.");
          const command = new ListObjectsV2Command({
              Bucket: bucketName,
              Prefix: currentPrefix,
              Delimiter: "/",
              MaxKeys: BUCKET_ITEMS_PER_PAGE,
              ContinuationToken: pageParam,
          });
          const s3Data = await s3Client.send(command);
          const folders: BucketItem[] = (s3Data.CommonPrefixes || []).map(p => ({ ...p, type: 'folder' }));
          const files: BucketItem[] = (s3Data.Contents || []).filter(c => c.Key !== currentPrefix).map(c => ({ ...c, type: 'file' }));
          return {
              items: [...folders, ...files],
              nextContinuationToken: s3Data.NextContinuationToken,
          };
      },
      getNextPageParam: (lastPage) => lastPage.nextContinuationToken,
      enabled: !!bucketName,
      refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  const { bucketDetails, members = [] } = bucketInfo || {};
  const items = itemsData?.pages.flatMap(page => page.items) || [];

  const currentUserRole = useMemo(() => {
    if (!session) return null;
    return members.find(m => m.user_id === session.user.id)?.role;
  }, [members, session]);

  const canWrite = useMemo(() => {
    if (bucketDetails?.public_level === 'read-write') return true;
    if (session) return currentUserRole === 'owner' || currentUserRole === 'read-write';
    return false;
  }, [session, currentUserRole, bucketDetails]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bucketItems', bucketName, currentPrefix] });
    queryClient.invalidateQueries({ queryKey: ['sidebarTree', bucketName] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    setSelectedItems([]);
  };

  const handleFolderCreated = (newFolderKey: string) => {
    navigate(`/bucket/${bucketName}/${newFolderKey}`);
  };

  const handlePrivacyChange = async (publicLevel: string) => {
    if (!bucketDetails) return;
    try {
      const { error } = await supabase.from("buckets").update({ public_level: publicLevel }).eq("id", bucketDetails.id);
      if (error) throw error;
      showSuccess(`Bucket access level updated.`);
      queryClient.invalidateQueries({ queryKey: ['bucketInfo', bucketName] });
    } catch (err) {
      console.error(err);
      showError("Failed to update bucket privacy.");
    }
  };

  const getPresignedUrl = async (key: string) => {
    if (!s3Client || !bucketName) return null;
    try {
      const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
      return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
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
  const allItems = itemsData?.pages.flatMap(page => page.items) || [];
  const numSelected = selectedItems.length;

  const totalSizeToDelete = useMemo(() => {
    return selectedItems.filter(i => i.type === 'file').reduce((sum, obj) => sum + (obj.size || 0), 0);
  }, [selectedItems]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedItems(checked ? allItems.map(item => ({
      key: item.type === 'file' ? item.Key! : item.Prefix!,
      type: item.type,
      size: item.type === 'file' ? item.Size || 0 : 0,
    })) : []);
  };

  const handleSelectOne = (key: string, type: 'file' | 'folder', size: number, checked: boolean) => {
    setSelectedItems(prev => checked ? [...prev, { key, type, size }] : prev.filter(i => i.key !== key));
  };

  const handleDownloadSelection = async () => {
    if (numSelected === 0) return showError("No items selected.");
    const loadingToast = showLoading("Preparing download...");
    const zip = new JSZip();
    const filesToZip: { key: string; nameInZip: string }[] = [];

    try {
      for (const item of selectedItems) {
        if (item.type === 'file') {
          filesToZip.push({ key: item.key, nameInZip: item.key });
        } else {
          let continuationToken: string | undefined = undefined;
          do {
            const command = new ListObjectsV2Command({ Bucket: bucketName, Prefix: item.key, ContinuationToken: continuationToken });
            const response = await s3Client.send(command);
            for (const content of response.Contents ?? []) {
              if (content.Key) filesToZip.push({ key: content.Key, nameInZip: content.Key });
            }
            continuationToken = response.NextContinuationToken;
          } while (continuationToken);
        }
      }

      if (filesToZip.length === 0) return showError("Selected folders are empty.");
      
      let filesZipped = 0;
      for (const file of filesToZip) {
        dismissToast(loadingToast);
        showLoading(`Zipping... (${++filesZipped}/${filesToZip.length})`);
        const url = await getPresignedUrl(file.key);
        if (!url) continue;
        const response = await fetch(url);
        const blob = await response.blob();
        zip.file(file.nameInZip, blob);
      }

      dismissToast(loadingToast);
      showLoading("Generating zip file...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `${bucketName}-download.zip`);
      showSuccess("Download started!");
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Failed to create zip file.");
    } finally {
      dismissToast(loadingToast);
    }
  };

  const renderBreadcrumbs = () => {
    const parts = currentPrefix.split('/').filter(Boolean);
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink className="cursor-pointer" onClick={() => navigate(`/bucket/${bucketName}`)}>{bucketName}</BreadcrumbLink></BreadcrumbItem>
          {parts.map((part, index) => {
            const path = parts.slice(0, index + 1).join('/');
            return (
              <React.Fragment key={path}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === parts.length - 1 ? <BreadcrumbPage>{part}</BreadcrumbPage> : <BreadcrumbLink className="cursor-pointer" onClick={() => navigate(`/bucket/${bucketName}/${path}/`)}>{part}</BreadcrumbLink>}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    );
  };

  if (itemsIsLoading || !bucketInfo) {
    return <div className="space-y-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (isBucketInfoError || itemsIsError) {
    const error = bucketInfoError || itemsError;
    return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>{renderBreadcrumbs()}</div>
            <div className="flex items-center space-x-2">
              {numSelected > 0 && <Button variant="outline" size="sm" onClick={handleDownloadSelection}><Download className="mr-2 h-4 w-4" />Download ({numSelected})</Button>}
              {canWrite && numSelected > 0 && <Button variant="destructive" size="sm" onClick={() => setDeleteMultipleOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Delete ({numSelected})</Button>}
              {isOwner && bucketDetails && <Select value={bucketDetails.public_level} onValueChange={handlePrivacyChange}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="read-only">Public Read-Only</SelectItem><SelectItem value="read-write">Public Read/Write</SelectItem></SelectContent></Select>}
              {isOwner && <Button variant="outline" onClick={() => setManageAccessOpen(true)}><Users className="mr-2 h-4 w-4" /> Manage Access</Button>}
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={itemsIsFetching}><RefreshCw className={`h-4 w-4 ${itemsIsFetching ? 'animate-spin' : ''}`} /></Button>
              {canWrite && <DropdownMenu><DropdownMenuTrigger asChild><Button>Actions</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => setUploadOpen(true)}><UploadCloud className="mr-2 h-4 w-4" /> Upload</DropdownMenuItem><DropdownMenuItem onClick={() => setCreateFolderOpen(true)}><FolderPlus className="mr-2 h-4 w-4" /> Create Folder</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-[40px]"><Checkbox checked={allItems.length > 0 && numSelected === allItems.length ? true : numSelected > 0 ? 'indeterminate' : false} onCheckedChange={(checked) => handleSelectAll(!!checked)} disabled={allItems.length === 0} /></TableHead>
              <TableHead>Name</TableHead><TableHead>Size</TableHead><TableHead>Last Modified</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => {
                  const key = item.type === 'folder' ? item.Prefix! : item.Key!;
                  const name = item.type === 'folder' ? item.Prefix?.replace(currentPrefix, '').replace('/', '') : item.Key?.replace(currentPrefix, '');
                  const size = item.type === 'file' ? item.Size || 0 : 0;
                  return (
                    <TableRow key={key} onDoubleClick={() => { if (item.type === 'folder' && item.Prefix) navigate(`/bucket/${bucketName}/${item.Prefix}`); }} className={item.type === 'folder' ? 'cursor-pointer hover:bg-muted/50' : ''}>
                      <TableCell><Checkbox checked={selectedItems.some(i => i.key === key)} onCheckedChange={(checked) => handleSelectOne(key, item.type, size, !!checked)} /></TableCell>
                      <TableCell className="font-medium flex items-center">{item.type === 'folder' ? <Folder className="mr-2 h-4 w-4 text-blue-500" /> : <File className="mr-2 h-4 w-4 text-muted-foreground" />}<span>{name}</span></TableCell>
                      <TableCell>{item.type === 'file' ? formatBytes(item.Size) : '-'}</TableCell>
                      <TableCell>{item.type === 'file' ? item.LastModified?.toLocaleString() : '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {item.type === 'file' && (<>
                                <DropdownMenuItem onClick={() => handlePreview(key)}><Eye className="mr-2 h-4 w-4" /> Preview</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownload(key)}><Download className="mr-2 h-4 w-4" /> Download</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setObjectToShare(key)}><Share2 className="mr-2 h-4 w-4" /> Share</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setHistoryTarget(key)}><History className="mr-2 h-4 w-4" /> Version History</DropdownMenuItem></>)}
                            {item.type === 'folder' && <DropdownMenuItem onClick={() => handleDownloadSelection()}><Download className="mr-2 h-4 w-4" /> Download</DropdownMenuItem>}
                            {canWrite && <DropdownMenuItem className="text-destructive" onClick={() => item.type === 'file' ? setObjectToDelete({ key: key, size: size }) : setFolderToDelete(key)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">This folder is empty.</TableCell></TableRow>}
              {hasNextPage && <TableRow ref={ref}><TableCell colSpan={5}><div className="flex justify-center"><Skeleton className="h-8 w-full" /></div></TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {bucketName && canWrite && <CreateFolderDialog open={isCreateFolderOpen} onOpenChange={setCreateFolderOpen} onFolderCreated={handleFolderCreated} bucketName={bucketName} currentPrefix={currentPrefix} />}
      {bucketName && canWrite && <UploadDialog open={isUploadOpen} onOpenChange={setUploadOpen} onUploadComplete={handleRefresh} bucketName={bucketName} currentPrefix={currentPrefix} />}
      {bucketName && objectToDelete && <DeleteObjectDialog open={!!objectToDelete} onOpenChange={() => setObjectToDelete(null)} onObjectDeleted={handleRefresh} bucketName={bucketName} objectKey={objectToDelete.key} objectSize={objectToDelete.size} />}
      {previewState && <PreviewFileDialog {...previewState} open={!!previewState} onOpenChange={() => setPreviewState(null)} />}
      {bucketName && historyTarget && <VersionHistoryDialog open={!!historyTarget} onOpenChange={() => setHistoryTarget(null)} onVersionRestored={handleRefresh} bucketName={bucketName} objectKey={historyTarget} />}
      {bucketName && objectToShare && <ShareFileDialog open={!!objectToShare} onOpenChange={() => setObjectToShare(null)} bucketName={bucketName} objectKey={objectToShare} />}
      {bucketName && folderToDelete && <DeleteFolderDialog open={!!folderToDelete} onOpenChange={() => setFolderToDelete(null)} onFolderDeleted={handleRefresh} bucketName={bucketName} folderPrefix={folderToDelete} />}
      {bucketName && isDeleteMultipleOpen && <DeleteMultipleObjectsDialog open={isDeleteMultipleOpen} onOpenChange={setDeleteMultipleOpen} onObjectsDeleted={handleRefresh} bucketName={bucketName} objectKeys={selectedItems.filter(i => i.type === 'file').map(i => i.key)} totalSize={totalSizeToDelete} />}
      {bucketDetails && <ManageAccessDialog open={isManageAccessOpen} onOpenChange={setManageAccessOpen} bucketDetails={bucketDetails} members={members} bucketName={bucketName} />}
    </div>
  );
};

export default BucketPage;