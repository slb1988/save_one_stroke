'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
function walk(dir,accept,prefix='') {
  return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    const file=prefix+e.name;
    // No symlinks, hidden files or arbitrary paths in the executable allowlist.
    if(e.isSymbolicLink()||e.name.startsWith('.'))return [];
    if(e.isDirectory())return walk(path.join(dir,e.name),accept,file+'/');
    return e.isFile()&&accept(file)?[file]:[];
  });
}
function discover(root=ROOT){return {format:'save-one-stroke-manifest',version:2,
 files:walk(path.join(root,'levels'),f=>/^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.json$/.test(f)&&!/(?:^|\/)(manifest|legacy\.progression)\.json$/.test(f)),
 legacyProgression:JSON.parse(fs.readFileSync(path.join(root,'levels/legacy.progression.json'),'utf8'))
};}
function modules(root=ROOT){return {format:'save-one-stroke-modules',version:1,files:walk(path.join(root,'js/modules'),f=>/^[a-z0-9-]+\/[a-z0-9-]+\.js$/.test(f))};}
function build(){
 const artifacts=[['levels/manifest.json',discover()],['js/modules/manifest.json',modules()]];
 const C=require('../js/content.js'),legacy=JSON.parse(fs.readFileSync(path.join(ROOT,'schemas/level-v2.schema.json'),'utf8'));
 const v3={...legacy,$id:'https://save-one-stroke.invalid/level-v3.schema.json',title:'救一笔！v3 模块化场景',description:'可信模块组成的惰性 JSON；跨字段约束仍由共享运行时验证。',$comment:'自动生成：npm run content:build。不要手改。',properties:{...legacy.properties},required:legacy.required.filter(k=>!['chair','terrain','mechanics'].includes(k)).concat(['scene','progression'])};
 for(const key of ['chair','terrain','mechanics','forces','forbidden','forbiddenZones'])delete v3.properties[key];
 Object.assign(v3.properties,{version:{const:3},id:{type:'string',maxLength:100,pattern:'^[a-z0-9-]+/[a-z0-9-]+$'},chapter:{type:'string',minLength:1,maxLength:40,pattern:'\\S'},
  progression:{type:'object',additionalProperties:false,required:['groupOrder','order','difficulty'],properties:{groupOrder:{type:'number',minimum:0,maximum:99999},order:{type:'number',minimum:0,maximum:99999},difficulty:{enum:['easy','medium','hard']}}},
  drawArea:{type:'object',additionalProperties:false,properties:{drawTop:{type:'number',minimum:40,maximum:400},drawBottom:{type:'number',minimum:100,maximum:465}}},
  scene:{type:'array',minItems:1,maxItems:80,items:{oneOf:C.list().map(d=>({type:'object',additionalProperties:false,required:['id','type','params'],properties:{id:{type:'string',pattern:'^[a-z0-9-]{1,60}$'},type:{const:d.type},params:d.schema,at:{$ref:'#/$defs/point'}}}))}}
 });
 artifacts.push(['schemas/level-v3.schema.json',v3]);
 const check=process.argv.includes('--check');let mismatch=false;
 for(const [file,data] of artifacts){const text=JSON.stringify(data,null,2)+'\n',dest=path.join(ROOT,file);if(check){if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8')!==text){console.error(`Out of date: ${file}`);mismatch=true;}}else fs.writeFileSync(dest,text);}
 if(mismatch)process.exitCode=1;
 else console.log(`${check?'Checked':'Generated'} ${artifacts.map(a=>a[0]).join(', ')}`);
}
module.exports={ROOT,discover,modules,walk};
if(require.main===module)build();
