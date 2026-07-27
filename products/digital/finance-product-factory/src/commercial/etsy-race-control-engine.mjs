const RACE_CONTROL_VERSION = '1.1.0';

const ETSY_POLICY_SOURCES = Object.freeze([
  Object.freeze({ id: 'stats', label: 'Etsy Stats', url: 'https://help.etsy.com/hc/en-us/articles/115015774268-How-to-Use-Etsy-Stats-for-Your-Shop' }),
  Object.freeze({ id: 'service', label: 'Etsy customer service standards', url: 'https://help.etsy.com/hc/en-us/articles/360036207794-What-are-Etsy-s-Customer-Service-Standards' }),
  Object.freeze({ id: 'messages', label: 'Etsy Messages and quick replies', url: 'https://help.etsy.com/hc/en-us/articles/115015654988-How-to-Send-Messages-to-Buyers' }),
  Object.freeze({ id: 'seller-policy', label: 'Etsy Seller Policy', url: 'https://www.etsy.com/legal/sellers/' }),
]);

function languageFor(locale) {
  return String(locale).toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows) {
  return `${rows.map(row => row.map(csvCell).join(',')).join('\n')}\n`;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function aggregate(records, variant) {
  return records.filter(record => record.variant === variant).reduce((total, record) => ({
    days: total.days + Number(record.days || 0),
    listingViews: total.listingViews + Number(record.listingViews || 0),
    orders: total.orders + Number(record.orders || 0),
    revenue: total.revenue + Number(record.revenue || 0),
    favorites: total.favorites + Number(record.favorites || 0),
    supportContacts: total.supportContacts + Number(record.supportContacts || 0),
    resolutionCases: total.resolutionCases + Number(record.resolutionCases || 0),
    firstMessages: total.firstMessages + Number(record.firstMessages || 0),
    withinSla: total.withinSla + Number(record.withinSla || 0),
  }), { days: 0, listingViews: 0, orders: 0, revenue: 0, favorites: 0, supportContacts: 0, resolutionCases: 0, firstMessages: 0, withinSla: 0 });
}

function metrics(total) {
  return Object.freeze({
    ...total,
    conversionRate: ratio(total.orders, total.listingViews),
    revenuePerView: ratio(total.revenue, total.listingViews),
    favoriteRate: ratio(total.favorites, total.listingViews),
    supportRate: ratio(total.supportContacts, total.orders),
    resolutionRate: ratio(total.resolutionCases, total.orders),
    responseSlaRate: total.firstMessages ? ratio(total.withinSla, total.firstMessages) : 1,
  });
}

function rateWithin(candidate, baseline, relativeTolerance, absoluteTolerance = 0.02) {
  return candidate <= Math.max(baseline * (1 + relativeTolerance), baseline + absoluteTolerance);
}

export function evaluateRaceControlExperiment(records, gate = {}) {
  const policy = {
    minimumViewsPerVariant: 500,
    minimumDaysPerVariant: 14,
    minimumRevenuePerViewUplift: 0.10,
    maximumGuardrailRegression: 0.20,
    minimumResponseSlaRate: 0.95,
    ...gate,
  };
  const a = metrics(aggregate(records, 'A'));
  const b = metrics(aggregate(records, 'B'));
  const enoughEvidence = [a, b].every(item => item.listingViews >= policy.minimumViewsPerVariant && item.days >= policy.minimumDaysPerVariant);
  if (!enoughEvidence) return Object.freeze({ status: 'COLLECTING', winner: null, a, b, policy, reason: 'Minimum views and test duration are not complete for both variants.' });
  const guardrailsPass = (candidate, baseline) => rateWithin(candidate.supportRate, baseline.supportRate, policy.maximumGuardrailRegression)
    && rateWithin(candidate.resolutionRate, baseline.resolutionRate, policy.maximumGuardrailRegression)
    && candidate.responseSlaRate >= policy.minimumResponseSlaRate;
  const bWins = b.revenuePerView >= a.revenuePerView * (1 + policy.minimumRevenuePerViewUplift) && b.conversionRate >= a.conversionRate * 0.95 && guardrailsPass(b, a);
  const aWins = a.revenuePerView >= b.revenuePerView * (1 + policy.minimumRevenuePerViewUplift) && a.conversionRate >= b.conversionRate * 0.95 && guardrailsPass(a, b);
  if (bWins) return Object.freeze({ status: 'PROMOTE', winner: 'B', a, b, policy, reason: 'Variant B clears the revenue-per-view uplift and every customer-experience guardrail.' });
  if (aWins) return Object.freeze({ status: 'KEEP_CONTROL', winner: 'A', a, b, policy, reason: 'Control A remains materially stronger after customer-experience guardrails.' });
  return Object.freeze({ status: 'NO_CLEAR_WINNER', winner: null, a, b, policy, reason: 'No variant clears the minimum commercial uplift without weakening a guardrail.' });
}

function copyFor(locale) {
  return languageFor(locale) === 'nl' ? {
    dashboardTitle: 'ETSY RACE CONTROL', dashboardLead: 'Een lokale cockpit voor snellere, veiligere listingbesluiten.',
    playbookTitle: 'Race Control-bedieningsboek', noData: 'Voeg geaggregeerde Etsy Stats toe. Gebruik nooit namen, ordernummers of berichten.',
    loadExample: 'Laad voorbeeld', exampleLabel: 'VOORBEELDDATA · niet gebruiken als echt bewijs',
    replaceExampleConfirm: 'Er staan al lokale resultaten in dit dashboard. Wil je die vervangen door de duidelijk gemarkeerde voorbeelddata?',
    quickReplies: [
      ['Eerste reactie', 'Bedankt voor je bericht. Ik help je dit zo snel mogelijk op te lossen. Kun je aangeven of je Excel of Google Sheets gebruikt, welke versie je hebt en wat je precies ziet? Deel geen financiële of persoonlijke gegevens.'],
      ['Downloadtoegang', 'Ik help je met de download. Open in Etsy je account, ga naar Aankopen en reviews en kies Bestanden downloaden bij deze bestelling. Laat weten welke stap niet lukt; dan zoeken we gericht verder.'],
      ['Google Sheets import', 'Upload het bestand eerst naar Google Drive en kies Openen met Google Spreadsheets. Werk daarna in een kopie. De importklare editie gebruikt platformoverstijgende kernformules; stuur bij een probleem de exacte fouttekst en het tabblad mee.'],
      ['Excel-probleem', 'Dank voor de duidelijke melding. Ik reproduceer dit eerst in Excel. Vermeld je Excel-versie, Windows of macOS, het tabblad en de exacte cel of handeling. Deel geen echte financiële gegevens.'],
      ['Opgelost en neutrale reviewvraag', 'Fijn dat het is opgelost. Als je jouw ervaring wilt delen, kun je via Etsy een eerlijke review achterlaten. Dat is volledig vrijwillig; er staat geen beloning of voordeel tegenover.'],
    ],
  } : {
    dashboardTitle: 'ETSY RACE CONTROL', dashboardLead: 'A local cockpit for faster, safer listing decisions.',
    playbookTitle: 'Race Control operating playbook', noData: 'Add aggregated Etsy Stats only. Never enter names, order numbers or message content.',
    loadExample: 'Load example', exampleLabel: 'EXAMPLE DATA · do not use as real evidence',
    replaceExampleConfirm: 'This dashboard already contains local results. Replace them with the clearly marked example data?',
    quickReplies: [
      ['First response', 'Thanks for reaching out. I will help you resolve this as quickly as possible. Please share whether you use Excel or Google Sheets, your version, and exactly what you see. Do not share financial or personal data.'],
      ['Download access', 'I can help with the download. In Etsy, open your account, go to Purchases and reviews, then choose Download Files for this order. Tell me which step fails and I will narrow it down.'],
      ['Google Sheets import', 'Upload the file to Google Drive first and choose Open with Google Sheets. Then work in a copy. The import-ready edition uses cross-platform core formulas; if something fails, send the exact error text and sheet name.'],
      ['Excel issue', 'Thank you for the clear report. I will reproduce this in Excel first. Include your Excel version, Windows or macOS, the sheet, and the exact cell or action. Do not share real financial data.'],
      ['Resolved and neutral review request', 'I am glad this is resolved. If you want to share your experience, you can leave an honest review through Etsy. It is entirely optional and no reward or benefit is offered.'],
    ],
  };
}

export function buildEtsyRaceControlPlan({ profile, locale = profile?.locale ?? 'en-US', currency = profile?.priceExperiment?.control?.currency ?? 'USD', generatedAt = new Date().toISOString() } = {}) {
  if (!profile?.priceExperiment || !profile?.supportPromise) throw new Error('Race Control requires a complete Etsy commercial profile.');
  const dutch = languageFor(locale) === 'nl';
  const experiments = [
    {
      id: 'thumbnail-outcome-001', priority: 1, status: 'READY', variable: 'primary-thumbnail',
      hypothesis: dutch ? 'Een dashboardgerichte hero verhoogt orders per listingweergave ten opzichte van de brede all-in-one hero.' : 'A dashboard-led hero will improve orders per listing view versus the broad all-in-one hero.',
      control: 'Current all-in-one hero', challenger: dutch ? 'Dashboardresultaat + 24 werkbladen + twee platforms' : 'Dashboard outcome + 24 sheets + two platforms',
    },
    {
      id: profile.priceExperiment.id, priority: 2, status: 'QUEUED', variable: 'price', hypothesis: profile.priceExperiment.hypothesis,
      control: `${profile.priceExperiment.control.currency} ${profile.priceExperiment.control.price}`, challenger: `${profile.priceExperiment.challenger.currency} ${profile.priceExperiment.challenger.price}`,
    },
    {
      id: 'title-intent-001', priority: 3, status: 'QUEUED', variable: 'title-opening',
      hypothesis: dutch ? 'Een resultaatgerichte titelopening presteert beter dan een productgerichte opening.' : 'An outcome-led title opening will outperform a product-led opening.',
      control: profile.title, challenger: profile.alternativeTitle,
    },
    {
      id: 'proof-order-001', priority: 4, status: 'QUEUED', variable: 'gallery-slot-2',
      hypothesis: dutch ? 'Direct dashboardbewijs in positie twee verhoogt favorieten en orders zonder meer supportvragen.' : 'Immediate dashboard proof in slot two will lift favorites and orders without increasing support demand.',
      control: 'Dashboard overview', challenger: 'Light/dark comparison',
    },
  ].map(item => Object.freeze(item));
  const gate = Object.freeze({
    minimumViewsPerVariant: profile.priceExperiment.minimumRun.qualifiedViewsPerVariant,
    minimumDaysPerVariant: profile.priceExperiment.minimumRun.minimumDays,
    minimumRevenuePerViewUplift: 0.10,
    maximumGuardrailRegression: 0.20,
    minimumResponseSlaRate: 0.95,
    runMode: 'SEQUENTIAL_MATCHED_WINDOWS_ONE_VARIABLE_ONLY',
  });
  const exampleEvidence = Object.freeze({
    label: dutch ? 'Voorbeeld: challenger B wint veilig' : 'Example: challenger B wins safely',
    disclaimer: dutch ? 'Uitsluitend fictieve demonstratiedata; niet gebruiken als Etsy-bewijs.' : 'Fictitious demonstration data only; do not use as Etsy evidence.',
    experimentId: experiments[0].id,
    expectedDecision: 'PROMOTE B',
    records: Object.freeze([
      Object.freeze({
        id: 'example-control-a', example: true, date: new Date(generatedAt).toISOString().slice(0, 10), experimentId: experiments[0].id, variant: 'A',
        days: Math.max(14, gate.minimumDaysPerVariant), listingViews: Math.max(600, gate.minimumViewsPerVariant), orders: 18, revenue: 522,
        favorites: 52, supportContacts: 1, resolutionCases: 0, firstMessages: 10, withinSla: 10,
      }),
      Object.freeze({
        id: 'example-challenger-b', example: true, date: new Date(generatedAt).toISOString().slice(0, 10), experimentId: experiments[0].id, variant: 'B',
        days: Math.max(14, gate.minimumDaysPerVariant), listingViews: Math.max(600, gate.minimumViewsPerVariant), orders: 21, revenue: 714,
        favorites: 61, supportContacts: 1, resolutionCases: 0, firstMessages: 10, withinSla: 10,
      }),
    ]),
  });
  return Object.freeze({
    schemaVersion: '1.0.0', raceControlVersion: RACE_CONTROL_VERSION, status: 'READY', generatedAt: new Date(generatedAt).toISOString(), locale, currency,
    mission: dutch ? 'Win door iedere week sneller te leren zonder productkwaliteit of klantvertrouwen op te offeren.' : 'Win by learning faster every week without trading away product quality or customer trust.',
    sourceMetrics: Object.freeze(['listingViews', 'orders', 'revenue', 'favorites', 'supportContacts', 'resolutionCases', 'firstMessages', 'withinSla']),
    derivedMetrics: Object.freeze(['conversionRate', 'revenuePerView', 'favoriteRate', 'supportRate', 'resolutionRate', 'responseSlaRate']),
    experiments: Object.freeze(experiments), gate, exampleEvidence,
    operatingCadence: Object.freeze([
      Object.freeze({ day: 'MONDAY', action: 'Record the prior seven days of aggregated Etsy Stats and support counters.' }),
      Object.freeze({ day: 'WEDNESDAY', action: 'Classify support friction and fix recurring product or onboarding defects before adding traffic.' }),
      Object.freeze({ day: 'FRIDAY', action: 'Run the promotion gate; promote only a clear winner and archive the evidence.' }),
    ]),
    stopConditions: Object.freeze([
      'Stop a test when support contacts exceed 12% of orders.',
      'Stop a test when refund or resolution cases exceed 3% of orders.',
      'Stop immediately on a workbook, download, compatibility or policy defect.',
      'Never change more than one controlled listing variable during a test window.',
    ]),
    feedbackTaxonomy: Object.freeze(['download-access', 'setup', 'excel-compatibility', 'google-sheets-import', 'formula-defect', 'usability', 'feature-request', 'refund-or-resolution']),
    reviewGuardrails: Object.freeze(['Ask only for an honest, optional review.', 'Never reward, discount, pressure or filter buyers based on expected sentiment.', 'Never purchase, coordinate or simulate reviews, favorites, clicks or sales.', 'Resolve the buyer issue before sending the optional review quick reply.']),
    privacy: Object.freeze({ customerDataAllowed: false, prohibited: Object.freeze(['names', 'email addresses', 'order numbers', 'message content', 'financial data']), storage: 'local browser storage only' }),
    policySources: ETSY_POLICY_SOURCES,
  });
}

function renderDashboardHtml(plan) {
  const copy = copyFor(plan.locale);
  const embedded = JSON.stringify(plan).replaceAll('<', '\\u003c');
  const ui = JSON.stringify({ exampleLabel: copy.exampleLabel, replaceExampleConfirm: copy.replaceExampleConfirm }).replaceAll('<', '\\u003c');
  const html = `<!doctype html><html lang="${languageFor(plan.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'"><title>${escapeHtml(copy.dashboardTitle)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#050807;color:#eef5f1;font:15px/1.5 system-ui,sans-serif}button,input,select{font:inherit}header,main{max-width:1420px;margin:auto;padding:24px}header{display:flex;align-items:end;justify-content:space-between;border-bottom:1px solid #263a31}h1{margin:0;color:#00ff94;letter-spacing:.08em}h2{margin-top:0}.muted{color:#92a39b}.status{padding:8px 12px;border:1px solid #00ff94;border-radius:999px;color:#00ff94;font-weight:800}.demo{margin:14px 0 0;padding:10px 12px;border:1px solid #ffbf69;border-radius:9px;background:#241a08;color:#ffcf86;font-weight:800}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.panel{margin:18px 0;padding:22px;border:1px solid #294036;border-radius:18px;background:#0c1511}.fields{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:12px}.field{display:grid;gap:5px}.field span{color:#8fa198;font-size:12px;text-transform:uppercase}.field input,.field select{width:100%;padding:10px;border:1px solid #365044;border-radius:9px;background:#07100c;color:#fff}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}button{padding:10px 15px;border:1px solid #00ff94;border-radius:9px;background:#00ff94;color:#032016;font-weight:800;cursor:pointer}button.secondary{background:#0d1813;color:#d8e6df}button.danger{border-color:#ff6f67;background:#29100f;color:#ffaaa5}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{padding:18px;border:1px solid #284137;border-radius:14px;background:#0a120f}.metric b{display:block;font-size:28px;color:#00ff94}.metric span{color:#91a299}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #263a31;text-align:left}th{color:#00ff94}.decision{padding:18px;border-left:6px solid #00ff94;background:#0a1912}.warning{color:#ffbf69}.error{color:#ff837c}.hidden{display:none}@media(max-width:900px){.grid{grid-template-columns:1fr}.fields{grid-template-columns:repeat(2,1fr)}.metrics{grid-template-columns:repeat(2,1fr)}header{align-items:start;gap:12px;flex-direction:column}}@media(max-width:520px){.fields,.metrics{grid-template-columns:1fr}main,header{padding:16px}.panel{padding:16px}}
</style></head><body><header><div><h1>${escapeHtml(copy.dashboardTitle)}</h1><p class="muted">${escapeHtml(copy.dashboardLead)}</p></div><span id="appStatus" class="status">READY</span></header><main><section class="panel"><h2>Experiment</h2><div class="fields"><label class="field"><span>ID</span><select id="experiment"></select></label><label class="field"><span>Variant</span><select id="variant"><option>A</option><option>B</option></select></label><label class="field"><span>Date</span><input id="date" type="date"></label><label class="field"><span>Days</span><input id="days" type="number" min="1" value="7"></label><label class="field"><span>Listing views</span><input id="listingViews" type="number" min="0" value="0"></label><label class="field"><span>Orders</span><input id="orders" type="number" min="0" value="0"></label><label class="field"><span>Revenue</span><input id="revenue" type="number" min="0" step="0.01" value="0"></label><label class="field"><span>Favorites</span><input id="favorites" type="number" min="0" value="0"></label><label class="field"><span>Support contacts</span><input id="supportContacts" type="number" min="0" value="0"></label><label class="field"><span>Resolution cases</span><input id="resolutionCases" type="number" min="0" value="0"></label><label class="field"><span>First messages</span><input id="firstMessages" type="number" min="0" value="0"></label><label class="field"><span>Within SLA</span><input id="withinSla" type="number" min="0" value="0"></label></div><div class="actions"><button id="add">Add weekly result</button><button id="loadExample" class="secondary">${escapeHtml(copy.loadExample)}</button><button id="exportJson" class="secondary">Export evidence</button><button id="exportCsv" class="secondary">Export CSV</button><button id="importButton" class="secondary">Import evidence</button><input id="importFile" class="hidden" type="file" accept="application/json"><button id="reset" class="danger">Reset local data</button></div><p id="demoLabel" class="demo hidden">${escapeHtml(copy.exampleLabel)}</p><p class="muted">${escapeHtml(copy.noData)}</p><p id="error" class="error" role="alert"></p></section><section class="grid"><div class="panel"><h2>Control A</h2><div id="metricsA" class="metrics"></div></div><div class="panel"><h2>Challenger B</h2><div id="metricsB" class="metrics"></div></div></section><section class="panel"><h2>Promotion gate</h2><div id="decision" class="decision"></div></section><section class="panel"><h2>Evidence log</h2><div style="overflow:auto"><table><thead><tr><th>Date</th><th>Experiment</th><th>Variant</th><th>Days</th><th>Views</th><th>Orders</th><th>Revenue</th><th>Action</th></tr></thead><tbody id="records"></tbody></table></div></section></main><script>
'use strict';const PLAN=${embedded};const UI=${ui};const KEY='etsy-race-control-v1:'+PLAN.locale;let state={records:[]};const $=id=>document.getElementById(id);const fields=['days','listingViews','orders','revenue','favorites','supportContacts','resolutionCases','firstMessages','withinSla'];function safeNumber(id){const value=Number($(id).value);if(!Number.isFinite(value)||value<0)throw new Error(id+' must be a non-negative number.');return value}function load(){try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed.records))state=parsed}}catch(error){showError(error)}}function save(){localStorage.setItem(KEY,JSON.stringify(state))}function totals(variant){return state.records.filter(row=>row.experimentId===$('experiment').value&&row.variant===variant).reduce((a,row)=>{fields.forEach(key=>a[key]+=Number(row[key]||0));return a},Object.fromEntries(fields.map(key=>[key,0])))}function div(a,b){return b>0?a/b:0}function stats(variant){const t=totals(variant);return {...t,conversionRate:div(t.orders,t.listingViews),revenuePerView:div(t.revenue,t.listingViews),favoriteRate:div(t.favorites,t.listingViews),supportRate:div(t.supportContacts,t.orders),resolutionRate:div(t.resolutionCases,t.orders),responseSlaRate:t.firstMessages?div(t.withinSla,t.firstMessages):1}}function pct(value){return (value*100).toFixed(1)+'%'}function money(value){return new Intl.NumberFormat(PLAN.locale,{style:'currency',currency:PLAN.currency}).format(value)}function metric(label,value){const node=document.createElement('div');node.className='metric';const b=document.createElement('b');b.textContent=value;const span=document.createElement('span');span.textContent=label;node.append(b,span);return node}function renderMetrics(target,data){target.replaceChildren(metric('Views',data.listingViews),metric('Orders',data.orders),metric('Conversion',pct(data.conversionRate)),metric('Revenue/view',money(data.revenuePerView)),metric('Favorite rate',pct(data.favoriteRate)),metric('Support rate',pct(data.supportRate)),metric('Resolution rate',pct(data.resolutionRate)),metric('Response SLA',pct(data.responseSlaRate)))}function within(candidate,baseline){return candidate<=Math.max(baseline*1.2,baseline+0.02)}function decide(a,b){const gate=PLAN.gate;if([a,b].some(x=>x.listingViews<gate.minimumViewsPerVariant||x.days<gate.minimumDaysPerVariant))return{status:'COLLECTING',text:'Keep running: both variants need '+gate.minimumViewsPerVariant+' views and '+gate.minimumDaysPerVariant+' days.'};const guards=(c,base)=>within(c.supportRate,base.supportRate)&&within(c.resolutionRate,base.resolutionRate)&&c.responseSlaRate>=gate.minimumResponseSlaRate;if(b.revenuePerView>=a.revenuePerView*(1+gate.minimumRevenuePerViewUplift)&&b.conversionRate>=a.conversionRate*.95&&guards(b,a))return{status:'PROMOTE B',text:'Challenger B clears commercial uplift and customer-experience guardrails.'};if(a.revenuePerView>=b.revenuePerView*(1+gate.minimumRevenuePerViewUplift)&&a.conversionRate>=b.conversionRate*.95&&guards(a,b))return{status:'KEEP A',text:'Control A remains materially stronger after guardrails.'};return{status:'NO CLEAR WINNER',text:'Do not promote. Archive the result and move to the next hypothesis.'}}function isExample(){return state.records.length>0&&state.records.every(row=>row.example===true)}function render(){const selected=$('experiment').value;const a=stats('A'),b=stats('B');renderMetrics($('metricsA'),a);renderMetrics($('metricsB'),b);const verdict=decide(a,b);$('decision').textContent=verdict.status+' — '+verdict.text;$('appStatus').textContent=(isExample()?'DEMO · ':'')+verdict.status;$('demoLabel').classList.toggle('hidden',!isExample());const body=$('records');body.replaceChildren();state.records.filter(row=>row.experimentId===selected).forEach(row=>{const tr=document.createElement('tr');[row.date,row.experimentId,row.variant,row.days,row.listingViews,row.orders,money(row.revenue)].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});const action=document.createElement('td');const button=document.createElement('button');button.className='danger';button.textContent='Delete';button.addEventListener('click',()=>{state.records=state.records.filter(item=>item.id!==row.id);save();render()});action.append(button);tr.append(action);body.append(tr)})}function showError(error){$('error').textContent=error instanceof Error?error.message:String(error)}function download(name,type,content){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}PLAN.experiments.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.priority+'. '+item.id+' · '+item.variable;$('experiment').append(option)});$('date').value=new Date().toISOString().slice(0,10);$('experiment').addEventListener('change',render);$('add').addEventListener('click',()=>{try{showError('');const row={id:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random(),experimentId:$('experiment').value,variant:$('variant').value,date:$('date').value};fields.forEach(key=>row[key]=safeNumber(key));if(!row.date)throw new Error('Date is required.');if(row.withinSla>row.firstMessages)throw new Error('Within SLA cannot exceed first messages.');state.records.push(row);save();render()}catch(error){showError(error)}});$('loadExample').addEventListener('click',()=>{if(state.records.length&&!confirm(UI.replaceExampleConfirm))return;state={records:PLAN.exampleEvidence.records.map(row=>({...row}))};$('experiment').value=PLAN.exampleEvidence.experimentId;showError('');save();render()});$('exportJson').addEventListener('click',()=>download('race-control-evidence-'+PLAN.locale+'.json','application/json',JSON.stringify({schemaVersion:'1.0.0',exportedAt:new Date().toISOString(),locale:PLAN.locale,exampleData:isExample(),records:state.records},null,2)));$('exportCsv').addEventListener('click',()=>{const header=['date','experiment_id','variant','example_data',...fields];const rows=state.records.map(row=>[row.date,row.experimentId,row.variant,row.example===true,...fields.map(key=>row[key])]);const encode=value=>'"'+String(value??'').replaceAll('"','""')+'"';download('race-control-evidence-'+PLAN.locale+'.csv','text/csv',[header,...rows].map(row=>row.map(encode).join(',')).join('\n'))});$('importButton').addEventListener('click',()=>$('importFile').click());$('importFile').addEventListener('change',async event=>{try{const parsed=JSON.parse(await event.target.files[0].text());if(!Array.isArray(parsed.records))throw new Error('Import does not contain a records array.');state={records:parsed.records};save();render()}catch(error){showError(error)}});$('reset').addEventListener('click',()=>{if(confirm('Delete all locally stored Race Control records for '+PLAN.locale+'?')){state={records:[]};save();render()}});load();render();
</script></body></html>`;
  return html.replaceAll("join('\n')", 'join(String.fromCharCode(10))');
}

function renderPlaybook(plan) {
  const copy = copyFor(plan.locale);
  const sources = plan.policySources.map(source => `- [${source.label}](${source.url})`).join('\n');
  const experiments = plan.experiments.map(item => `- **${item.priority}. ${item.id}** — ${item.variable}: ${item.hypothesis}`).join('\n');
  const stops = plan.stopConditions.map(item => `- ${item}`).join('\n');
  const guardrails = plan.reviewGuardrails.map(item => `- ${item}`).join('\n');
  return `# ${copy.playbookTitle}\n\n## Mission\n\n${plan.mission}\n\n## Operating rhythm\n\n1. Monday: record the previous seven days in \`race-control-dashboard.html\`.\n2. Wednesday: classify support friction and fix recurring defects before buying or adding traffic.\n3. Friday: run the promotion gate. Change exactly one listing variable only after a clear result.\n\n## Experiment queue\n\n${experiments}\n\n## Promotion gate\n\n- Minimum ${plan.gate.minimumViewsPerVariant} listing views and ${plan.gate.minimumDaysPerVariant} days per variant.\n- Minimum ${(plan.gate.minimumRevenuePerViewUplift * 100).toFixed(0)}% revenue-per-view uplift.\n- Conversion may not decline more than 5%.\n- Support and resolution rates may not regress more than ${(plan.gate.maximumGuardrailRegression * 100).toFixed(0)}%.\n- At least ${(plan.gate.minimumResponseSlaRate * 100).toFixed(0)}% of first messages answered within the internal SLA.\n- Sequential Etsy windows reduce noise but do not prove causality; record seasonality, traffic source and promotions separately.\n\n## Stop conditions\n\n${stops}\n\n## Review integrity\n\n${guardrails}\n\n## Data boundary\n\nUse aggregate counts only. Never enter names, email addresses, order numbers, message text or financial data. The dashboard works locally and makes no network requests.\n\n## Official policy references\n\n${sources}\n`;
}

function renderQuickReplies(plan) {
  const copy = copyFor(plan.locale);
  return `${copy.quickReplies.map(([title, body]) => `[${title}]\n${body}`).join('\n\n---\n\n')}\n`;
}

export function buildEtsyRaceControlBundle(options = {}) {
  const plan = buildEtsyRaceControlPlan(options);
  const backlogRows = [['priority', 'experiment_id', 'status', 'controlled_variable', 'hypothesis', 'control', 'challenger'], ...plan.experiments.map(item => [item.priority, item.id, item.status, item.variable, item.hypothesis, item.control, item.challenger])];
  const scorecardHeader = [['date', 'experiment_id', 'variant', 'days', 'listing_views', 'orders', 'revenue', 'favorites', 'support_contacts', 'resolution_cases', 'first_messages', 'within_sla']];
  const files = new Map([
    ['seller/race-control/race-control-plan.json', `${JSON.stringify(plan, null, 2)}\n`],
    ['seller/race-control/race-control-dashboard.html', renderDashboardHtml(plan)],
    ['seller/race-control/experiment-backlog.csv', csv(backlogRows)],
    ['seller/race-control/weekly-scorecard.csv', csv(scorecardHeader)],
    ['seller/race-control/operating-playbook.md', renderPlaybook(plan)],
    ['seller/race-control/etsy-quick-replies.txt', renderQuickReplies(plan)],
  ]);
  if (files.size !== 6 || [...files.values()].some(value => !String(value).trim())) throw new Error('Race Control bundle is incomplete.');
  return Object.freeze({ plan, files });
}

export { ETSY_POLICY_SOURCES, RACE_CONTROL_VERSION };
