import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Single source for the image-or-initials avatar used in the header,
 * profile, user tables and activity rows.
 */
const UserAvatar = ({ name, avatarUrl, className }: UserAvatarProps) => (
  <Avatar className={cn('size-9', className)}>
    {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
    <AvatarFallback className="bg-primary/12 text-primary font-semibold">
      {initials(name)}
    </AvatarFallback>
  </Avatar>
);

export default UserAvatar;
