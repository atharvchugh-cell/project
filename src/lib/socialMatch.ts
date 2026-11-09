import { supabase } from '@/integrations/supabase/client';
import type { SocialManifest, packState } from './socialMarket';
export interface MatchCredentials { match_id:string;member_id:string;token:string }
export interface MatchMember { id:string;nickname:string;value:number;contributions:number;return_pct:number;history:number[];accepted:boolean }
export interface MatchResult { member_id:string;round:number;ending_value:number;return_pct:number;standouts:{ticker:string;profit:number;returnPct:number}[] }
export interface MatchView {
  match_id:string;round:number;best_of:number;host:boolean;manifest:SocialManifest;state:ReturnType<typeof packState>;members:MatchMember[];results:MatchResult[];
  rematch_status:string;started:boolean;paused:boolean;session_id:string;actor_id:string;chat_token:string;classroom:boolean;chat_enabled:boolean;invite:string;code:string;
}
export interface MatchSettings { start:number;duration:10|15|20|35;mode:'normal'|'complex';capital:number;best_of:number;classroom:boolean }
export async function matchCall<T>(body:Record<string,unknown>):Promise<T> {
  const { data,error }=await supabase.functions.invoke('social-match',{body});
  if(error){let message='Could not reach the match. Try again.';try{const reply=await error.context?.json();message=reply?.error??message;}catch{/* No response body. */}throw new Error(message);}
  if(data?.error)throw new Error(data.error);
  return data as T;
}
export function saveMatchCredentials(c:MatchCredentials){localStorage.setItem(`rr:social-match:${c.match_id}`,JSON.stringify(c));}
export function loadMatchCredentials(id:string):MatchCredentials|null{try{const c=JSON.parse(localStorage.getItem(`rr:social-match:${id}`)??'null');return c?.match_id===id&&typeof c.member_id==='string'&&typeof c.token==='string'?c:null;}catch{return null;}}
export function seriesScores(members:MatchMember[],results:MatchResult[]) {
  const scores=Object.fromEntries(members.map(m=>[m.id,0]));
  for(const round of new Set(results.map(r=>r.round))){const entries=results.filter(r=>r.round===round);if(entries.length!==members.length)continue;const best=Math.max(...entries.map(r=>Number(r.return_pct)));const winners=entries.filter(r=>Math.abs(Number(r.return_pct)-best)<1e-9);if(winners.length===1)scores[winners[0].member_id]=(scores[winners[0].member_id]??0)+1;}
  return scores;
}