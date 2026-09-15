'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Format = require('../js/level-format.js');
function readBounded(filename, max) {
  const stat = fs.statSync(filename);
  if (!stat.isFile() || stat.size > max) throw new Error(`文件必须是普通文件且不超过 ${max} 字节：${filename}`);
  return fs.readFileSync(filename, 'utf8');
}
function verifyCases(level, source) {
  const pack = JSON.parse(source);
  if (pack?.format !== 'save-one-stroke-cases' || pack.version !== 1 || Object.keys(pack).some(key => !['format','version','cases'].includes(key)) || !Array.isArray(pack.cases) || pack.cases.length < 2 || pack.cases.length > 20) throw new Error('cases 文件需要版本 1、2–20 个测试，至少各一个 success 和 failure');
  if (!['success','failure'].every(expected => pack.cases.some(c => c.expected === expected))) throw new Error('cases 必须同时提供成功样例和失败样例');
  const Physics = require('../js/physics.js');
  const results = pack.cases.map((sample, i) => {
    if (!sample || Object.keys(sample).some(key => !['name','expected','stroke'].includes(key)) || typeof sample.name !== 'string' || !sample.name.trim() || sample.name.length > 100 || !['success','failure'].includes(sample.expected) || !Array.isArray(sample.stroke) || sample.stroke.length < 2 || sample.stroke.length > 2000 || !sample.stroke.every(p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && Number.isFinite(v)))) throw new Error(`cases[${i}] 的名称、expected 或笔画坐标无效`);
    const result = Physics.simulate(level, sample.stroke);
    const passed = result.valid === true && result.success === (sample.expected === 'success');
    return {name:sample.name,expected:sample.expected,passed,strokeValid:result.valid,success:result.success,code:result.code,ink:result.ink,maxTilt:result.maxTilt,reason:result.reason};
  });
  return {verifiedSolvable:results.every(r => r.passed),cases:results};
}
function main(argv = process.argv.slice(2)) {
  const machine = argv.includes('--json');
  let file, casesFile, output;
  try {
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--json') continue;
      if (argv[i] === '--help') { console.log('用法：npm run level:validate -- <level.json> [--cases <cases.json>] [--json]\n无 cases 只检查格式，不声明可解；cases 必须包含至少一个合法成功画法和一个合法失败画法。'); return 0; }
      if (argv[i] === '--cases' && argv[i + 1] && !argv[i + 1].startsWith('--')) { casesFile = argv[++i]; continue; }
      if (!argv[i].startsWith('-') && !file) { file = argv[i]; continue; }
      throw new Error(`未知或缺值参数：${argv[i]}`);
    }
    if (!file) throw new Error('请提供关卡 JSON 文件；用 --help 查看用法');
    const level = Format.parseLevel(readBounded(file, Format.MAX_FILE_BYTES));
    output = {file:path.resolve(file),formatValid:true,version:level.version,id:level.id,title:level.title,verifiedSolvable:false};
    if (casesFile) {
      Object.assign(output,verifyCases(level,readBounded(casesFile,256 * 1024)));
      output.note = output.verifiedSolvable ? '给定的合法解与合法失败例均已由游戏同一物理引擎验证；这不是自动穷举或难度保证。' : '样例未全部通过，不能宣称已验证可解。';
    } else output.note = '仅格式合法；未提供试坐样例，尚未验证可解。';
  } catch (error) { output = {...output,formatValid:output?.formatValid ?? false,verifiedSolvable:false,error:error.message}; }
  if (machine) console.log(JSON.stringify(output,null,2));
  else {
    console.log(output.error || `${output.title}：格式通过；${output.note}`);
    for (const result of output.cases || []) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}: ${result.code} (${result.ink ?? '?'} 墨水)`);
  }
  return output.error || !output.formatValid || (casesFile && !output.verifiedSolvable) ? 1 : 0;
}
if (require.main === module) process.exitCode = main();
module.exports = {main,verifyCases,readBounded};
