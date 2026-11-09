import type { Career } from '@/lib/firm/career';
import { resolveIdentity } from '@/lib/firm/identity';
import { Logo } from './Logo';
import { Portrait } from './Portrait';

/** Resolve known identities first; office/organisation senders receive logos, people keep stable portraits. */
export function SenderIdentity({ c, name, id, size = 32 }: { c: Career; name: string; id?: string; size?: number }) {
  const identity = resolveIdentity(c, name, id);
  return identity.kind === 'person'
    ? <Portrait seed={identity.seed} name={identity.name} age={identity.age} mood={identity.mood} role={identity.role} size={size} />
    : <Logo id={identity.id} name={identity.name} industry={identity.industry} variant={identity.variant} stage={identity.stage} size={size} />;
}