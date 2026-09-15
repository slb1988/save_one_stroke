/* Parametric geometry recipe, not a physics type or a complete level. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'workshop/seat',kind:'prefab',
 schema:{type:'object',additionalProperties:false,required:['legs'],properties:{legs:{enum:['none','left','both']}}},
 validate(d,p,V){V.object(d,['legs'],['legs'],p);if(!['none','left','both'].includes(d.legs))V.fail(p+'.legs','只能是 none、left、both');},
 expand(d){const parts=[{x:0,y:0,w:184,h:18,kind:'seat'}];if(d.legs!=='none')parts.push({x:13,y:14,w:14,h:135,kind:'leg'});if(d.legs==='both')parts.push({x:155,y:14,w:14,h:135,kind:'leg'});return [{id:'wood',type:'core/chair',params:parts}];}
});
})(globalThis);
