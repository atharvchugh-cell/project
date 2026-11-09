import { describe, it, expect } from 'vitest';
import { newCareer, parseCareer, firmCash, founderCash, forkCareer } from './career';
import { brandBoost, logoTraits, rebrand, rebrandCheck, upgradeEmpire } from './brand';
import { netAssets } from '@/lib/fund/accounting';
import { post } from './journal';
import { businessQuarter, companyCash } from './business';
import { closeQuarter, resolveDecision } from './close';
import { quote, profileOf } from './clients';
const fixture = () => newCareer({ firmName: 'Test', fundName: 'Fund', hq: 'Boston', scenario: 'institutional', philosophy: 'diversified', years: 10, seed: 3 });
describe('saved seeded brands', () => {
  it('logos are deterministic while stage and variants differ', () => {
    expect(logoTraits('x', 'fintech')).toEqual(logoTraits('x', 'fintech'));
    expect(logoTraits('x', 'fintech', 5)).not.toEqual(logoTraits('x', 'fintech', 0));
    const variants = [0,1,2].map(v => logoTraits('firm','manager',0,v));
    expect(new Set(variants.map(x => JSON.stringify(x))).size).toBeGreaterThan(1);
  });
  it('legacy opt-in preserves every balance and ended careers cannot upgrade', () => {
    const c = fixture(); delete c.empire;
    const before = JSON.stringify(c); const n = upgradeEmpire(c);
    expect(firmCash(n)).toBe(firmCash(c)); expect(founderCash(n)).toBe(founderCash(c)); expect(n.fund).toEqual(c.fund); expect(n.journal).toEqual(c.journal);
    expect(JSON.stringify(c)).toBe(before); expect(n.empire?.version).toBe(1);
    const ended = { ...c, status: 'ended' as const }; expect(upgradeEmpire(ended)).toBe(ended);
  });
  it('firm rebrand costs $25K only from firm cash and cannot be repeated this quarter', () => {
    const c = fixture(); const n = rebrand(c, 'firm', 'New Identity', 2);
    expect(n.ok).toBe(true); expect(firmCash(n.c)).toBe(firmCash(c) - 25000);
    expect(founderCash(n.c)).toBe(founderCash(c)); expect(netAssets(n.c.fund.ledger)).toBe(netAssets(c.fund.ledger));
    expect(n.c.id).toBe(c.id); expect(n.c.firmName).toBe('New Identity');
    expect(rebrand(n.c,'firm','Again',0).ok).toBe(false);
    expect(brandBoost(n.c,'firm',1)).toBe(0.03); expect(brandBoost(n.c,'firm',2)).toBe(0.03); expect(brandBoost(n.c,'firm',3)).toBe(0);
  });
  it('owned-company rebrand uses its cash and expires without permanently raising base revenue', () => {
    const c = fixture(); c.subsidiaries.push({ id:'sub', name:'Company', kind:'research', price:0, revenueQ:1e6,costQ:5e5,multiple:5,acquiredQ:-5,ownerId:'firm' });
    expect(rebrand(c,'sub','New',1).ok).toBe(false);
    post(c.journal,{ q:0,date:'Test',payer:'external',recipient:'sub',category:'opening',amount:100000,source:'fixture',memo:'Fixture' });
    const n = rebrand(c,'sub','New',1); expect(n.ok).toBe(true);
    expect(companyCash(n.c,'sub')).toBe(75000); expect(firmCash(n.c)).toBe(firmCash(c));
    expect(businessQuarter(n.c.subsidiaries[0],1).revenue).toBe(1030000);
    expect(businessQuarter(n.c.subsidiaries[0],3).revenue).toBe(1000000);
  });
  it('save/reload and practice branches preserve identity without touching the live career', () => {
    const c = fixture(); const branch = rebrand(forkCareer(c),'firm','Practice Name',1).c;
    expect(c.firmName).toBe('Test'); expect(branch.practice).toBe(true);
    const n = rebrand(c,'firm','Saved Name',1).c; const reload = parseCareer(JSON.stringify(n));
    expect(reload?.empire).toEqual(n.empire); expect(reload?.firmName).toBe('Saved Name');
  });
  it('invalid names, variants, unowned entities and unaffordable campaigns cannot move money', () => {
    const c=fixture();
    for(const [id,name,v] of [['firm','',0],['firm','Name',NaN],['missing','Name',0],['firm','x'.repeat(61),1]] as const) expect(rebrand(c,id,name,v).c).toBe(c);
    expect(rebrandCheck(c,'missing').reason).toBeTruthy();
  });
  it('campaigns raise real investor quote shares only with completed benchmark outperformance', () => {
    let c=fixture(); for(let i=0;i<4;i++) c=closeQuarter(c,{orders:[],acceptOfferIds:[]});
    c.fund.history=c.fund.history.map(h=>({...h,ret:0.03,bench:0.01,latePayment:false}));
    const id=c.fund.investors.find(i=>i.id!=='you')?.id; if(!id) throw new Error('Expected client');
    const p=profileOf(c,id); const base=quote(c,p,60).share;
    const n=rebrand(c,'firm','Campaign',1).c; n.fund.q+=1;
    expect(quote(n,p,60).share-base).toBeCloseTo(0.03,10);
    n.fund.q+=2; expect(quote(n,p,60).share).toBe(base);
  });
  it('closing the campaign twice preserves idempotency and does not retain a promotional base', () => {
    const c=fixture(); c.subsidiaries.push({id:'sub',name:'Company',kind:'research',price:0,revenueQ:1e6,costQ:5e5,multiple:5,acquiredQ:-5,ownerId:'firm'});
    post(c.journal,{q:0,date:'Test',payer:'external',recipient:'sub',category:'opening',amount:100000,source:'fixture',memo:'Fixture'});
    let n=rebrand(c,'sub','New',1).c;
    n=closeQuarter(n,{orders:[],acceptOfferIds:[]}); expect(n.subsidiaries[0].postedRevenue?.amount).toBe(1030000); expect(n.subsidiaries[0].revenueQ).toBe(1000000);
    n=closeQuarter(n,{orders:[],acceptOfferIds:[]}); n=closeQuarter(n,{orders:[],acceptOfferIds:[]}); expect(n.subsidiaries[0].postedRevenue?.amount).toBe(1000000);
    const stale={...n,fund:{...n.fund,q:2}}; expect(closeQuarter(stale)).toBe(stale);
  });
  it('decisions persist their selected outcome without allowing a second settlement', () => {
    const c=fixture();c.decisions.push({id:'outcome',q:0,kind:'payroll_shortfall',amount:0,text:'Fixture'});
    const n=resolveDecision(c,'outcome','defer'); expect(n.decisions[0].outcome).toContain('Bills remain owed');
    expect(resolveDecision(n,'outcome','defer')).toBe(n);
    expect(parseCareer(JSON.stringify(n))?.decisions[0].outcome).toBe(n.decisions[0].outcome);
  });
});