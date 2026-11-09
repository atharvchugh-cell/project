import { supabase } from '@/integrations/supabase/client';

export interface SocialPerson {
  id: string; username: string; display_name: string | null; avatar: string; bio: string;
  status: string | null; sender: string | null; recipient: string | null; mutual_friends: number;
}
export interface SocialProfile {
  username: string | null; display_name: string | null; social_visibility: 'private' | 'friends' | 'public';
  social_requests: boolean; social_presence: boolean; bio: string; avatar: string;
}
export interface SocialNotification { id: string; kind: string; reference_id: string; read_at: string | null; created_at: string }

export async function socialRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}
export const friendAction = (action: string, target?: string, text?: string) =>
  socialRpc<{ token?: string }>('social_friend_action', { p_action: action, p_target: target ?? null, p_text: text ?? null });

export function friendSections(people: SocialPerson[], userId: string) {
  return {
    friends: people.filter(p => p.status === 'accepted'),
    incoming: people.filter(p => p.status === 'pending' && p.recipient === userId),
    outgoing: people.filter(p => p.status === 'pending' && p.sender === userId),
  };
}