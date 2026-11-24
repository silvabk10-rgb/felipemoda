const menu=document.querySelector('#menu-fm');
const opener=document.querySelector('[data-open-menu]');
opener?.addEventListener('click',()=>menu.showModal());
menu?.querySelector('[data-close-menu]').addEventListener('click',()=>menu.close());
menu?.addEventListener('click',event=>{if(event.target===menu && event.clientX>menu.getBoundingClientRect().right)menu.close()});
menu?.addEventListener('close',()=>opener.focus());
const hero=document.querySelector('[data-hero]');
if(hero){
  const panels=[...hero.querySelectorAll('[data-slide]')];
  const dots=[...hero.querySelectorAll('[data-goto]')];
  let active=0;
  function select(i){
    active=(i+panels.length)%panels.length;
    panels.forEach((panel,n)=>{panel.hidden=active!==n;dots[n].setAttribute('aria-pressed',String(n===active))});
    hero.querySelector('[data-slide-status]').textContent='Campanha '+(active+1)+' de '+panels.length;
  }
  hero.querySelector('[data-next]').addEventListener('click',()=>select(active+1));
  hero.querySelector('[data-prev]').addEventListener('click',()=>select(active-1));
  dots.forEach((dot,n)=>dot.addEventListener('click',()=>select(n)));
  hero.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();select(active+(e.key==='ArrowRight'?1:-1));dots[active].focus()}});
  let origin;
  hero.addEventListener('touchstart',e=>{origin=[e.touches[0].clientX,e.touches[0].clientY]},{passive:true});
  hero.addEventListener('touchend',e=>{if(!origin)return;const dx=e.changedTouches[0].clientX-origin[0],dy=e.changedTouches[0].clientY-origin[1];origin=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.6)select(active+(dx<0?1:-1))},{passive:true});
}
