import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 w-full">
        <Header onMenuClick={toggleSidebar} />
        <main className="h-full overflow-y-auto">
          <div className="container px-6 py-8 mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;