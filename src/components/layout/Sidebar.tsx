import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { NAV_ITEMS, BRAND_NAME } from '@/config/nav';
import BrandMark from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onLogout: () => void;
  /** Called after any nav item is chosen — used to close the mobile drawer. */
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar = ({
  onLogout,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) => (
  <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
    {/* Brand */}
    <div
      className={cn(
        'flex h-[70px] shrink-0 items-center border-b border-sidebar-border transition-all duration-200',
        collapsed ? 'justify-center px-2' : 'gap-2.5 px-6'
      )}
    >
      <BrandMark className="size-8 shrink-0 shadow-[var(--shadow-primary)]" />
      {!collapsed && (
        <span className="truncate text-lg font-bold tracking-tight text-sidebar-accent-foreground">
          {BRAND_NAME}
        </span>
      )}
    </div>

    {/* Nav */}
    <nav className="flex-1 space-y-1.5 overflow-y-auto px-2 py-4">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className="block"
          title={collapsed ? item.label : undefined}
          aria-label={collapsed ? item.label : undefined}
        >
          {({ isActive }) => (
            <span
              className={cn(
                'relative isolate flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'text-sidebar-primary-foreground font-semibold'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 -z-10 rounded-lg bg-sidebar-primary shadow-[var(--shadow-primary)]"
                  transition={{ type: 'spring', stiffness: 480, damping: 40 }}
                />
              )}
              <item.icon className="size-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </span>
          )}
        </NavLink>
      ))}
    </nav>

    {/* Footer: Toggle Collapse & Sign Out */}
    <div className="shrink-0 border-t border-sidebar-border p-2 space-y-1">
      {onToggleCollapse && (
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(
            'w-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            collapsed ? 'justify-center h-9' : 'justify-start gap-2.5 px-3'
          )}
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="size-4.5" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="size-4.5" aria-hidden="true" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </Button>
      )}

      <Button
        variant="ghost"
        size={collapsed ? 'icon' : 'default'}
        className={cn(
          'w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
          collapsed ? 'justify-center h-9' : 'justify-start gap-3 px-3'
        )}
        onClick={onLogout}
        title={collapsed ? 'Sign out' : undefined}
        aria-label="Sign out"
      >
        <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
        {!collapsed && <span>Sign out</span>}
      </Button>
    </div>
  </div>
);

export default Sidebar;
