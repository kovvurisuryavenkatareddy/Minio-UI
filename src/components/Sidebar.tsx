import { Link, useLocation } from "react-router-dom";
import { HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

const Sidebar = () => {
  const location = useLocation();
  const isRoot = location.pathname === "/";

  return (
    <aside className="z-20 hidden w-64 overflow-y-auto bg-white dark:bg-gray-800 md:block flex-shrink-0 border-r">
      <div className="py-4 text-gray-500 dark:text-gray-400">
        <Link to="/" className="ml-6 text-lg font-bold text-gray-800 dark:text-gray-200">
          MinIO Explorer
        </Link>
        <ul className="mt-6">
          <li className="relative px-6 py-3">
            {isRoot && (
              <span
                className="absolute inset-y-0 left-0 w-1 bg-primary rounded-tr-lg rounded-br-lg"
                aria-hidden="true"
              ></span>
            )}
            <Link
              to="/"
              className={cn(
                "inline-flex items-center w-full text-sm font-semibold transition-colors duration-150 hover:text-gray-800 dark:hover:text-gray-200",
                isRoot && "text-gray-800 dark:text-gray-100"
              )}
            >
              <HardDrive className="w-5 h-5" />
              <span className="ml-4">My Buckets</span>
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;