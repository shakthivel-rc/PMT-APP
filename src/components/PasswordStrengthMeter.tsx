import { Check, X } from 'lucide-react';
import { PASSWORD_RULES, passwordStrength, type StrengthTone } from '@/lib/passwordRules';
import { cn } from '@/lib/utils';

const barTone: Record<StrengthTone, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  success: 'bg-success',
};
const textTone: Record<StrengthTone, string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  success: 'text-success',
};

/** Live strength meter + rule checklist, driven by the shared password policy. */
const PasswordStrengthMeter = ({ password }: { password: string }) => {
  const s = passwordStrength(password);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={s.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Password strength"
        >
          <div
            className={cn('h-full rounded-full transition-all duration-300', barTone[s.tone])}
            style={{ width: `${s.percent}%` }}
          />
        </div>
        <span className={cn('w-16 text-right text-xs font-medium', textTone[s.tone])} aria-live="polite">
          {password ? s.label : ''}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li
              key={rule.label}
              className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-success' : 'text-muted-foreground')}
            >
              {ok ? (
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <X className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
              )}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordStrengthMeter;
