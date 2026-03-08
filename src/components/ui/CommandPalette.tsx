'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  LayoutDashboard,
  FolderOpen,
  Plus,
  Search,
  FileText,
  Shield,
  ClipboardCheck,
  X,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  const runCommand = useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      setSearch('');
      fn();
    },
    [onOpenChange]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-navy/80 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-xl mx-4"
        onClick={e => e.stopPropagation()}
      >
        <Command
          className="rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: 'var(--navy-700)',
            border: '1px solid var(--border-hover)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,180,0.1)',
          }}
          shouldFilter={true}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--teal)' }} />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search pages, projects, actions..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
              style={{ color: 'var(--off-white)' }}
            />
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded opacity-40 hover:opacity-70 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm opacity-40">
              No results found
            </Command.Empty>

            {/* Navigation */}
            <Command.Group
              heading="Navigation"
              className="text-xs font-semibold uppercase tracking-wider px-2 py-1.5 opacity-40"
            >
              <PaletteItem
                icon={LayoutDashboard}
                label="Dashboard"
                onSelect={() => runCommand(() => router.push('/dashboard'))}
              />
              <PaletteItem
                icon={FolderOpen}
                label="All Projects"
                onSelect={() => runCommand(() => router.push('/projects'))}
              />
            </Command.Group>

            {/* Actions */}
            <Command.Group
              heading="Actions"
              className="text-xs font-semibold uppercase tracking-wider px-2 py-1.5 opacity-40 mt-1"
            >
              <PaletteItem
                icon={Plus}
                label="New Project"
                description="Create a new compliance project"
                onSelect={() => runCommand(() => router.push('/projects/new'))}
                accent
              />
              <PaletteItem
                icon={FileText}
                label="Generate Drafts"
                description="Run AI documentation generation"
                onSelect={() => runCommand(() => router.push('/projects'))}
              />
              <PaletteItem
                icon={Shield}
                label="Run Intelligence"
                description="Analyze MAUDE data for comparable devices"
                onSelect={() => runCommand(() => router.push('/projects'))}
              />
              <PaletteItem
                icon={ClipboardCheck}
                label="Review Queue"
                description="Open pending review tasks"
                onSelect={() => runCommand(() => router.push('/projects'))}
              />
            </Command.Group>
          </Command.List>

          {/* Footer hint */}
          <div
            className="px-4 py-2 flex items-center gap-4 text-xs opacity-30 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
            <span><kbd className="font-mono">Esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

interface PaletteItemProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  onSelect: () => void;
  accent?: boolean;
}

function PaletteItem({ icon: Icon, label, description, onSelect, accent }: PaletteItemProps) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors"
      style={{ color: 'var(--off-white)' }}
    >
      <div
        className="p-1.5 rounded-md flex-shrink-0"
        style={{ background: accent ? 'var(--teal-dim)' : 'var(--surface-2)' }}
      >
        <Icon
          className="h-3.5 w-3.5"
          style={{ color: accent ? 'var(--teal)' : 'rgba(245,244,240,0.6)' }}
        />
      </div>
      <div className="min-w-0">
        <p style={{ color: accent ? 'var(--teal)' : 'var(--off-white)' }}>{label}</p>
        {description && (
          <p className="text-xs mt-0.5 opacity-40 truncate">{description}</p>
        )}
      </div>
    </Command.Item>
  );
}
