import React from 'react';
import { Keyboard, Navigation, Zap, FormInput } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setShortcutsCheatsheetOpen } from '@/features/ui/uiSlice';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ShortcutGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcuts: Array<{
    label: string;
    keys: string[];
    description?: string;
  }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation Chords',
    icon: Navigation,
    shortcuts: [
      { label: 'Go to Dashboard', keys: ['G', 'D'] },
      { label: 'Go to Projects & Boards', keys: ['G', 'P'] },
      { label: 'Go to Timesheets', keys: ['G', 'T'] },
      { label: 'Go to Reports & Analytics', keys: ['G', 'R'] },
      { label: 'Go to Activity Log', keys: ['G', 'A'] },
      { label: 'Toggle AI Copilot Chat', keys: ['G', 'C'] },
    ],
  },
  {
    title: 'Actions & Quick Capture',
    icon: Zap,
    shortcuts: [
      { label: 'Quick Create Issue (Anywhere)', keys: ['C'] },
      { label: 'Command Search & Palette', keys: ['⌘K', 'or', '/'] },
      { label: 'Toggle Focus Mode', keys: ['Shift', 'F'] },
      { label: 'Toggle Navigation Sidebar', keys: ['['] },
      { label: 'Toggle Workspace Project Tree', keys: [']', 'or', '\\'] },
      { label: 'Open Shortcuts Cheatsheet', keys: ['?'] },
    ],
  },
  {
    title: 'Forms & Modals',
    icon: FormInput,
    shortcuts: [
      { label: 'Submit / Save Issue', keys: ['⌘', '↵'] },
      { label: 'Close Active Modal / Drawer', keys: ['Esc'] },
    ],
  },
];

export const ShortcutsCheatsheetModal = () => {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.shortcutsCheatsheetOpen);

  return (
    <Dialog open={open} onOpenChange={(val) => dispatch(setShortcutsCheatsheetOpen(val))}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Keyboard className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Keyboard Shortcuts</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Speed up your workflow with keyboard navigation chords and hotkeys.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5 py-2">
          {SHORTCUT_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.title} className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon className="size-3.5" />
                  <span>{group.title}</span>
                </div>
                <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/50 text-sm">
                  {group.shortcuts.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between px-3.5 py-2 hover:bg-accent/40 transition-colors"
                    >
                      <span className="text-xs sm:text-sm font-medium text-foreground">{item.label}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((k, idx) =>
                          k === 'or' ? (
                            <span key={idx} className="text-[10px] text-muted-foreground px-0.5">
                              or
                            </span>
                          ) : (
                            <kbd
                              key={idx}
                              className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-semibold text-muted-foreground shadow-xs"
                            >
                              {k}
                            </kbd>
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutsCheatsheetModal;
