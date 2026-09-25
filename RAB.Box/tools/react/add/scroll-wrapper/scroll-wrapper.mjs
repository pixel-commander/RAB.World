export const run=async({options,helpers})=>{
  const child=await helpers.runTool({key:'react/wrap/element',options:{component:options.component,file:options.file,path:options.path,seat_id:options.seat_id,data_area:options.area,element:options.element,wrapper_tag:'div',class_name:'scroll-y',new_seat_id:options.new_seat_id}});
  return {status:child.result.status,type:'scroll-wrapper',file:child.result.file,component:child.result.component,target:child.result.target,changed:child.result.changed,provided:{seats:{file:child.result.file}}};
};
