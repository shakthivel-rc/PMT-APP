import type { Ref } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WorkspaceFieldsProps {
  /** Prefixes every id, because the create form and the edit dialog can be on screen together. */
  idPrefix: string;
  name: string;
  slug: string;
  onNameChange: (name: string) => void;
  /** Receives the slug lower-cased, as the space key is upper-cased: the case is not a choice. */
  onSlugChange: (slug: string) => void;
  /** `useFieldProblem(slugProblem(slug))`, owned by the form so that its submit can reveal it. */
  slugCheck: { shown: string | null; reveal: () => void };
  nameRef?: Ref<HTMLInputElement>;
  slugRef?: Ref<HTMLInputElement>;
}

/**
 * A workspace's name and slug: one copy for the create form and the edit dialog, so that both
 * check the slug the same way and explain a slug they cannot send in the same words.
 */
const WorkspaceFields = ({
  idPrefix,
  name,
  slug,
  onNameChange,
  onSlugChange,
  slugCheck,
  nameRef,
  slugRef,
}: WorkspaceFieldsProps) => (
  <>
    <div className="grid gap-2">
      <Label htmlFor={`${idPrefix}-name`}>Name</Label>
      <Input
        ref={nameRef}
        id={`${idPrefix}-name`}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="e.g. Acme Engineering"
        maxLength={100}
        autoComplete="off"
        required
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor={`${idPrefix}-slug`}>Slug</Label>
      <Input
        ref={slugRef}
        id={`${idPrefix}-slug`}
        value={slug}
        onChange={(e) => onSlugChange(e.target.value.toLowerCase())}
        onBlur={slugCheck.reveal}
        placeholder="acme-eng"
        // No `pattern` or `minLength`: the browser's messages name no fix. `slugProblem` does.
        maxLength={50}
        autoComplete="off"
        aria-invalid={slugCheck.shown ? true : undefined}
        aria-describedby={slugCheck.shown ? `${idPrefix}-slug-hint ${idPrefix}-slug-error` : `${idPrefix}-slug-hint`}
        required
      />
      <p id={`${idPrefix}-slug-hint`} className="text-xs text-muted-foreground">
        Lower-case letters, digits and hyphens. Appears in shared links.
      </p>
      {slugCheck.shown && (
        <p id={`${idPrefix}-slug-error`} className="text-xs text-danger">
          {slugCheck.shown}
        </p>
      )}
    </div>
  </>
);

export default WorkspaceFields;
