import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { createSocialManifest, initialSocialState, packState, unpackState, advanceSocialState, validateSocialAction, gameReducer, calcPortfolioValue, calculateInvestmentReturn, DATA_VERSION } from '../_shared/social-market.generated.js';

const settingsSchema = z.object({ start: z.number().int().min(1990).max(2015), duration: z.union([z.literal(10),z.literal(15),z.literal(20),z.literal(35)]), mode: z.enum(['normal','complex']), capital: z.number().min(5000).max(1000000), best_of: z.number().int().min(1).max(15).refine(n=>n%2===1), classroom: z.boolean().default(false) }).refine(s=>s.start+s.duration<=2025,'Choose years ending by 2025');
const actionSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('BUY'),assetId:z.string().max(60),shares:z.number().positive().max(1e12)}),
  z.object({type:z.literal('SELL'),assetId:z.string().max(60),shares:z.number().positive().max(1e12)}),
  z.object({type:z.literal('BUY_CD'),cdType:z.enum(['1y','2y','5y']),amount:z.number().positive().max(1e18)}),
  z.object({type:z.literal('WITHDRAW_CD'),cdId:z.string().max(60),early:z.boolean()}),
  z.object({type:z.literal('SET_AUTO_INVEST'),assetIds:z.array(z.string().max(60)).max(5)}),
]);
const bodySchema = z.object({ operation:z.enum(['create','preview','join','state','trade','start','pause','resume','request','accept','decline','settings','leave']),match_id:z.string().uuid().optional(),member_id:z.string().uuid().optional(),token:z.string().uuid().optional(),invite:z.string().uuid().optional(),request_id:z.string().uuid().optional(),nickname:z.string().trim().min(2).max(24).optional(),settings:settingsSchema.optional(),action:actionSchema.optional(),chat_enabled:z.boolean().optional() });
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  try {
    const input=bodySchema.parse(await req.json());
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const bearer=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
    let user:string|null=null;
    if(bearer){const {data}=await db.auth.getUser(bearer);user=data.user?.id??null;}
    const must = async (q:PromiseLike<{data:any,error:any}>)=>{const {data,error}=await q;if(error)throw new Error(error.message);return data;};
    if(input.operation==='create'){
      if(!user) return json({error:'Sign in to challenge friends. Guest room play stays available.'},401);
      if(!input.settings||!input.nickname||!input.request_id) return json({error:'Missing room settings'},400);
      const s=input.settings; const manifest=createSocialManifest(s.start,s.duration,s.mode);
      return json(await must(db.rpc('social_create_match',{p_owner:user,p_request:input.request_id,p_nickname:input.nickname,p_manifest:manifest,p_state:packState(initialSocialState(manifest,s.capital)),p_capital:s.capital,p_best_of:s.best_of,p_classroom:s.classroom})));
    }
    let match;
    if(input.invite)match=await must(db.from('social_matches').select('*').eq('invite_token',input.invite).maybeSingle());
    else if(input.match_id)match=await must(db.from('social_matches').select('*').eq('id',input.match_id).maybeSingle());
    if(!match) return json({error:'This invitation is unavailable'},404);
    const round=await must(db.from('social_rounds').select('*').eq('match_id',match.id).eq('round',match.current_round).single());
    const room=await must(db.from('game_sessions').select('*').eq('id',match.session_id).single());
    if(input.operation==='preview'||input.operation==='join'){
      let permitted=!!input.invite;
      if(user){const invites=await must(db.from('social_match_invites').select('id').eq('match_id',match.id).eq('recipient',user).eq('status','pending').gt('expires_at',new Date().toISOString()));permitted=permitted||invites.length>0||user===match.owner;}
      if(!permitted||new Date(match.expires_at).getTime()<Date.now())return json({error:'This invitation has expired or is private'},403);
      if(user&&await must(db.rpc('social_blocked',{a:match.owner,b:user}))) return json({error:'This invitation is unavailable'},403);
      if(input.operation==='preview')return json({match_id:match.id,host:room.host_name,settings:{start:round.manifest.startYear,duration:round.manifest.duration,mode:round.manifest.mode,capital:round.capital,best_of:match.best_of,classroom:room.classroom}});
      if(!input.nickname)return json({error:'Enter a nickname'},400);
      return json(await must(db.rpc('social_join_match',{p_match:match.id,p_user:user,p_nickname:input.nickname,p_state:packState(initialSocialState(round.manifest,Number(round.capital)))})));
    }
    const member= input.member_id ? await must(db.from('social_match_members').select('*').eq('id',input.member_id).eq('match_id',match.id).maybeSingle()) : null;
    if(!member || (member.token!==input.token && (!user || member.user_id!==user)))return json({error:'Invalid room credentials'},403);
    const members=await must(db.from('social_match_members').select('*').eq('match_id',match.id));
    if(user){for(const other of members){if(other.user_id&&other.user_id!==user&&await must(db.rpc('social_blocked',{a:user,b:other.user_id})))return json({error:'This match is unavailable after blocking'},403);}}
    const elapsed=round.started_at?Math.max(0,((round.paused_at?new Date(round.paused_at):new Date()).getTime()-new Date(round.started_at).getTime())/1000-Number(round.paused_seconds)):0;
    const target=Math.min(round.manifest.duration*60,Math.floor(elapsed));
    if(['start','pause','resume','request','accept','decline'].includes(input.operation)){
      let nextSettings=round.next_settings;
      if(input.operation==='request'&&round.rematch_status!=='pending')nextSettings=input.settings??{start:round.manifest.startYear,duration:round.manifest.duration,mode:round.manifest.mode,capital:Number(round.capital),best_of:match.best_of,classroom:room.classroom};
      const s=nextSettings??{start:round.manifest.startYear,duration:round.manifest.duration,mode:round.manifest.mode,capital:Number(round.capital)};
      const manifest=['request','accept'].includes(input.operation)?createSocialManifest(s.start,s.duration,s.mode):null;
      await must(db.rpc('social_round_transition',{p_match:match.id,p_member:member.id,p_operation:input.operation,p_manifest:manifest,p_settings:nextSettings,p_state:manifest?packState(initialSocialState(manifest,s.capital)):null}));
      return json({ok:true});
    }
    if(input.operation==='settings'){
      if(member.user_id!==match.owner)return json({error:'Only the host can change chat'},403);
      await must(db.rpc('set_room_settings',{p_session_id:room.id,p_token:room.host_token,p_classroom:null,p_chat_enabled:input.chat_enabled??null}));return json({ok:true});
    }
    if(input.operation==='leave'){
      if(member.user_id===match.owner){await must(db.from('game_sessions').update({status:'ended'}).eq('id',room.id));}
      await must(db.from('game_players').update({is_connected:false}).eq('id',member.player_id));return json({ok:true});
    }
    if(input.operation==='trade'){
      if(!round.started_at||round.paused_at||target>=round.manifest.duration*60)return json({error:'This round is not accepting trades'},409);
      if(!input.action||!input.request_id)return json({error:'Missing order'},400);
    }
    const summaries=[];let ownState=null;
    // Every result derives only from states committed by this function. Never accept a client balance.
    for(const p of members){
      let resolved=null;
      for(let attempt=0;attempt<4;attempt++){
        const stored=await must(db.from('social_player_states').select('*').eq('member_id',p.id).eq('round',match.current_round).single());
        let state=advanceSocialState(unpackState(stored.state,round.manifest),target);
        let action=null;
        if(input.operation==='trade'&&p.id===member.id){
          const duplicate=await must(db.from('social_match_actions').select('request_id').eq('member_id',p.id).eq('round',match.current_round).eq('request_id',input.request_id));
          if(!duplicate.length){
            action=input.action;
            if(action.type==='BUY_CD'){const y=state.startYear+Math.floor(state.totalSeconds/60);const rates=(await import('../_shared/social-market.generated.js')).getSocialCDRates(y);action={...action,rate:rates[action.cdType]};}
            validateSocialAction(state,action);state=gameReducer(state,action);
          }
        }
        const value=calcPortfolioValue(state);const result=state.phase==='ended'?{ending_value:value,contributions:state.totalContributions,return_pct:calculateInvestmentReturn(value,state.totalContributions),data_version:round.manifest.dataVersion,history:state.portfolioHistory,standouts:Object.entries(state.totalBought??{}).map(([id,invested])=>{const a=state.assetConfigs.find(a=>a.id===id);const price=a?.prices[a.prices.length-1]??0;const profit=(state.holdings[id]??0)*price-(state.costBasis[id]??0)+(state.realizedPnl?.[id]??0);return {id,ticker:a?.ticker,invested,profit,returnPct:invested>0?profit/invested*100:0};})}:null;
        const changed=await must(db.rpc('social_commit_state',{p_member:p.id,p_round:match.current_round,p_revision:stored.revision,p_state:packState(state),p_request:action?input.request_id:null,p_action:action,p_result:result}));
        if(changed){resolved=state;break;}
      }
      if(!resolved)throw new Error('Match is updating. Please try again');
      summaries.push({id:p.id,nickname:p.nickname,value:calcPortfolioValue(resolved),contributions:resolved.totalContributions,return_pct:calculateInvestmentReturn(calcPortfolioValue(resolved),resolved.totalContributions),history:resolved.portfolioHistory,accepted:p.rematch_accepted});
      if(p.id===member.id)ownState=packState({...resolved,roomPaused:!!round.paused_at});
    }
    if(target>=round.manifest.duration*60){await must(db.from('social_rounds').update({finished:true}).eq('match_id',match.id).eq('round',match.current_round));await must(db.from('game_sessions').update({status:'ended'}).eq('id',room.id));}
    const results=await must(db.from('social_match_results').select('member_id,round,ending_value,return_pct,standouts').in('member_id',members.map(p=>p.id)).order('round'));
    const ownPlayer=await must(db.from('game_players').select('secret_token').eq('id',member.player_id).single());
    return json({match_id:match.id,round:match.current_round,best_of:match.best_of,host:member.user_id===match.owner,manifest:round.manifest,state:ownState,members:summaries,results,rematch_status:round.rematch_status,started:!!round.started_at,paused:!!round.paused_at,session_id:room.id,actor_id:member.player_id,chat_token:ownPlayer.secret_token,classroom:room.classroom,chat_enabled:room.chat_enabled,invite:match.invite_token,code:room.game_code});
  }catch(error){return json({error:error instanceof Error?error.message:'Could not update this match'},400);}
});