import { ENGINE_CONFIG } from './config/engine.config.js';
import { createDefaultRegistry } from './importers/registry.js';
import { analyzeMarket } from './engine/analyze.js';
import { clusterNiches, createBlueprint, createVariants, forecast } from './engine/decide.js';
import { clearState, emptyState, loadState, saveState, learn } from './engine/store.js';
import { toCSV } from './core/csv.js';

const $ = selector => document.querySelector(selector); const registry = createDefaultRegistry();
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const navItems = [['overview','⌂','Overview'],['imports','⇧','Imports'],['opportunities','◎','Opportunities'],['clusters','◇','Niche Clusters'],['blueprints','▤','Blueprints'],['variants','◫','Variants'],['revenue','$','Revenue'],['learning','◉','Learning'],['settings','⚙','Settings']];
let state = loadState(), analysis = state.rows.length ? analyzeMarket(state.rows, ENGINE_CONFIG) : null, active = 'overview', query = '', selected = null, niche = 'ALL NICHES';
if (state.rows.length && state.dataOrigin === 'none') state.dataOrigin = 'import';

function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function spreadsheetSafe(value) { const text=String(value ?? ''); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function itemNiche(item) { return clusterNiches([item], ENGINE_CONFIG)[0]?.name || 'Unclassified'; }
function money(value, currency = 'USD') { return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0}).format(value || 0); }
function renderNav(){ $('#nav').innerHTML=navItems.map(([id,icon,label])=>`<button class="nav-item ${id===active?'active':''}" data-view="${id}"><span>${icon}</span>${label}</button>`).join(''); }
function setView(view){ active=view; selected=null; renderNav(); render(); document.querySelector('.sidebar').classList.remove('open'); }
function sourceLabel(){return state.dataOrigin === 'example' ? 'EXAMPLE' : 'LOCAL'}
function metric(label,value,note){return `<article class="metric"><span class="label">${label}</span><strong>${value}</strong><em><b>▲ ${sourceLabel()}</b> ${note}</em></article>`}
function revenueProfile(items){const values=items.map(item=>Number(item.estimatedRevenue)||0),maximum=Math.max(...values,1),step=values.length>1?500/(values.length-1):0,points=values.map((value,index)=>`${Math.round(index*step)},${Math.round(160-(value/maximum)*140)}`).join(' ');return `<div class="chart"><svg style="height:calc(100% - 28px)" viewBox="0 0 500 180" preserveAspectRatio="none" role="img" aria-label="Modeled revenue profile across ranked opportunities"><line x1="0" y1="150" x2="500" y2="150"/><line x1="0" y1="100" x2="500" y2="100"/><line x1="0" y1="50" x2="500" y2="50"/><polyline points="${points}"/></svg><small style="display:block;margin-top:8px;color:var(--muted);font-size:8px;line-height:1.4">Model output by ranked opportunity; not observed sales.</small></div>`}
function scoreHeatmap(items){return items.slice(0,25).map(item=>`<b style="--v:${Math.max(0,Math.min(100,item.opportunityScore))}" title="${escapeHTML(item.keyword)}: ${item.opportunityScore}" aria-label="${escapeHTML(item.keyword)} opportunity score ${item.opportunityScore}">${item.opportunityScore}</b>`).join('')}
function opportunityRows(items){return items.map((x,i)=>`<tr data-id="${escapeHTML(x.id)}"><td>${i+1}</td><td>${escapeHTML(x.keyword)}</td><td>${escapeHTML(itemNiche(x))}</td><td>${x.searchVolume.toLocaleString()}<span class="bar"><i style="width:${Math.max(0,Math.min(100,x.demand))}%"></i></span></td><td>${x.competition.toLocaleString()}</td><td class="score">${x.opportunityScore}</td><td>${money(x.estimatedRevenue)}</td><td><span class="tag ${x.opportunityScore>=80?'now':''}">${escapeHTML(forecast(x,ENGINE_CONFIG).priority)}</span></td></tr>`).join('')}
function overview(){ if(!analysis) return emptyView(); const clusters=clusterNiches(analysis.opportunities,ENGINE_CONFIG),items=analysis.opportunities.filter(x=>x.keyword.toLowerCase().includes(query)&&(niche==='ALL NICHES'||itemNiche(x)===niche)).slice(0,12); return `<div class="metric-grid">${metric('TOTAL OPPORTUNITIES',analysis.summary.keywords,'MARKET SIGNALS')}${metric('EST. MONTHLY REVENUE',money(analysis.summary.revenue),'MODELED')}${metric('AVG. OPPORTUNITY SCORE',analysis.summary.avgScore.toFixed(1),'NORMALIZED')}${metric('BLUEPRINTS READY',analysis.opportunities.filter(x=>x.opportunityScore>=70).length,'HIGH CONFIDENCE')}</div><div class="toolbar"><select id="niche-filter"><option ${niche==='ALL NICHES'?'selected':''}>ALL NICHES</option>${clusters.map(x=>`<option ${niche===x.name?'selected':''}>${escapeHTML(x.name)}</option>`).join('')}</select><input id="search" value="${escapeHTML(query)}" placeholder="Search opportunities…"><button id="export" class="primary">EXPORT DECISIONS</button></div><div class="panel-grid"><section class="panel wide"><h2>TOP OPPORTUNITIES / RANKED</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>KEYWORD</th><th>NICHE</th><th>DEMAND</th><th>COMP.</th><th>SCORE</th><th>EST. REVENUE</th><th>DECISION</th></tr></thead><tbody>${opportunityRows(items)}</tbody></table></div></section><section class="panel"><h2>MODELED REVENUE PROFILE</h2>${revenueProfile(items)}</section><section class="panel"><h2>OPPORTUNITY SCORE HEATMAP</h2><div class="heatmap">${scoreHeatmap(items)}</div></section></div><div class="lower"><section class="panel"><h2>BUILD QUEUE</h2><ul class="list">${analysis.opportunities.slice(0,5).map((x,i)=>`<li><span>${i+1}. ${escapeHTML(x.keyword)}</span><b>${escapeHTML(forecast(x,ENGINE_CONFIG).priority)}</b></li>`).join('')}</ul></section><section class="panel"><h2>MARKET GAPS</h2><ul class="list">${analysis.opportunities.filter(x=>x.demand>55&&x.competition>55).slice(0,5).map(x=>`<li><span>${escapeHTML(x.keyword)}</span><b>${x.opportunityScore}</b></li>`).join('')}</ul></section><section class="panel"><h2>RULE-BASED RECOMMENDATIONS</h2><ul class="list">${recommendations(analysis).map(x=>`<li>${x}</li>`).join('')}</ul></section></div>`; }
function emptyView(){return `<div class="empty"><div class="target"><h2>TURN MARKET DATA INTO PRODUCT DECISIONS.</h2><p>Import an Etsy Listings, Similar Keywords or Top Listings CSV. The engine normalizes every signal, detects patterns and creates a prioritized product roadmap.</p><button class="primary" data-import>IMPORT FIRST DATASET</button><p>Or use <button class="back" id="demo">LOAD INCLUDED EXAMPLE</button></p></div></div>`}
function recommendations(a){const top=a.opportunities[0],color=a.patterns.colors[0]?.[0]||'dark'; return [`Build <b>${escapeHTML(top.keyword)}</b> first: ${top.opportunityScore}/100 opportunity score.`,`Lead the first variant family with <b>${escapeHTML(color)}</b>; it is the strongest detected color signal.`,`Price near <b>${money(a.summary.medianPrice)}</b> and validate with a two-tier bundle.`,`Localize the top blueprint into NL, DE and FR after conversion validation.`]}
function listView(title,body){return `<button class="back" data-view="overview">← OVERVIEW</button><section class="panel"><h2>${escapeHTML(title)}</h2>${body}</section>`}
function renderSection(){
  if(!analysis&&active!=='imports'&&active!=='settings')return emptyView();
  const a=analysis;
  if(active==='overview')return overview();
  if(active==='imports')return listView('RECENTLY IMPORTED FILES',`<ul class="list">${state.imports.map(x=>`<li><span>${escapeHTML(x.name)}<br><small>${escapeHTML(x.source)} / ${escapeHTML(new Date(x.at).toLocaleString())}</small></span><b>${Number(x.count)||0} ROWS</b></li>`).join('')||'<li>No imports yet.</li>'}</ul>`);
  if(active==='opportunities')return listView('ALL OPPORTUNITIES',`<div class="table-wrap"><table><thead><tr><th>#</th><th>KEYWORD</th><th>NICHE</th><th>DEMAND</th><th>COMP.</th><th>SCORE</th><th>REVENUE</th><th>PRIORITY</th></tr></thead><tbody>${opportunityRows(a.opportunities)}</tbody></table></div>`);
  if(active==='clusters'){
    const clusters=clusterNiches(a.opportunities,ENGINE_CONFIG);
    return listView('NICHE CLUSTERS',`<ul class="list">${clusters.map(x=>`<li><span>${escapeHTML(x.name)}<br><small>${x.items.slice(0,5).map(item=>escapeHTML(item.keyword)).join(' · ')}</small></span><b>${x.score} / ${x.items.length} SIGNALS</b></li>`).join('')}</ul>`);
  }
  if(active==='blueprints')return listView('PRODUCT BLUEPRINTS',`<ul class="list">${a.opportunities.filter(x=>x.opportunityScore>=65).map(x=>`<li data-id="${escapeHTML(x.id)}"><span>${escapeHTML(createBlueprint(x,a.patterns).productName)}</span><b>OPEN →</b></li>`).join('')}</ul>`);
  if(active==='variants'){
    const blueprint=createBlueprint(a.opportunities[0],a.patterns);
    return listView('VARIANT MATRIX',`<div class="table-wrap"><table><thead><tr><th>PRODUCT</th><th>LOCALE</th><th>STYLE</th><th>CURRENCY</th></tr></thead><tbody>${createVariants(blueprint,ENGINE_CONFIG,['en-US','nl-NL','de-DE','fr-FR']).map(x=>`<tr><td>${escapeHTML(x.product)}</td><td>${escapeHTML(x.locale)}</td><td>${escapeHTML(x.style)}</td><td>${escapeHTML(x.currency)}</td></tr>`).join('')}</tbody></table></div>`);
  }
  if(active==='revenue')return listView('REVENUE ENGINE',`<div class="table-wrap"><table><thead><tr><th>PRODUCT</th><th>MONTHLY SALES</th><th>ANNUAL REVENUE</th><th>PROFIT / MONTH</th><th>ROI</th><th>PRIORITY</th></tr></thead><tbody>${a.opportunities.map(x=>{const result=forecast(x,ENGINE_CONFIG);return `<tr><td>${escapeHTML(x.keyword)}</td><td>${result.monthlySales}</td><td>${money(result.annualRevenue)}</td><td>${money(result.monthlyProfit)}</td><td>${Math.round(result.roi)}%</td><td>${escapeHTML(result.priority)}</td></tr>`}).join('')}</tbody></table></div>`);
  if(active==='learning')return listView('LEARNING ENGINE',`<ul class="list"><li><span>WINNING KEYWORDS</span><b>${Object.keys(state.learning.keywords).length}</b></li><li><span>COLOR SIGNALS</span><b>${Object.keys(state.learning.colors).length}</b></li><li><span>LAYOUT SIGNALS</span><b>${Object.keys(state.learning.layouts).length}</b></li><li><span>PRICING OBSERVATIONS</span><b>${state.learning.prices.length}</b></li></ul>`);
  return listView('ENGINE SETTINGS',`<div class="detail"><dl><dt>DEFAULT LOCALE</dt><dd><select id="locale">${Object.entries(ENGINE_CONFIG.locales).map(([key,value])=>`<option value="${escapeHTML(key)}" ${state.settings.locale===key?'selected':''}>${escapeHTML(value.language)} / ${escapeHTML(value.currency)}</option>`).join('')}</select></dd><dt>MARKETPLACE FEE</dt><dd>${ENGINE_CONFIG.defaults.marketplaceFeeRate*100}%</dd><dt>SCORING MODEL</dt><dd>CONFIG V${escapeHTML(ENGINE_CONFIG.version)}</dd><dt>LOCAL DATA</dt><dd><button class="back" id="clear-data">CLEAR LOCAL DATA</button></dd></dl><dl>${Object.entries(ENGINE_CONFIG.scoreWeights).map(([key,value])=>`<dt>${escapeHTML(key.toUpperCase())}</dt><dd>${value*100}%</dd>`).join('')}</dl></div>`);
}
function blueprintDetail(item){
  const blueprint=createBlueprint(item,analysis.patterns,state.settings.locale),result=forecast(item,ENGINE_CONFIG);
  const definitionList=object=>Object.entries(object).map(([key,value])=>`<dt>${escapeHTML(key.replace(/([A-Z])/g,' $1').toUpperCase())}</dt><dd>${escapeHTML(Array.isArray(value)?value.join(' · '):(typeof value==='number'?Math.round(value).toLocaleString():value))}</dd>`).join('');
  return `<button class="back" id="close-detail">← BACK</button><div class="detail"><section class="panel"><h2>PRODUCT BLUEPRINT / ${item.opportunityScore}</h2><dl>${definitionList(blueprint)}</dl></section><section class="panel"><h2>REVENUE & BUILD DECISION</h2><dl>${definitionList(result)}</dl></section></div>`;
}
function render(){ $('#view').innerHTML=selected?blueprintDetail(selected):renderSection(); $('#footer-count').textContent=`${state.rows.length} MARKET SIGNALS`; $('#data-status').textContent=state.dataOrigin==='example'?'INCLUDED EXAMPLE':state.rows.length?'LOCAL IMPORT':'NO DATA'; bindDynamic(); }
function bindDynamic(){document.querySelectorAll('[data-view]').forEach(x=>x.onclick=()=>setView(x.dataset.view));document.querySelectorAll('[data-import]').forEach(x=>x.onclick=openImport);document.querySelectorAll('[data-id]').forEach(x=>x.onclick=()=>{selected=analysis.opportunities.find(o=>o.id===x.dataset.id);render()});$('#close-detail')?.addEventListener('click',()=>{selected=null;render()});$('#search')?.addEventListener('input',e=>{query=e.target.value.toLowerCase();render()});$('#niche-filter')?.addEventListener('change',e=>{niche=e.target.value;render()});$('#export')?.addEventListener('click',exportData);$('#demo')?.addEventListener('click',loadDemo);$('#locale')?.addEventListener('change',e=>{state.settings.locale=e.target.value;saveState(state)});$('#clear-data')?.addEventListener('click',clearLocalData)}
function openImport(){ $('#import-dialog').showModal(); }
function clearLocalData(){if(!confirm('Clear all locally imported market data and learned signals?'))return;clearState();state=emptyState();analysis=null;active='overview';query='';niche='ALL NICHES';selected=null;renderNav();render()}
async function importFiles(files){
  const source=$('#source-type').value;
  let importedRows=0,resetExample=false;
  for(const file of files){
    try{
      if(file.size>MAX_IMPORT_BYTES)throw new Error('File exceeds the 5 MB local import limit');
      const rows=registry.import(source,await file.text());
      if(!rows.length)throw new Error('No recognized keyword rows');
      if(state.dataOrigin==='example'&&!resetExample){state=emptyState();resetExample=true}
      state.rows.push(...rows);
      state.imports.unshift({name:file.name,source,count:rows.length,at:new Date().toISOString()});
      importedRows+=rows.length;
    }catch(error){alert(`${file.name}: ${error.message}`)}
  }
  if(!importedRows)return;
  state.dataOrigin='import';
  analysis=analyzeMarket(state.rows,ENGINE_CONFIG);
  learn(state,analysis);
  saveState(state);
  query='';niche='ALL NICHES';
  $('#import-dialog').close();
  setView('overview');
}
async function loadDemo(){try{const response=await fetch('./examples/etsy-listings.csv');if(!response.ok)throw new Error();const text=await response.text();const rows=registry.import('etsy-listings',text);state=emptyState();state.dataOrigin='example';state.rows=rows;state.imports=[{name:'etsy-listings.csv',source:'included-example',count:rows.length,at:new Date().toISOString()}];analysis=analyzeMarket(rows,ENGINE_CONFIG);learn(state,analysis);saveState(state);query='';niche='ALL NICHES';render()}catch{alert('Example loading requires a local web server. Import the included CSV manually when using file://.')}}
function exportData(){const blob=new Blob([toCSV(analysis.opportunities.map(x=>({keyword:spreadsheetSafe(x.keyword),niche:spreadsheetSafe(itemNiche(x)),opportunity_score:x.opportunityScore,monthly_revenue:x.estimatedRevenue,priority:spreadsheetSafe(forecast(x,ENGINE_CONFIG).priority)})))],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='numberninjadesigns-etsy-decisions.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
renderNav();render();$('#nav').onclick=e=>e.target.closest('[data-view]')&&setView(e.target.closest('[data-view]').dataset.view);$('#import-trigger').onclick=openImport;$('#choose-files').onclick=()=>$('#file-input').click();$('#file-input').onchange=e=>importFiles(e.target.files);$('#menu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');const drop=$('#drop-zone');['dragenter','dragover'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>importFiles(e.dataTransfer.files));window.addEventListener('error',e=>console.error('[EIE] Runtime error',e.error));
