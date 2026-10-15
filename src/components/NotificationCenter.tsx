import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Inbox,
  Loader2,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  type NotificationItem,
} from '@/api/notifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'assigned':
      return <UserCheck className="size-4 text-primary" />;
    case 'status_changed':
      return <TrendingUp className="size-4 text-emerald-500" />;
    default:
      return <Bell className="size-4 text-blue-500" />;
  }
}

export const NotificationCenter = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async (isBackground = false) => {
    try {
      const data = await fetchNotificationsApi({ limit: 30 });
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      // Quiet fail in background
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  // Poll notifications periodically in background
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadNotifications(true);
    });
    const interval = setInterval(() => {
      if (!cancelled) void loadNotifications(true);
    }, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadNotifications]);

  const handleMarkRead = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await markNotificationReadApi(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }

    if (item.link) {
      setOpen(false);
      navigate(item.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark notifications as read');
    }
  };

  const displayedList =
    tab === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setLoading(true);
          void loadNotifications();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={
            unreadCount > 0
              ? `Notifications: ${unreadCount} unread`
              : 'Notifications'
          }
          className="relative size-9 rounded-md text-muted-foreground hover:text-foreground"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-[360px] sm:w-[400px] p-0 shadow-2xl border-border bg-popover overflow-hidden rounded-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Inbox</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[11px] font-medium">
                {unreadCount} unread
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                title="Mark all as read"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="size-3.5 mr-1" />
                <span>Mark read</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-border/60 px-4 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={cn(
              'pb-2 px-1 font-medium transition-colors border-b-2 outline-none',
              tab === 'all'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setTab('unread')}
            className={cn(
              'pb-2 px-1 font-medium transition-colors border-b-2 outline-none',
              tab === 'unread'
                ? 'border-primary text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* List Content */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" />
              <span className="text-xs">Loading updates...</span>
            </div>
          ) : displayedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Inbox className="size-8 text-muted-foreground/40 mb-2 stroke-[1.5]" />
              <p className="text-xs font-medium text-foreground">No notifications</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {tab === 'unread' ? 'You have read all your updates.' : 'Activity and assignments will show up here.'}
              </p>
            </div>
          ) : (
            displayedList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleMarkRead(item)}
                className={cn(
                  'w-full text-left p-3.5 transition-colors flex items-start gap-3 hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none',
                  !item.is_read && 'bg-primary/5',
                )}
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border mt-0.5">
                  {getNotificationIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={cn('text-xs truncate', !item.is_read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                      {item.title}
                    </p>
                    {!item.is_read && (
                      <span className="size-2 rounded-full bg-primary shrink-0" aria-label="Unread" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                    {item.message}
                  </p>
                  <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                    {formatTimeAgo(item.created_at)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationCenter;
