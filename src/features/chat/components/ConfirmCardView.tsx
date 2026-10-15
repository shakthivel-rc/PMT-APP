import { useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, X, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ConfirmCard } from '@/api/chat';

interface ConfirmCardViewProps {
  card: ConfirmCard;
  onConfirm: (confirmId: string, typedText?: string) => void;
  onCancel: (confirmId: string) => void;
  disabled?: boolean;
}

export const ConfirmCardView = ({
  card,
  onConfirm,
  onCancel,
  disabled = false,
}: ConfirmCardViewProps) => {
  const [typedInput, setTypedInput] = useState('');
  const isT3 = card.tier === 'T3';
  const requiredText = card.required_typed_text?.trim() || '';
  const canConfirm = !isT3 || (requiredText !== '' && typedInput.trim() === requiredText);

  return (
    <div
      className={`my-3 rounded-xl border p-3.5 sm:p-4 shadow-sm transition-all w-full max-w-full min-w-0 overflow-hidden break-words ${
        isT3
          ? 'border-destructive/40 bg-destructive/10 text-foreground'
          : 'border-warning/40 bg-warning/10 text-foreground'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isT3 ? (
            <ShieldAlert className="size-5 text-destructive shrink-0" />
          ) : (
            <AlertTriangle className="size-5 text-warning shrink-0" />
          )}
          <span className="font-semibold text-sm">
            {isT3 ? 'Destructive Action Confirmation' : 'Action Confirmation Required'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {card.tool_name && (
            <Badge variant="outline" className="text-[10px] font-mono gap-1 bg-background/80">
              <Wrench className="size-2.5 text-muted-foreground" />
              {card.tool_name}
            </Badge>
          )}
          <Badge
            variant={isT3 ? 'destructive' : 'outline'}
            className={`text-[10px] uppercase font-bold tracking-wider ${
              !isT3 ? 'border-warning/50 text-warning bg-warning/10' : ''
            }`}
          >
            {card.tier}
          </Badge>
        </div>
      </div>

      <p className="text-sm font-medium mb-3 text-foreground leading-snug">{card.summary}</p>

      {card.danger_warning && (
        <div className="mb-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5 font-medium">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{card.danger_warning}</span>
        </div>
      )}

      {/* Changes / Diff if present */}
      {card.diff && Object.keys(card.diff).length > 0 && (
        <div className="mb-3 rounded-lg bg-background/90 p-2.5 text-xs border border-border/60">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Changes Preview
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            {Object.entries(card.diff).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{k}:</span>
                <span className="font-semibold text-foreground truncate">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved arguments */}
      {card.resolved_args && Object.keys(card.resolved_args).length > 0 && (
        <div className="mb-3 rounded-lg bg-background/80 p-2.5 text-xs border border-border/50">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Parameters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
            {Object.entries(card.resolved_args).map(([k, v]) => (
              <div key={k} className="flex gap-1 overflow-hidden">
                <span className="text-muted-foreground">{k}:</span>
                <span className="font-semibold truncate">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isT3 && requiredText && (
        <div className="mb-3 space-y-1.5">
          <label className="block text-xs font-medium text-foreground">
            To proceed, please type <span className="font-mono font-bold bg-background/90 px-1.5 py-0.5 rounded border border-border">{requiredText}</span> below:
          </label>
          <Input
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder={`Type "${requiredText}" to confirm`}
            className="h-8 text-xs font-mono bg-background"
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2.5 mt-2 border-t border-border/40">
        <Button
          size="sm"
          variant={isT3 ? 'destructive' : 'default'}
          disabled={!canConfirm || disabled}
          onClick={() => onConfirm(card.confirm_id, typedInput)}
          className="h-8 text-xs gap-1.5 font-semibold"
        >
          <CheckCircle className="size-3.5" />
          {isT3 ? 'Confirm Permanent Action' : 'Confirm & Execute'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onCancel(card.confirm_id)}
          className="h-8 text-xs gap-1"
        >
          <X className="size-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ConfirmCardView;
