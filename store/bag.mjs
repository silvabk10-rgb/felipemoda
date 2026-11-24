import {canBuy} from './core.mjs';
export const keys={bag:'felipe-moda-sacola-v2',old:'casa-basica-cart-v1',favorites:'felipe-moda-favoritos-v1',recent:'felipe-moda-vistos-v1',checkout:'felipe-moda-checkout-v1'};
const memory=new Map();
export function load(key,fallback,session=false){
  try{const v=(session?sessionStorage:localStorage).getItem(key);return v===null ? memory.get(key)??fallback : JSON.parse(v);} catch {return memory.get(key)??fallback;}
}
export function save(key,value,session=false){
  memory.set(key,value);
  try{(session?sessionStorage:localStorage).setItem(key,JSON.stringify(value));return true;}catch{return false;}
}
export function readArray(key){const v=load(key,[]);return Array.isArray(v)?v:[];}
export const bagRows=()=>readArray(keys.bag).filter(r=>r&&typeof r.product==='string'&&typeof r.variant==='string'&&Number.isSafeInteger(r.quantity)&&r.quantity>0);
export async function migrateBag(products){
  if(load(keys.bag,null)!==null)return;
  const old=readArray(keys.old);
  if(!old.length)return;
  let legacy=[];
  try{const response=await fetch('/store/legacy.json');if(response.ok)legacy=await response.json();}catch{/* Remain recoverable from the original key. */}
  const known=new Map(legacy.map(p=>[p.id,p]));
  const rows=[];
  for(const r of old){
    if(!r || !Number.isSafeInteger(r.quantity)||r.quantity<1||r.product==null||r.variant==null)continue;
    const product=String(r.product),variant=String(r.variant);
    const p=products.get(product) || known.get(product);
    const v=p?.variants.find(v=>v.id===variant);
    const existing=rows.find(item=>item.product===product&&item.variant===variant);
    if(existing){existing.quantity=Math.min(9999,existing.quantity+r.quantity);continue;}
    rows.push({product,variant,quantity:Math.min(9999,r.quantity),name:p?.name||product,label:v?.label||variant});
  }
  if(load(keys.bag,null)===null)save(keys.bag,rows);
}
export function cartLines(products){
  return bagRows().map(row=>{const p=products.get(row.product),v=p?.variants.find(v=>v.id===row.variant);
    return {row,p,v,ok:canBuy(v)&&row.quantity<=Math.min(v.stock,99)};});
}
