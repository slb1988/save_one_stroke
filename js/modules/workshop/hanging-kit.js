/* A reusable temporary loading dock + wall pins, with local named references. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports ? require('../../content.js') : root.RescueContent;
C.register({type:'workshop/hanging-kit',kind:'prefab',
 schema:{type:'object',additionalProperties:false,required:['span','floorY','removeAt'],properties:{span:{type:'number',minimum:160,maximum:250},floorY:{type:'number',minimum:150,maximum:300},removeAt:{type:'number',minimum:750,maximum:4000}}},
 validate(d,p,V){V.object(d,['span','floorY','removeAt'],['span','floorY','removeAt'],p);V.number(d.span,160,250,p+'.span');V.number(d.floorY,150,300,p+'.floorY');V.number(d.removeAt,750,4000,p+'.removeAt');},
 expand:d=>[
  {id:'dock',type:'core/terrain',params:{x:0,y:d.floorY,w:d.span,h:36}},
  {id:'pins',type:'core/anchors',params:[{x:0,y:0,radius:10,label:'左挂点'},{x:d.span,y:0,radius:10,label:'右挂点'}]},
  {id:'departure',type:'core/temporary-terrain',params:[{target:'dock',removeAt:d.removeAt,label:'装卸踏板'}]}
 ]
});
})(globalThis);
