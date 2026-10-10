import * as Toast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { createContext, use, useCallback, useState, type ReactNode } from 'react';
import type { Tone } from '../orders/status';

interface ToastMessage {
  title: string;
  description?: string;
  tone?: Tone;
}

const ToastContext = createContext<((message: ToastMessage) => void) | null>(null);

export function useToast() {
  const toast = use(ToastContext);
  if (!toast) throw new Error('useToast needs a Toaster above it');
  return toast;
}

export function Toaster({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<(ToastMessage & { id: number })[]>([]);

  const toast = useCallback((message: ToastMessage) => {
    setMessages((current) => [...current, { ...message, id: Date.now() + Math.random() }]);
  }, []);

  return (
    <ToastContext value={toast}>
      <Toast.Provider label="Aviso" swipeDirection="right" duration={5000}>
        {children}
        {messages.map(({ id, title, description, tone = 'neutral' }) => (
          <Toast.Root
            key={id}
            data-tone={tone}
            onOpenChange={(open) => {
              if (!open) setMessages((current) => current.filter((message) => message.id !== id));
            }}
            className="flex animate-toast-in items-start gap-3 rounded-lg border border-line border-l-4 border-l-tone-solid bg-surface p-4 shadow-pop"
          >
            <div className="min-w-0 flex-1">
              <Toast.Title className="font-semibold">{title}</Toast.Title>
              {description && (
                <Toast.Description className="text-sm text-ink-muted">
                  {description}
                </Toast.Description>
              )}
            </div>
            <Toast.Close
              aria-label="Fechar aviso"
              className="-m-1 rounded-sm p-1 text-ink-muted hover:bg-sunken hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport
          label="Avisos ({hotkey})"
          className="fixed right-0 bottom-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 outline-none"
        />
      </Toast.Provider>
    </ToastContext>
  );
}
