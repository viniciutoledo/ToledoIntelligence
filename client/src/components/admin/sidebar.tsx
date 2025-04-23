import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Settings,
  Users,
  FileText,
  Menu,
  X,
  LogOut,
  BookOpen,
  CreditCard
} from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

export function AdminSidebar({ activeItem, onItemClick }: SidebarProps) {
  const { t } = useLanguage();
  const { user, logoutMutation } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const menuItems = [
    {
      id: "dashboard",
      label: t("admin.dashboard"),
      icon: <LayoutDashboard className="mr-3 h-5 w-5" />,
    },
    {
      id: "settings",
      label: t("admin.settings"),
      icon: <Settings className="mr-3 h-5 w-5" />,
    },
    {
      id: "users",
      label: t("admin.users"),
      icon: <Users className="mr-3 h-5 w-5" />,
    },
    {
      id: "training",
      label: t("admin.training"),
      icon: <BookOpen className="mr-3 h-5 w-5" />,
    },
    {
      id: "logs",
      label: t("admin.logs"),
      icon: <FileText className="mr-3 h-5 w-5" />,
    },
  ];

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-neutral-700">
        <div className="flex items-center">
          <span className="text-xl font-bold text-primary-400">Toledo</span>
          <span className="text-xl font-bold text-accent-400">IA</span>
          <span className="ml-2 text-sm bg-neutral-700 px-2 py-0.5 rounded">Admin</span>
        </div>
      </div>
      <nav className="mt-4">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "flex w-full items-center px-4 py-3 text-neutral-300 hover:bg-neutral-700 hover:text-white",
              activeItem === item.id && "bg-neutral-700 text-white"
            )}
            onClick={() => {
              onItemClick(item.id);
              setMobileOpen(false);
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </Button>
        ))}
        <LanguageToggle className="mx-4 mt-4" />
        <Button
          variant="ghost"
          className="flex w-full items-center px-4 py-3 text-neutral-300 hover:bg-neutral-700 hover:text-white mt-4"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          <span>{t("common.logout")}</span>
        </Button>
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="w-64 bg-neutral-800 text-white hidden md:block h-screen">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Toggle Button */}
      <div className="md:hidden fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="bg-primary text-white p-3 rounded-full shadow-lg"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-neutral-800 text-white overflow-auto">
          {sidebarContent}
        </div>
      )}

      {/* Top Nav for Mobile */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center md:hidden">
        <div className="flex items-center">
          <span className="text-xl font-bold text-primary-600">Toledo</span>
          <span className="text-xl font-bold text-accent-500">IA</span>
          <span className="ml-2 text-xs bg-neutral-200 px-2 py-0.5 rounded text-neutral-700">Admin</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-neutral-700"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </>
  );
}
