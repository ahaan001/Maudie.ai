'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommandPalette } from './ui/CommandPalette';
import { DraftGenerationProvider } from '@/contexts/DraftGenerationContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <DraftGenerationProvider>
        <CommandPaletteContext.Provider value={{ open: paletteOpen, setOpen: setPaletteOpen }}>
          <AnimatePresence mode="wait">
            {children}
          </AnimatePresence>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </CommandPaletteContext.Provider>
        </DraftGenerationProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

import { createContext, useContext } from 'react';

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
});

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}
