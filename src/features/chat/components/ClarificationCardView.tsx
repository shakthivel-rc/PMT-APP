import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Clarification } from '@/api/chat';

interface ClarificationCardViewProps {
  clarification: Clarification;
  onSelectOption: (option: string) => void;
  disabled?: boolean;
}

export const ClarificationCardView = ({
  clarification,
  onSelectOption,
  disabled = false,
}: ClarificationCardViewProps) => {
  return (
    <div className="my-3 rounded-xl border border-primary/25 bg-muted/40 p-3 sm:p-3.5 text-xs text-foreground shadow-2xs w-full max-w-full min-w-0 overflow-hidden break-words">
      <div className="flex items-center gap-1.5 font-semibold text-xs text-primary mb-1.5">
        <HelpCircle className="size-4 shrink-0" />
        <span>Clarification Needed</span>
      </div>
      <p className="font-medium text-xs mb-3 text-foreground leading-relaxed">{clarification.question}</p>
      <div className="flex flex-wrap gap-2">
        {clarification.options.map((opt, i) => (
          <Button
            key={i}
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onSelectOption(opt)}
            className="h-7 text-xs bg-background hover:bg-primary hover:text-primary-foreground border-border/80 transition-all font-medium"
          >
            {opt}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ClarificationCardView;
