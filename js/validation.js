/* Inert JSON primitives shared by trusted content modules. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RescueValidation=factory();})(globalThis,function(){
'use strict';
  const MAX_FILE_BYTES = 64 * 1024;
  const byteLength = text => new TextEncoder().encode(text).length;
  const fail = (path, message) => { throw new Error(`${path.length > 140 ? path.slice(0,140) + '…' : path}：${message}`); };
  function object(value, allowed, required, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, '需要 JSON 对象');
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key}`, '不支持的字段（不允许脚本或自定义回调）');
    for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, '缺少必填字段');
  }
  function number(value, min, max, path, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(path, `需要 ${min}–${max} 的${integer ? '整数' : '有限数字'}`);
  }
  function text(value, max, path) {
    if (typeof value !== 'string' || !value.trim() || [...value].length > max) fail(path, `需要 1–${max} 字的非空纯文本`);
  }
  function array(value, min, max, path, item) {
    if (!Array.isArray(value) || value.length < min || value.length > max) fail(path, `需要 ${min}–${max} 项数组`);
    value.forEach((entry, i) => item(entry, `${path}[${i}]`));
  }
  function point(value, path) {
    object(value, ['x','y'], ['x','y'], path);
    number(value.x, 0, 720, `${path}.x`); number(value.y, 0, 480, `${path}.y`);
  }
  function rect(value, path, extra = []) {
    object(value, ['x','y','w','h',...extra], ['x','y','w','h'], path);
    number(value.x, 0, 719, `${path}.x`); number(value.y, 0, 480, `${path}.y`);
    number(value.w, 1, 720, `${path}.w`); number(value.h, 1, 600, `${path}.h`);
    if (value.x + value.w > 720 || value.y + value.h > 600) fail(path, '矩形右边界不得超过 720，下边界不得超过 600');
  }

return {MAX_FILE_BYTES,byteLength,fail,object,number,text,array,point,rect};
});
