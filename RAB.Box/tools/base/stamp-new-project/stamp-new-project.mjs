import { runProjectStamp } from '../../_stamp-engines.mjs';

export const run = async ({ options, context, helpers, tool }) => {
  if(options.add_ui_kit===true&&options.type!=='react')throw Object.assign(new Error('The UI kit is available only for React projects.'),{code:'BAD_REQUEST'});
  if(options.type==='magic-box')return runProjectStamp({options,context,tool});
  const key=`new-${options.type}-project`;
  const child=await helpers.getTool(key);
  const supplied={name:options.name,folder:options.folder};
  if(options.custom_toolkit_path!==undefined)supplied.custom_toolkit_path=options.custom_toolkit_path;
  if(options.add_ui_kit!==undefined){
    if(child.settings.some(field=>field.name==='add_ui_kit'))supplied.add_ui_kit=options.add_ui_kit;
    else if(options.add_ui_kit===true)throw Object.assign(new Error('The selected React project stamp does not support UI-kit seeding.'),{code:'UI_KIT_UNAVAILABLE'});
  }
  const bound=helpers.bindSettings(child,supplied);
  if(bound.missing.length)return {status:'input-required',delegate:key,known:supplied,missing:bound.missing};
  const result=await helpers.runTool({key,options:bound.options,context});
  const childResult={tool:result.tool,options:result.options,result:result.result,execution:result.execution,tracking_file:result.tracking_file};
  return {status:'delegated',delegate:key,known:supplied,child:childResult};
};
