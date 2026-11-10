import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
function extract(name){const start=html.indexOf(`function ${name}(`);assert.ok(start>=0,`${name} exists`);let brace=html.indexOf('{',start),depth=0;for(let i=brace;i<html.length;i++){if(html[i]==='{')depth++;else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1)}throw Error('unterminated function')}
const context={Date,Number,Object,Array,String,Set,Error,MAX_NODES:2000,MAX_LINKS:10000};
vm.createContext(context);vm.runInContext(extract('validateIncoming'),context);
const root={id:'root',text:'テーマ',x:320,y:340,parent:null},child={id:'a',text:'枝',notes:'メモ',x:600,y:340,parent:'root'};
const valid={version:16,nodes:{root, a:child},links:[{from:'root',to:'a',kind:'suggestion'}],selected:'a',panX:0,panY:0,scale:1,meta:{rainbow:false}};
const cleaned=context.validateIncoming(valid);assert.equal(cleaned.nodes.a.text,'枝');assert.notEqual(cleaned,valid);assert.equal(Object.getPrototypeOf(cleaned.nodes),null);
assert.throws(()=>context.validateIncoming({...valid,nodes:{root,a:{...child,parent:'b'},b:{...child,id:'b',parent:'a'}}}),/循環/);
assert.throws(()=>context.validateIncoming({...valid,nodes:{root,a:{...child,text:'x'.repeat(2001)}}}),/文字列/);
assert.throws(()=>context.validateIncoming({...valid,nodes:{root,a:{...child,x:Infinity}}}),/座標/);
assert.throws(()=>context.validateIncoming({...valid,links:Array.from({length:10001},()=>({from:'root',to:'a'}))}),/リンク数/);
const polluted=JSON.parse('{"nodes":{"root":{"id":"root","text":"x","x":0,"y":0,"parent":null},"__proto__":{"id":"__proto__","text":"x","x":0,"y":0,"parent":"root"}},"links":[]}');assert.throws(()=>context.validateIncoming(polluted));
console.log('PASS mindmap security validation');
