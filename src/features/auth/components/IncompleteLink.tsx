import type { ReactNode } from 'react';
import { ArrowLeft, Link2Off } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface IncompleteLinkProps {
  title: string;
  children: ReactNode;
  onLogin: () => void;
}

/**
 * What an emailed-link screen shows when it was opened without its `?token=` — a link
 * truncated by a mail client, or the path typed by hand.
 *
 * Said before any field is shown rather than after a submit, because nothing the person
 * could type would make the link work: letting them choose a password first and refusing
 * it afterwards costs them the effort and tells them nothing new.
 */
const IncompleteLink = ({ title, children, onLogin }: IncompleteLinkProps) => (
  <Card>
    <CardHeader className="text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <Link2Off className="size-6" aria-hidden="true" />
      </div>
      <CardTitle className="text-2xl">{title}</CardTitle>
      <CardDescription>{children}</CardDescription>
    </CardHeader>
    <CardFooter className="justify-center">
      <Button type="button" variant="link" size="sm" className="text-muted-foreground" onClick={onLogin}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to sign in
      </Button>
    </CardFooter>
  </Card>
);

export default IncompleteLink;
