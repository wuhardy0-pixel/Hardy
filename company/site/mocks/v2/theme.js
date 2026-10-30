// The style switch: "Cozy" (warm clay) or "Space" (night sky). Remembered on this device.
(function(){
  const KEY="hw-theme", root=document.documentElement;
  let t="cozy";try{t=localStorage.getItem(KEY)||"cozy"}catch(e){}
  root.dataset.theme=t;                                  // set before the page paints, so it never flashes
  const ICONS={cozy:'<svg viewBox="0 0 24 24"><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/></svg>',
               space:'<svg viewBox="0 0 24 24"><path d="M12 2c3 2 5 6 5 10l-2 5H9l-2-5c0-4 2-8 5-10z"/><circle cx="12" cy="10" r="2"/><path d="M9 17l-2 4M15 17l2 4"/></svg>'};
  function set(v){root.classList.add("theme-anim");root.dataset.theme=v;try{localStorage.setItem(KEY,v)}catch(e){}
    document.querySelectorAll(".theme-switch button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.t===v));
    setTimeout(()=>root.classList.remove("theme-anim"),600);}
  document.addEventListener("DOMContentLoaded",()=>{
    const nav=document.querySelector(".site-head nav");if(!nav)return;
    const sw=document.createElement("div");sw.className="theme-switch";sw.setAttribute("role","group");sw.setAttribute("aria-label","Page style");
    sw.innerHTML=["cozy","space"].map(v=>`<button data-t="${v}" aria-pressed="${v===root.dataset.theme}" title="${v==="cozy"?"Cozy style":"Space style"}">${ICONS[v]}<span>${v==="cozy"?"Cozy":"Space"}</span></button>`).join("");
    sw.onclick=e=>{const b=e.target.closest("button");if(b)set(b.dataset.t);};
    nav.prepend(sw);});
})();
