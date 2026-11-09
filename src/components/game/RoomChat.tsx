import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

type RoomMessage = { id: number; sender_name: string; sender_kind: string; sender_id: string | null; body: string; created_at: string };

interface Props {
  sessionId: string;
  actorId: string | null;
  getToken: () => string | null;
  placement?: 'floating' | 'inline';
  roomEnded?: boolean;
  /** Classroom rooms: the host has chat switched off (the server also refuses messages). */
  chatOff?: boolean;
  /** Host only: show a Chat on/off switch. */
  onToggleChat?: (on: boolean) => void;
}

/** The shared room feed uses private participant credentials, not public table access. */
export function RoomChat({ sessionId, actorId, getToken, placement = 'floating', roomEnded = false, chatOff = false, onToggleChat }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const latestId = useRef(0);
  const openRef = useRef(false);
  const fetching = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { openRef.current = open; if (open) setUnread(0); }, [open]);
  useEffect(() => { latestId.current = 0; setMessages([]); setUnread(0); }, [sessionId]);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token || fetching.current) return;
    fetching.current = true;
    try {
      const { data, error: fetchError } = await supabase.rpc('read_room_messages', {
        p_session_id: sessionId, p_actor_id: actorId as string, p_token: token,
        p_after_id: latestId.current,
      });
      if (fetchError) { setError('Messages could not load. Reconnecting…'); return; }
      if (data?.length) {
        latestId.current = Math.max(latestId.current, ...data.map(m => m.id));
        setMessages(current => [...current, ...data].slice(-100));
        if (!openRef.current) setUnread(count => count + data.length);
      }
      setError('');
    } finally { fetching.current = false; }
  }, [sessionId, actorId, getToken]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 2500);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ block: 'nearest' }); }, [open, messages.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    const token = getToken();
    if (!body || !token || sending || roomEnded) return;
    setSending(true);
    const { error: sendError } = await supabase.rpc('send_room_message', {
      p_session_id: sessionId, p_actor_id: actorId as string, p_token: token, p_body: body,
    });
    setSending(false);
    if (sendError) { setError(sendError.message); return; }
    setDraft('');
    setError('');
    await refresh();
  };

  return (
    <>
    {placement === 'floating' && open && <div className="fixed inset-0 z-40 bg-background/70 sm:hidden" aria-hidden="true" onClick={() => setOpen(false)} />}
    <section aria-label="Room chat" className={placement === 'floating'
      ? `fixed bottom-4 left-4 z-50 rounded-lg border border-border bg-card shadow-lg ${open ? 'w-[min(21rem,calc(100vw-2rem))]' : 'w-auto'}`
      : 'rounded-lg border border-border bg-card'}>
      <Button variant="ghost" className="w-full h-11 justify-between rounded-lg px-3" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2 text-sm"><MessageCircle className="w-4 h-4 text-primary" /> Room chat {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{unread}</span>}</span>
        {open && <X className="w-4 h-4 text-muted-foreground" aria-label="Close chat" />}
      </Button>
      {open && <div className="border-t border-border">
        <div role="log" aria-label="Room messages" aria-live="polite" className="h-48 overflow-y-auto px-3 py-2 space-y-2 text-sm">
          {messages.length === 0 && <p className="text-muted-foreground text-xs py-3">No messages yet.</p>}
          {messages.map(message => <div key={message.id} className="break-words leading-snug">
            <span className="font-semibold text-primary">{message.sender_name}{message.sender_kind === 'host' ? ' · Host' : ''}</span>
            <span className="text-muted-foreground text-xs ml-2">{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            <p className="text-foreground">{message.body}</p>
          </div>)}
          <div ref={bottomRef} />
        </div>
        {error && <p role="alert" className="px-3 text-xs text-destructive">{error}</p>}
        {onToggleChat && !roomEnded && <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
          <span className="text-muted-foreground">{chatOff ? 'Chat is off for players' : 'Chat is on'}</span>
          <Button type="button" size="sm" variant={chatOff ? 'default' : 'secondary'} className="h-8" onClick={() => onToggleChat(chatOff)}>
            {chatOff ? 'Turn chat on' : 'Turn chat off'}
          </Button>
        </div>}
        {!roomEnded && chatOff && <p className="border-t border-border px-3 py-3 text-xs text-muted-foreground">Chat is turned off by the host</p>}
        {!roomEnded && !chatOff && <form onSubmit={send} className="flex gap-2 border-t border-border p-2">
          <Input aria-label="Message to room" placeholder="Message the room…" value={draft} onChange={e => setDraft(e.target.value)} maxLength={300} className="h-9 text-sm" />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!draft.trim() || sending} aria-label="Send message" title="Send message"><Send className="w-4 h-4" /></Button>
        </form>}
      </div>}
    </section>
    </>
  );
}