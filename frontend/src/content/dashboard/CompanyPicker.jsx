import React, {useEffect, useId, useRef, useState} from 'react';

const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

export function CompanyPicker({companies,value,onChange}){
 const id=useId();const input=useRef(null);const list=useRef(null);
 const [open,setOpen]=useState(false);const [search,setSearch]=useState('');const [active,setActive]=useState(0);
 const label=value==='all'?'Todas as empresas':value;
 const matches=['all',...companies].filter(c=>normalize(c==='all'?'Todas as empresas':c).includes(normalize(search.trim())));
 function choose(company){onChange(company);setOpen(false);setSearch('');input.current?.focus();}
 useEffect(()=>{
  if(!open||!list.current)return;
  const panel=list.current;
  function position(){
   const rect=input.current.getBoundingClientRect();
   const below=window.innerHeight-rect.bottom-14;
   const above=rect.top-14;
   const upwards=below<160&&above>below;
   panel.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-rect.width-8))+'px';
   panel.style.width=Math.min(rect.width,window.innerWidth-16)+'px';
   panel.style.maxHeight=Math.max(60,Math.min(300,upwards?above:below))+'px';
   panel.style.top=upwards?'auto':rect.bottom+6+'px';
   panel.style.bottom=upwards?window.innerHeight-rect.top+6+'px':'auto';
  }
  position();
  panel.showPopover();
  window.addEventListener('resize',position);
  window.addEventListener('scroll',position,true);
  return ()=>{
   window.removeEventListener('resize',position);
   window.removeEventListener('scroll',position,true);
   if(panel.matches(':popover-open'))panel.hidePopover();
  };
 },[open]);
 useEffect(()=>{if(open)list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});},[active,open]);
 return <div className="fiscal-company-control fiscal-company-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setOpen(false);setSearch('');}}}>
  <label htmlFor={id}>Empresa</label>
  <div className="fiscal-company-search">
   <input ref={input} id={id} role="combobox" aria-label="Buscar empresa por nome ou código" aria-autocomplete="list" aria-expanded={open} aria-controls={id+'-list'} aria-activedescendant={open&&matches[active]?id+'-option-'+active:undefined} autoComplete="off" value={open?search:label} placeholder={label} onFocus={()=>{setSearch('');setActive(0);setOpen(true);}} onClick={()=>{if(!open){setSearch('');setActive(0);setOpen(true);}}} onChange={event=>{setSearch(event.target.value);setActive(0);setOpen(true);}} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();setOpen(false);setSearch('');}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open){setSearch('');setOpen(true);setActive(0);}else setActive(i=>Math.max(0,Math.min(matches.length-1,i+(event.key==='ArrowDown'?1:-1))));}
    if(event.key==='Enter'&&open){event.preventDefault();if(matches[active])choose(matches[active]);}
   }}/>
   {open&&<div className="fiscal-company-options" popover="manual" ref={list} id={id+'-list'} role="listbox" aria-label="Empresas encontradas">
    {matches.length?matches.map((company,index)=><div id={id+'-option-'+index} key={company} role="option" aria-selected={index===active} onMouseEnter={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(company)}>{company==='all'?'Todas as empresas':company}</div>):<div role="status" className="fiscal-company-empty">Nenhuma empresa encontrada</div>}
   </div>}
  </div>
 </div>;
}
