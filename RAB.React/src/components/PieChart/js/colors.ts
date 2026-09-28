export const chartColor=(name:string,index:number,colors?:string[]|Record<string,string>)=>{
 const defaults=['#67b7dc','#a48be0','#67d5b5','#efb866','#e886a8','#7e9fe8','#b6ca70','#d99368'];
 return (Array.isArray(colors)?colors[index%colors.length]:colors?.[name])??defaults[index%defaults.length];
};
