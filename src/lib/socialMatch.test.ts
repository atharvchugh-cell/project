import { describe,expect,it } from 'vitest';
import { seriesScores,type MatchMember,type MatchResult } from './socialMatch';
const members=['a','b'].map(id=>({id,nickname:id,value:0,contributions:5000,return_pct:0,history:[],accepted:false})) as MatchMember[];
const result=(member_id:string,round:number,return_pct:number):MatchResult=>({member_id,round,return_pct,ending_value:0,standouts:[]});
describe('verified series scoring',()=>{
  it('best-of 3 counts completed round winners only',()=>{expect(seriesScores(members,[result('a',1,20),result('b',1,10),result('a',2,10),result('b',2,30),result('a',3,50)])).toEqual({a:1,b:1});});
  it('ties award neither participant a win',()=>{expect(seriesScores(members,[result('a',1,20),result('b',1,20)])).toEqual({a:0,b:0});});
});