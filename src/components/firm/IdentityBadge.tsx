import { Logo } from './Logo';
import { identityHash } from '@/lib/firm/faces';
export const identitySeed = identityHash;
export function IdentityBadge({ name, kind = 'business', id, variant = 0, stage = 0 }: { name: string; kind?: string; id?: string; variant?: number; stage?: number }) {
  return <Logo id={id ?? name} name={name} industry={kind} variant={variant} stage={stage} size={36} />;
}