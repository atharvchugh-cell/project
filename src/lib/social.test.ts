import { describe, expect, it } from 'vitest';
import { friendSections, type SocialPerson } from './social';
const person = (id: string, status: string, sender: string, recipient: string): SocialPerson => ({ id, status, sender, recipient, username: id, display_name: null, avatar: 'chart', bio: '', mutual_friends: 0 });
describe('private friend request roles', () => {
  it('only received pending requests are incoming', () => {
    const s = friendSections([person('a', 'pending', 'a', 'me'), person('b', 'pending', 'me', 'b')], 'me');
    expect(s.incoming.map(p => p.id)).toEqual(['a']);
    expect(s.outgoing.map(p => p.id)).toEqual(['b']);
  });
  it('removed and declined requests are not friends', () => {
    expect(friendSections([person('a','accepted','me','a'),person('b','removed','me','b'),person('c','declined','c','me')], 'me').friends.map(p => p.id)).toEqual(['a']);
  });
});