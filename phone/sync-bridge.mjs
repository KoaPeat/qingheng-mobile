// 轻衡手机网页端事件生成助手。只处理日期差异，不接触密钥或网络。
// Cloudflare Worker v4: day.patch, unique id, append-only event queue.
export const NUTRIENT_FIELDS=['kcal','protein','carbs','fat','fiber','sodium','potassium','calcium','vitC'];
const VALID_ID=/^[A-Za-z0-9_.-]{1,130}$/;
const obj=x=>x&&typeof x==='object'?x:{};
const sorted=x=>JSON.stringify(obj(x));
function numeric(x,min,max){return typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;}
function normalizedEntry(entry,calculate){
 if(!entry||!VALID_ID.test(entry.id||'')||typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>180||!['breakfast','lunch','dinner','snack'].includes(entry.meal)||!numeric(entry.amount,0.01,10000)||typeof entry.unit!=='string'||entry.unit.length>20)throw Error('本地食品条目无法安全同步');
 const result={id:entry.id,name:entry.name.trim(),meal:entry.meal,amount:entry.amount,unit:entry.unit,custom:true};
 const nut=calculate(entry);
 for(const k of NUTRIENT_FIELDS){if(numeric(nut?.[k],0,100000))result[k]=nut[k];}
 return result;
}
export function diffDay(oldDay,newDay,calculate){
 const prev=obj(oldDay),next=obj(newDay),p={};
 const before=new Map((Array.isArray(prev.entries)?prev.entries:[]).filter(x=>VALID_ID.test(x.id||'')).map(x=>[x.id,x]));
 const after=new Map((Array.isArray(next.entries)?next.entries:[]).filter(x=>VALID_ID.test(x.id||'')).map(x=>[x.id,x]));
 const removed=[...before.keys()].filter(id=>!after.has(id));
 const changed=[...after.values()].filter(x=>!before.has(x.id)||sorted(before.get(x.id))!==sorted(x));
 if(removed.length)p.removeEntryIds=removed;
 if(changed.length)p.entries=changed.map(e=>normalizedEntry(e,calculate));
 for(const key of ['weight','activity','calorieOverride']){
   if((prev[key]??null)!==(next[key]??null)){
     const value=next[key]??null;
     if(value!==null&&!numeric(value,key==='weight'?20:0,key==='weight'?400:key==='activity'?10000:30000))throw Error('云同步数值不合法');
     p[key]=value;
   }
 }
 if(prev.poop!==next.poop&&['before','after','unspecified'].includes(next.poop))p.poop=next.poop;
 const oldMeals=obj(prev.mealOverrides),newMeals=obj(next.mealOverrides),changedMeals={};
 for(const name of ['breakfast','lunch','dinner','snack']){
   if((oldMeals[name]??null)!==(newMeals[name]??null))changedMeals[name]=newMeals[name]??null;
 }
 if(Object.keys(changedMeals).length)p.mealOverrides=changedMeals;
 // App's note is append-only. Only send a suffix so repeated pull won't duplicate notes.
 if(typeof next.note==='string'&&next.note.startsWith(prev.note||'')&&next.note.length>(prev.note||'').length){
   const added=next.note.slice((prev.note||'').length).replace(/^；/,'');
   if(added.trim())p.noteAppend=added.slice(0,300);
 }
 return p;
}
export function splitPatch(p){
 // Worker limits each entries/removeEntryIds array to 50.
 const core={...p};delete core.entries;delete core.removeEntryIds;
 const entries=Array.isArray(p.entries)?p.entries:[];
 const removed=Array.isArray(p.removeEntryIds)?p.removeEntryIds:[];
 const chunks=[];
 for(let i=0;i<entries.length;i+=50)chunks.push({entries:entries.slice(i,i+50)});
 for(let i=0;i<removed.length;i+=50)chunks.push({removeEntryIds:removed.slice(i,i+50)});
 if(Object.keys(core).length){if(chunks.length)Object.assign(chunks[0],core);else chunks.push(core);}
 return chunks;
}
export function makeEvent(date,payload,id){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!payload||!Object.keys(payload).length)throw Error('无效同步事件');
 const eventId=id||`zzqhph-${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
 if(!/^[A-Za-z0-9_.-]{6,110}$/.test(eventId))throw Error('无效事件ID');
 return {id:eventId,date,type:'day.patch',payload};
}
