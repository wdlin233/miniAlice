"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, X, Home, BarChart3, MessageSquare, TrendingUp, FileText, Moon, Sun, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "首页", href: "/", icon: <Home className="h-5 w-5" /> },
  { label: "数据看板", href: "/dashboard", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "智能对话", href: "/chat", icon: <MessageSquare className="h-5 w-5" /> },
  { label: "交易管理", href: "/trading", icon: <TrendingUp className="h-5 w-5" /> },
  { label: "会话管理", href: "/sessions", icon: <FileText className="h-5 w-5" /> }
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  // 客户端初始化：从localStorage读取状态
  useEffect(() => {
    const savedOpen = localStorage.getItem('sidebarOpen');
    if (savedOpen !== null) {
      setSidebarOpen(JSON.parse(savedOpen));
    }
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed !== null) {
      setSidebarCollapsed(JSON.parse(savedCollapsed));
    }
  }, []);

  // 持久化侧边栏状态
  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={toggleSidebar}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              MiniAlice
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* 侧边栏 */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ease-in-out md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ width: sidebarCollapsed ? '72px' : '256px' }}
        >
          <div className="flex h-16 items-center justify-between px-4 md:px-6 border-b">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={toggleSidebar}
              >
                <X className="h-5 w-5" />
              </Button>
              <div className={`font-semibold transition-all duration-300 ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                导航
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebarCollapse}
              className="transition-transform duration-300"
            >
              <div className={`transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}>
                <ChevronLeft className="h-4 w-4" />
              </div>
            </Button>
          </div>
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`}
                >
                  <div className="flex-shrink-0">
                    {item.icon}
                  </div>
                  <span className={`transition-all duration-300 ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* 主内容 */}
        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? (sidebarCollapsed ? 'md:ml-18' : 'md:ml-64') : 'md:ml-0'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
