import type {CSSMockupProps} from './CSSMockup.types';
export const CSSMockup=(props:CSSMockupProps)=>{
 const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const classes=[...(props.selector??'').matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match=>match[1]).join(' ');
 const css=(props.css??'').replace(/</g,'\\3c ');
 const srcDoc=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>${css}</style></head><body><div class="${escape(classes)}"><h3>Sample heading</h3><p>Example content for ${escape(props.selector??'this style')}.</p><button type="button">Example action</button></div></body></html>`;
 return <iframe title="CSS preview" sandbox="" srcDoc={srcDoc} className={`css-mockup ${props.className??''}`} style={{width:'100%',height:'20rem',border:0}}/>;
};
