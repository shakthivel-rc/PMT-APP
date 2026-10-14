import { RotateCcw, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UndoAction } from '@/api/chat';

interface UndoCardViewProps {
  action: UndoAction;
  onUndo: (undoId: string) => void;
  disabled?: boolean;
}

export const UndoCardView = ({ action, onUndo, disabled = false }: UndoCardViewProps) => {
  return (
    <div className="my-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs text-foreground">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="text-[10px] uppercase font-bold shrink-0 border-primary/40 text-primary bg-primary/10">
          T1 Reversible
        </Badge>
        {action.tool_name && (
          <Badge variant="outline" className="text-[10px] font-mono gap-1 shrink-0 bg-background/80">
            <Wrench className="size-2.5 text-muted-foreground" />
            {action.tool_name}
          </Badge>
        )}
        <span className="truncate text-muted-foreground">
          {action.description || `${action.tool_name} executed`}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onUndo(action.undo_id)}
        disabled={disabled}
        className="h-7 shrink-0 gap-1.5 text-xs text-primary hover:bg-primary hover:text-primary-foreground border-primary/40 font-medium transition-colors"
      >
        <RotateCcw className="size-3" />
        Undo
      </Button>
    </div>
  );
};

export default UndoCardView;
