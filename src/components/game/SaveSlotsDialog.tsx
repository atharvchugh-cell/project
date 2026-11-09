/**
 * Saved games manager — list, rename, resume and delete durable saves for both
 * the stock simulator and the Real Estate game.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  listSlots, deleteSlot, renameSlot, formatLastPlayed, formatRemaining,
  type SaveMeta,
} from '@/lib/saveSlots';
import { Play, Pencil, Trash2, Check, X, Building2, LineChart, Laptop } from 'lucide-react';

interface SaveSlotsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the slot the player chose to continue. */
  onResume: (meta: SaveMeta) => void;
}

function money(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

export function SaveSlotsDialog({ open, onOpenChange, onResume }: SaveSlotsDialogProps) {
  const [slots, setSlots] = useState<SaveMeta[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<SaveMeta | null>(null);

  const refresh = useCallback(() => setSlots(listSlots()), []);

  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  // Another tab deleting or advancing a save should show up here too.
  useEffect(() => {
    if (!open) return;
    const onStorage = () => refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [open, refresh]);

  const grouped = useMemo(() => ({
    stock: slots.filter(s => s.kind === 'stock'),
    realestate: slots.filter(s => s.kind === 'realestate'),
  }), [slots]);

  const commitRename = (id: string) => {
    renameSlot(id, draftName);
    setEditing(null);
    refresh();
  };

  const renderSlot = (s: SaveMeta) => (
    <div
      key={s.id}
      className="rounded-lg border border-border/60 bg-card/60 p-3 sm:p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing === s.id ? (
            <div className="flex items-center gap-2">
              <Input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setEditing(null); }}
                maxLength={60}
                autoFocus
                aria-label="Save name"
                className="h-9 bg-secondary"
              />
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Save name" onClick={() => commitRename(s.id)}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Cancel rename" onClick={() => setEditing(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {s.kind === 'stock'
                ? <LineChart className="w-4 h-4 text-primary shrink-0" />
                : <Building2 className="w-4 h-4 text-primary shrink-0" />}
              <span className="font-display font-semibold truncate">{s.name}</span>
            </div>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            {s.mode}{s.difficulty ? ` · ${s.difficulty}` : ''} · {s.startYear}–{s.endYear} · Year {s.currentYear}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {money(s.portfolioValue)} · {formatRemaining(s.remainingSeconds)} · {formatLastPlayed(s.updatedAt)}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-9 gap-2" onClick={() => onResume(s)}>
          <Play className="w-3.5 h-3.5" /> Continue
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-2 border-border/60"
          onClick={() => { setEditing(s.id); setDraftName(s.name); }}
        >
          <Pencil className="w-3.5 h-3.5" /> Rename
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-9 gap-2 text-muted-foreground hover:text-loss"
          onClick={() => setPendingDelete(s)}
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Saved games</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5" />
              Stored on this device and browser only — they stay until you delete them.
            </DialogDescription>
          </DialogHeader>

          {slots.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No saved games yet. Any game you start is saved automatically as you play.
            </p>
          )}

          {grouped.stock.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Stock market</h3>
              {grouped.stock.map(renderSlot)}
            </section>
          )}

          {grouped.realestate.length > 0 && (
            <section className="space-y-2 mt-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Real estate</h3>
              {grouped.realestate.map(renderSlot)}
            </section>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={o => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this save?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will be removed permanently. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-loss hover:bg-loss/90 text-foreground"
              onClick={() => {
                if (pendingDelete) deleteSlot(pendingDelete.id);
                setPendingDelete(null);
                refresh();
              }}
            >
              Delete save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
