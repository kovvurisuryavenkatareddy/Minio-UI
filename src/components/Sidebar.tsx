import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { supabase } from "@/integrations/supabase/client";
import { HardDrive, ChevronRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FolderTreeView } from "./FolderTreeView";
import { Skeleton } from "./ui/skeleton";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/contexts/AuthContext";

interface Bucket {
  id: string;
  name: string;
  owner_id: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const BUCKETS_PER_PAGE = 30;

const BucketListSection: React.FC<{
  title: string;
  buckets: Bucket[];
  activeBucketName?: string;
  onClose?: () => void;
}> = ({ title, buckets, activeBucketName, onClose }) => {
  if (buckets.length === 0) {
    return null;
  }

  const isSectionActive = buckets.some(b => b.name === activeBucketName);

  return (
    <li className="relative px-6 pt-3 pb-1">
      <Collapsible defaultOpen={isSectionActive}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left text-xs font-semibold text-gray-400 uppercase tracking-wider group transition-colors hover:text-gray-600 dark:hover:text-gray-300">
          <span>{title}</span>
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <ul className="pt-2 -ml-4 space-y-1">
            {buckets.map((bucket) => (
              <li key={bucket.id} className="relative px-2 py-1">
                <Collapsible defaultOpen={bucket.name === activeBucketName}>
                  <div className="flex items-center group px-4">
                    <CollapsibleTrigger className="p-1 -ml-1 rounded-sm hover:bg-muted">
                      <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    </CollapsibleTrigger>
                    <Link
                      to={`/bucket/${bucket.name}`}
                      onClick={onClose}
                      className={cn(
                        "font-semibold text-sm",
                        bucket.name === activeBucketName &&
                          "text-primary dark:text-white"
                      )}
                    >
                      {bucket.name}
                    </Link>
                  </div>
                  <CollapsibleContent className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <FolderTreeView bucketName={bucket.name} prefix="" />
                  </CollapsibleContent>
                </Collapsible>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
};

const SidebarContent = ({ onClose }: { onClose?: () => void }) => {
  const params = useParams();
  const location = useLocation();
  const activeBucketName = params.bucketName;
  const { profile } = useProfile();
  const { ref, inView } = useInView();
  const { session } = useAuth();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery<Bucket[]>({
    queryKey: ["allBucketsPaginated"],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * BUCKETS_PER_PAGE;
      const to = from + BUCKETS_PER_PAGE - 1;
      const { data, error } = await supabase.from("buckets").select("id, name, owner_id").range(from, to);
      if (error) throw new Error(error.message);
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === BUCKETS_PER_PAGE ? allPages.length : undefined;
    },
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  const buckets = data?.pages.flat() || [];
  const myBuckets = session ? buckets.filter(b => b.owner_id === session.user.id) : [];
  const sharedBuckets = session ? buckets.filter(b => b.owner_id !== session.user.id) : [];

  return (
    <div className="h-full flex flex-col">
      <div className="py-4 text-gray-500 dark:text-gray-400 flex-1">
        <Link
          to="/"
          onClick={onClose}
          className="ml-6 text-lg font-bold text-gray-800 dark:text-gray-200"
        >
          MinIO Explorer
        </Link>
        <ul className="mt-6">
          <li className="relative px-6 py-3">
            {location.pathname === "/" && (
              <span
                className="absolute inset-y-0 left-0 w-1 bg-primary rounded-tr-lg rounded-br-lg"
                aria-hidden="true"
              ></span>
            )}
            <Link
              to="/"
              onClick={onClose}
              className={cn(
                "inline-flex items-center w-full text-sm font-semibold transition-colors duration-150 hover:text-gray-800 dark:hover:text-gray-200",
                location.pathname === "/" && "text-gray-800 dark:text-gray-100"
              )}
            >
              <HardDrive className="w-5 h-5" />
              <span className="ml-4">All Buckets</span>
            </Link>
          </li>
          {profile?.role === 'admin' && (
            <li className="relative px-6 py-3">
              {location.pathname.startsWith("/admin") && (
                <span
                  className="absolute inset-y-0 left-0 w-1 bg-primary rounded-tr-lg rounded-br-lg"
                  aria-hidden="true"
                ></span>
              )}
              <Link
                to="/admin"
                onClick={onClose}
                className={cn(
                  "inline-flex items-center w-full text-sm font-semibold transition-colors duration-150 hover:text-gray-800 dark:hover:text-gray-200",
                  location.pathname.startsWith("/admin") && "text-gray-800 dark:text-gray-100"
                )}
              >
                <Shield className="w-5 h-5" />
                <span className="ml-4">Admin Dashboard</span>
              </Link>
            </li>
          )}
          {isLoading ? (
            <div className="px-6 space-y-2 mt-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : (
            <>
              <BucketListSection title="My Buckets" buckets={myBuckets} activeBucketName={activeBucketName} onClose={onClose} />
              <BucketListSection title="Shared With Me" buckets={sharedBuckets} activeBucketName={activeBucketName} onClose={onClose} />
            </>
          )}
          {hasNextPage && (
            <li ref={ref} className="px-6 py-3">
              <Skeleton className="h-6 w-full" />
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="z-20 hidden w-64 overflow-y-auto bg-white dark:bg-gray-800 md:block flex-shrink-0 border-r">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-30 flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center md:hidden",
          isOpen ? "block" : "hidden"
        )}
        onClick={onClose}
      >
        <aside
          className={cn(
            "fixed inset-y-0 z-30 w-64 overflow-y-auto bg-white dark:bg-gray-800 transition-transform duration-300 ease-in-out",
            isOpen ? "transform translate-x-0" : "transform -translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <SidebarContent onClose={onClose} />
        </aside>
      </div>
    </>
  );
};

export default Sidebar;