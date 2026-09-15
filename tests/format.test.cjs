'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const Ajv = require('ajv/dist/2020');
const Format = require('../js/level-format.js');
const Library = require('../js/level-library.js');
const {levels} = require('../js/levels.js');
const example = require('../docs/examples/level.json');
const ajv=new Ajv({strict:false,allErrors:true});
const schema=ajv.compile(require('../schemas/level-v1.schema.json'));
const schema2=ajv.compile(require('../schemas/level-v2.schema.json'));
const copy = data => JSON.parse(JSON.stringify(data));
function storage() {
  const data = new Map();
  return {data,getItem:key => data.get(key) ?? null,setItem:(key,value) => data.set(key,value)};
}
function cli(...args) { return spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/validate-level.cjs'),...args,'--json'],{encoding:'utf8'}); }

test('内置 JSON 与文档完整示例同时满足各自版本 Schema 和运行时格式', () => {
  for(const level of [...levels,example]) { const check=level.version===2 ? schema2 : schema; assert.equal(check(level),true,JSON.stringify(check.errors)); assert.equal(Format.validateLevel(level),level); }
});
test('Markdown 中可复制的完整例子与实际文件一致', () => {
  const doc = fs.readFileSync(path.join(__dirname,'../docs/LEVEL_FORMAT.md'),'utf8');
  const block = doc.match(/```json\n([\s\S]*?)\n```/)[1];
  assert.deepEqual(Format.parseLevel(block),example);
  assert.match(doc,/格式合法.*可解/); assert.match(doc,/可直接给 LLM 的生成提示/);
});
test('坏结构、未知脚本、错误版本、数值类型、过长文字均被拒绝', () => {
  const samples = [
    {...example,version:2}, {...example,onWin:'alert(1)'}, {...example,ink:'345'},
    {...example,title:'x'.repeat(41)}, {...example,load:{x:344,mass:16,eval:'x'}},
    {...example,load:{x:344,mass:0}}, {...example,chair:[{...example.chair[0],kind:'rope'}]},
    {...example,forces:[{start:0,end:1000,fx:1,at:{x:344,y:214},label:'超限'}]},
    {...example,load:{x:344,mass:16,cat:true}}, {...example,forbidden:null},
    JSON.parse(JSON.stringify(example).replace('"version":1','"version":1,"__proto__":{"polluted":true}'))
  ];
  for (const value of samples) { assert.equal(schema(value),false); assert.throws(() => Format.validateLevel(value)); }
  assert.equal({}.polluted,undefined);
});
test('运行时补足跨字段约束；文件上限按 UTF-8 字节且坏 JSON 友好报错', () => {
  assert.throws(() => Format.validateLevel({...example,gold:400}),/gold/);
  assert.throws(() => Format.validateLevel({...example,chair:[{...example.chair[0],x:710}]}),/边界/);
  assert.throws(() => Format.validateLevel({...example,gap:[500,200]}),/左边界/);
  assert.throws(() => Format.validateLevel({...example,forces:[{start:1000,end:500,fx:.01,at:{x:344,y:170},label:'时间错了'}]}),/start/);
  assert.throws(() => Format.parseLevel('{"version":1,}'),/JSON 语法错误/);
  assert.throws(() => Format.parseLevel('你'.repeat(22000)),/64 KiB/);
  assert.deepEqual(Format.parseLevel('\uFEFF'+JSON.stringify(example)),example);
  assert.deepEqual(Format.parseLevel(Format.serializeLevel(example)),example);
});
test('导入本地库：相同 id 不覆盖、重复内容去重、刷新恢复，内置成绩隔离', () => {
  const store = storage(); store.setItem('save-one-stroke:v1','original-built-in-scores');
  let id=0; const library = Library.createLibrary(store,()=>`key-${++id}`);
  const first = library.add({...example,id:1}), second = library.add({...example,id:1,title:'另一个文件'});
  assert.notEqual(first.key,second.key); assert.equal(library.list().length,2);
  assert.equal(library.add({...example,id:1}).key,first.key); assert.equal(library.list().length,2);
  library.record(first.key,{stars:3,ink:306});
  const restored = Library.createLibrary(store);
  assert.deepEqual(restored.get(first.key).record,{stars:3,ink:306});
  assert.equal(restored.get(second.key).record,undefined);
  assert.equal(store.getItem('save-one-stroke:v1'),'original-built-in-scores');
});
test('本地保存配额失败和坏格式是原子失败，不更改已有存档', () => {
  const store = storage(), library = Library.createLibrary(store,()=> 'existing');
  library.add(example); const before=store.getItem(Library.KEY);
  assert.throws(() => library.add({...example,version:9})); assert.equal(store.getItem(Library.KEY),before);
  store.setItem=()=>{throw Error('quota')};
  assert.throws(() => library.add({...example,title:'新版本'}),/保存失败/);
  assert.equal(library.list().length,1); assert.equal(store.getItem(Library.KEY),before);
  const damaged=storage(); damaged.setItem(Library.KEY,'{broken');
  const blocked=Library.createLibrary(damaged); assert.ok(blocked.warning);
  assert.throws(()=>blocked.add(example)); assert.equal(damaged.getItem(Library.KEY),'{broken');
});
test('本地库限12关，显式移除后才可添加；重复文件不占新位置', () => {
  let id=0; const library=Library.createLibrary(storage(),()=>`item-${++id}`);
  for(let i=0;i<12;i++) library.add({...example,id:i+1});
  assert.throws(()=>library.add({...example,id:13}),/最多保存 12/);
  assert.equal(library.add({...example,id:1}).duplicate,true);
  library.remove(library.list()[0].key); library.add({...example,id:13}); assert.equal(library.list().length,12);
});
test('离线 CLI 明确区分格式通过与同引擎解/失败例验证', () => {
  const file=path.join(__dirname,'../docs/examples/level.json'), cases=path.join(__dirname,'../docs/examples/level.cases.json');
  let result=cli(file); assert.equal(result.status,0,result.stderr); assert.equal(JSON.parse(result.stdout).verifiedSolvable,false);
  result=cli(file,'--cases',cases); assert.equal(result.status,0,result.stdout);
  const output=JSON.parse(result.stdout); assert.equal(output.verifiedSolvable,true); assert.ok(output.cases.every(c=>c.passed && c.strokeValid));
  result=cli(path.join(__dirname,'../package.json')); assert.equal(result.status,1); assert.equal(JSON.parse(result.stdout).formatValid,false);
});
test('非法画法不能冒充离线“失败例”证明', () => {
  const {verifyCases}=require('../scripts/validate-level.cjs');
  const pack=copy(require('../docs/examples/level.cases.json')); pack.cases[1].stroke=[[344,265],[344,268]];
  const result=verifyCases(example,JSON.stringify(pack));
  assert.equal(result.verifiedSolvable,false); assert.equal(result.cases[1].passed,false); assert.equal(result.cases[1].strokeValid,false);
});
