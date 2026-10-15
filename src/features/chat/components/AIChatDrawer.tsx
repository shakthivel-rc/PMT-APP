import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setChatDrawerOpen, toggleChatDrawer } from '@/features/ui/uiSlice';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import AIChatView from './AIChatView';

export const AIChatDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const isOpen = useAppSelector((state) => state.ui.chatDrawerOpen);
  const isChatPage = location.pathname.startsWith('/chat');

  // Match /projects/:workspaceId from route if present
  const projectMatch = location.pathname.match(/\/projects\/([a-zA-Z0-9-]+)/);
  const currentWorkspaceId = projectMatch ? projectMatch[1] : undefined;

  return (
    <>
      {/* Floating Action Button (bottom-right) */}
      {!isOpen && !isChatPage && (
        <button
          onClick={() => dispatch(toggleChatDrawer())}
          title="Open AI Chat Assistant"
          aria-label="Open AI Chat Assistant"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-primary/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <Sparkles className="size-4 animate-pulse" />
          <span className="hidden sm:inline">AI Assistant</span>
        </button>
      )}

      {/* Centered AI Chat Modal Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => dispatch(setChatDrawerOpen(open))}>
        <DialogContent
          showCloseButton={false}
          className="w-[96vw] max-w-[96vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl h-[90vh] sm:h-[85vh] max-h-[850px] p-0 border border-border bg-background shadow-2xl rounded-2xl flex flex-col z-50 overflow-hidden"
        >
          <div className="sr-only">
            <DialogTitle>PMT AI Assistant</DialogTitle>
          </div>
          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            <AIChatView
              initialWorkspaceId={currentWorkspaceId}
              onClose={() => dispatch(setChatDrawerOpen(false))}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIChatDrawer;
