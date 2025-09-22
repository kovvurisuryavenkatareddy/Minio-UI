import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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

interface Bucket {
  id: string;
  name: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const SidebarContent = ({ onClose }: { onClose?: () => void }) => {
  const params = useParams();
  const location = useLocation();
  const activeBucketName = params.bucketName;
  const { profile } = useProfile();

  const { data: buckets, isLoading } = useQuery<Bucket[]>({
    queryKey: ["allBuckets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("buckets").select("id, name");
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  return (
    <div className="py-4 text-gray-500 dark:text-gray-400">
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
            <span className="ml-4">My Buckets</span>
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
          buckets?.map((bucket) => (
            <li key={bucket.id} className="relative px-2 py-1">
              <Collapsible defaultOpen={bucket.name === activeBucketName}>
                <div className="flex items-center group px-4">
                  <CollapsibleTrigger className="p-1 -ml-1">
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
                <CollapsibleContent>
                  <FolderTreeView bucketName={bucket.name} prefix="" />
                </CollapsibleContent>
              </Collapsible>
            </li>
          ))
        )}
      </ul>
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