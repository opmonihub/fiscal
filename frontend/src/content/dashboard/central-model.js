export function companySummary(rows,structure=[]){
 const dirs=new Map(structure.map(r=>[r.empresa,r]));const g=new Map();
 for(const r of rows){if(!g.has(r.empresa))g.set(r.empresa,{empresa:r.empresa,codigo:r.empresa.split('-')[0],arquivos:0,outubro:0,alertas:0,preparados:0,NFE:0,NFCE:0,CTE:0,NFSE:0});const a=g.get(r.empresa);a.arquivos++;a.outubro+=r.emissao==='Outubro/2026'?1:0;a.alertas+=r.temAlerta?1:0;a.preparados+=r.preparado?1:0;if(r.tipo in a)a[r.tipo]++;}
 return [...g.values()].map(a=>({...a,pastas:dirs.get(a.empresa)?.pastas??0,estrutura:`${dirs.get(a.empresa)?.pastas??0} / 8`,situacao:a.preparados===0?'Sem cópia correspondente':a.preparados<a.outubro?'Cópias parciais':'Cópias correspondentes'})).sort((a,b)=>b.arquivos-a.arquivos);
}
export function nextAction(r){
 if(r.papelEmpresa==='Remetente')return 'Entrada confirmada pelo usuário; conferir tomador original no XML';
 if(r.grupo==='Canceladas')return 'Conferir situação e eventos antes de preparar';
 if(r.grupo==='Pastas copy')return 'Evitar usar a mesma origem duas vezes';
 if(r.alertas.includes('Origem de outubro nao localizada'))return 'Localizar o original em outras pastas ou competências';
 if(r.emissao==='Novembro/2026')return 'Fora da preparação de outubro pela emissão; analisar divergência de competência';
 if(r.alertas.includes('Competencia divergente'))return 'Manter emissão como critério e revisar competência';
 return 'Revisar o documento';
}
export function issueGroups(rows){const labels=[['Emissão em novembro',r=>r.emissao==='Novembro/2026'],['Competência divergente',r=>r.alertas.includes('Competencia divergente')],['Cópias repetidas',r=>r.grupo==='Pastas copy'],['CT-e: tomador divergente',r=>r.papelEmpresa==='Remetente'],['Origem não localizada',r=>r.alertas.includes('Origem de outubro nao localizada')]];return labels.map(([categoria,test])=>({categoria,arquivos:rows.filter(test).length})).filter(r=>r.arquivos);}
