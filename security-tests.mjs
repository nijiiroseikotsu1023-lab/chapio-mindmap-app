import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
function extract(name){const start=html.indexOf(`function ${name}(`);assert.ok(start>=0,`${name} exists`);let brace=html.indexOf('{',start),depth=0;for(let i=brace;i<html.length;i++){if(html[i]==='{')depth++;else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1)}throw Error('unterminated function')}
const context={Date,Number,Object,Array,String,Set,Error,TextEncoder,console:{warn(){}},MAX_NODES:2000,MAX_LINKS:10000,MAX_FILE_BYTES:2*1024*1024,MAX_TEXT:2000,KEY:'chapio-mindmap-v16',RECOVERY_KEY:'chapio-mindmap-v16-recovery'};
vm.createContext(context);vm.runInContext(extract('defaultState')+'\n'+extract('validateIncoming')+'\n'+extract('serializeState')+'\n'+extract('parseStoredState')+'\n'+extract('resolveStoredState')+'\n'+extract('storageKeyForSave')+'\n'+extract('snapshotState')+'\n'+extract('commitState')+'\n'+extract('commitViewport')+'\n'+extract('persistGesture')+'\n'+extract('descendantIds')+'\n'+extract('voiceDraftText'),context);
const root={id:'root',text:'テーマ',x:320,y:340,parent:null},child={id:'a',text:'枝',notes:'メモ',x:600,y:340,parent:'root'};
const valid={version:16,nodes:{root, a:child},links:[{from:'root',to:'a',kind:'suggestion'}],selected:'a',panX:0,panY:0,scale:1,meta:{rainbow:false}};
const cleaned=context.validateIncoming(valid);assert.equal(cleaned.nodes.a.text,'枝');assert.notEqual(cleaned,valid);assert.equal(Object.getPrototypeOf(cleaned.nodes),null);
assert.throws(()=>context.validateIncoming({...valid,nodes:{root,a:{...child,parent:'b'},b:{...child,id:'b',parent:'a'}}}),/循環/);
assert.throws(()=>context.validateIncoming({...valid,nodes:{root,a:{...child,text:'x'.repeat(2001)}}}),/文字列/);
assert.throws(()=>context.validateIncoming({...valid,nodes:{root,a:{...child,x:Infinity}}}),/座標/);
assert.throws(()=>context.validateIncoming({...valid,links:Array.from({length:10001},()=>({from:'root',to:'a'}))}),/リンク数/);
const polluted=JSON.parse('{"nodes":{"root":{"id":"root","text":"x","x":0,"y":0,"parent":null},"__proto__":{"id":"__proto__","text":"x","x":0,"y":0,"parent":"root"}},"links":[]}');assert.throws(()=>context.validateIncoming(polluted));
const roundTrip=context.parseStoredState(context.serializeState(cleaned));assert.equal(roundTrip.nodes.a.text,'枝');assert.equal(roundTrip.links.length,1);
assert.equal(context.storageKeyForSave(false),'chapio-mindmap-v16');assert.equal(context.storageKeyForSave(true),'chapio-mindmap-v16-recovery');
assert.throws(()=>context.parseStoredState('{broken json'),/JSON/);
assert.throws(()=>context.serializeState({...cleaned,nodes:{root:{...root,text:'x'.repeat(2*1024*1024)}}}),/2MB/);
const corruptPrimary='{broken json',recoveryRaw=context.serializeState(cleaned);assert.throws(()=>context.parseStoredState(corruptPrimary));assert.equal(context.parseStoredState(recoveryRaw).nodes.a.text,'枝');assert.equal(corruptPrimary,'{broken json');
const recovered=context.resolveStoredState(corruptPrimary,recoveryRaw);assert.equal(recovered.recoveryMode,true);assert.equal(recovered.state.nodes.a.text,'枝');const restarted=context.resolveStoredState(corruptPrimary,context.serializeState(recovered.state));assert.equal(restarted.recoveryMode,true);assert.equal(restarted.state.nodes.a.text,'枝');assert.equal(context.storageKeyForSave(restarted.recoveryMode),'chapio-mindmap-v16-recovery');assert.equal(corruptPrimary,'{broken json');
const recoveryOnly=context.resolveStoredState(null,recoveryRaw);assert.equal(recoveryOnly.recoveryMode,true);assert.equal(recoveryOnly.state.nodes.a.text,'枝');
const deepNodes={root};let parent='root';for(let i=0;i<1900;i++){const id='n'+i;deepNodes[id]={id,text:id,x:0,y:i,parent};parent=id}const descendants=context.descendantIds(deepNodes,'root');assert.equal(descendants.length,1900);assert.equal(new Set(descendants).size,1900);
context.state=context.parseStoredState(recoveryRaw);context.history=[];context.save=()=>false;assert.equal(context.commitState(s=>{s.nodes.a.text='失敗'}),false);assert.equal(context.state.nodes.a.text,'枝');assert.equal(context.history.length,0);context.save=()=>true;assert.equal(context.commitState(s=>{s.nodes.a.text='成功'}),true);assert.equal(context.state.nodes.a.text,'成功');assert.equal(context.history.length,1);
assert.equal(context.voiceDraftText('新しい枝','  認識結果  '),'認識結果');assert.equal(context.voiceDraftText('既存','追記'),'既存 追記');assert.equal(context.voiceDraftText('既存','   '),'');assert.equal(context.voiceDraftText('既存','x'.repeat(3000)).length,2000);
context.state={panX:12,panY:34,scale:1};let renders=0;context.render=()=>{renders++};context.save=()=>false;assert.equal(context.commitViewport({panX:100,panY:200,scale:.5}),false);assert.deepEqual({panX:context.state.panX,panY:context.state.panY,scale:context.state.scale},{panX:12,panY:34,scale:1});assert.equal(renders,2);context.save=()=>true;assert.equal(context.commitViewport({panX:100,panY:200,scale:.5}),true);assert.deepEqual({panX:context.state.panX,panY:context.state.panY,scale:context.state.scale},{panX:100,panY:200,scale:.5});
const gestureBefore=context.serializeState(cleaned);context.state=context.parseStoredState(gestureBefore);context.state.scale=2;context.save=()=>false;assert.equal(context.persistGesture(gestureBefore),false);assert.equal(context.state.scale,1);context.state.scale=2;context.save=()=>true;assert.equal(context.persistGesture(gestureBefore),true);assert.equal(context.state.scale,2);assert.match(html,/\.iconbtn\{width:44px;height:44px\}/);
console.log('PASS mindmap security validation');
