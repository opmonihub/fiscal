export function readXmlDetails(text){
 if(!text)return null;
 const xml=new DOMParser().parseFromString(text,'application/xml');
 const tag=n=>(n.localName||n.nodeName||'').toLowerCase();
 if(xml.querySelector('parsererror'))return {error:'Não foi possível montar a ficha deste XML.'};
 const nodes=(node,names)=>{const wanted=names.map(n=>n.toLowerCase());return Array.from(node?.getElementsByTagName('*')||[]).filter(n=>wanted.includes(tag(n)));};
 const node=(parent,names)=>nodes(parent,names)[0];
 const val=(parent,names)=>nodes(parent,names).map(n=>n.children.length?'':n.textContent.trim()).find(Boolean)||'';
 const first=(...values)=>values.find(Boolean)||'';
 const main=node(xml,['infNFe','infCte','infNFSe','InfNfse','infDPS'])||xml.documentElement;
 const kind=tag(main)==='infnfe'?'NFE':tag(main)==='infcte'?'CTE':'NFSE';
 function date(v){if(!v)return '';const m=v.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);return m?`${m[3]}/${m[2]}/${m[1]}${m[4].startsWith('T')?' às '+m[4].slice(1,6):''}`:v;}
 function money(v){if(!v)return '';const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):v;}
 function id(v){return v.length===14?v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):v.length===11?v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'):v;}
 const pair=(label,value)=>value?{label,value}:null;
 const info=[pair('Número',val(main,['nNF','nCT','nNFSe','Numero'])),pair('Série',val(main,['serie'])),pair('Emissão',date(val(main,['dhEmi','dEmi','DataEmissao','dataEmissao']))),pair('Competência do serviço',date(val(main,['dCompet','Competencia','DataCompetencia']))),pair('Natureza da operação',val(main,['natOp'])),pair('Chave / identificador',main.getAttribute('Id')||val(main,['chNFe','chCTe']))].filter(Boolean);
 const parties=[];
 for(const [title,names] of (kind==='NFSE'?[['Prestador',['emit','PrestadorServico','Prestador','prest']],['Tomador',['toma','TomadorServico','Tomador','dest']]]:kind==='CTE'?[['Emitente',['emit']],['Remetente',['rem']],['Destinatário',['dest']],['Tomador informado',['toma4']]]:[['Emitente',['emit']],['Destinatário',['dest']]])){
  const candidates=nodes(main,names);const p=candidates.find(c=>val(c,['xNome','RazaoSocial']))||candidates[0];if(!p)continue;
  const address=node(p,['enderEmit','enderDest','end','Endereco','enderToma','enderReme']);
  const entries=[pair('Nome / razão social',val(p,['xNome','RazaoSocial','NomeRazaoSocial'])),pair('CPF / CNPJ',id(val(p,['CNPJ','CPF']))),pair('Inscrição',val(p,['IE','IM','InscricaoMunicipal'])),pair('Endereço',address?[val(address,['xLgr','Logradouro']),val(address,['nro','Numero']),val(address,['xBairro','Bairro'])].filter(Boolean).join(', '):''),pair('Município / UF',address?[val(address,['xMun','Municipio']),val(address,['UF'])].filter(Boolean).join(' / '):'')].filter(Boolean);
  if(entries.length)parties.push({title,entries});
 }
 const total=node(main,['ICMSTot'])||main;
 const values=(kind==='NFSE'?[['Valor do serviço',['vServ','ValorServicos']],['Valor líquido',['vLiq','ValorLiquidoNfse']],['ISS',['vISSQN','ValorIss']],['PIS',['vPis','ValorPis']],['COFINS',['vCofins','ValorCofins']]]:kind==='CTE'?[['Valor da prestação',['vTPrest']],['Valor a receber',['vRec']],['Valor da carga',['vCarga']]]:[['Total da nota',['vNF']],['Produtos',['vProd']],['Frete',['vFrete']],['Desconto',['vDesc']],['ICMS',['vICMS']],['IPI',['vIPI']]]).map(([label,names])=>pair(label,money(val(total,names)))).filter(Boolean);
 const service=first(val(main,['xDescServ','Discriminacao','DiscriminacaoServico']),val(main,['infCpl','xObs']));
 const items=nodes(main,['det']).map(d=>{const p=node(d,['prod']);if(!p)return null;return {numero:d.getAttribute('nItem')||'',descricao:val(p,['xProd']),codigo:val(p,['cProd']),quantidade:val(p,['qCom']),unidade:val(p,['uCom']),unitario:money(val(p,['vUnCom'])),total:money(val(p,['vProd']))};}).filter(Boolean);
 const ignore=new Set(['signature','signedinfo','signaturevalue','keyinfo','x509data','x509certificate']);
 function branch(n){if(ignore.has(tag(n)))return null;const cs=Array.from(n.children).map(branch).filter(Boolean);return {label:n.localName||n.nodeName,value:cs.length?'':n.textContent.trim(),children:cs};}
 return {info,parties,values,service,items,tree:branch(main)};
}
