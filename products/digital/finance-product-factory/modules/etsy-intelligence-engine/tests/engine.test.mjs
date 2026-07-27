import assert from 'node:assert/strict';
import { parseCSV, toCSV } from '../core/csv.js';
import { createDefaultRegistry } from '../importers/registry.js';
import { analyzeMarket, detectPatterns } from '../engine/analyze.js';
import { clusterNiches, createBlueprint, createVariants, forecast } from '../engine/decide.js';
import { ENGINE_CONFIG } from '../config/engine.config.js';

const csv='keyword,search_volume,competition,price,reviews,favorites,age_days,sales,colors,fonts,sheets\n"Budget, Planner",1000,100,10,20,50,30,25,"green,dark",Inter,8\nDebt Tracker,800,50,12,10,40,20,30,black,Mono,6';
assert.equal(parseCSV(csv).length,2); assert.match(toCSV([{a:'x,y'}]),/"x,y"/);
const rows=createDefaultRegistry().import('etsy-listings',csv); assert.equal(rows[0].keyword,'Budget, Planner'); assert.equal(rows[1].sales,30);
const analysis=analyzeMarket(rows,ENGINE_CONFIG); assert.equal(analysis.opportunities.length,2); assert.ok(analysis.opportunities.every(x=>x.opportunityScore>=0&&x.opportunityScore<=100));
assert.equal(clusterNiches(analysis.opportunities,ENGINE_CONFIG).length,2); assert.ok(detectPatterns(rows).colors.length>0);
const blueprint=createBlueprint(analysis.opportunities[0],analysis.patterns); assert.ok(blueprint.workbookTabs.length>=5);
assert.ok(createVariants(blueprint,ENGINE_CONFIG,['en-US','nl-NL']).length>2); assert.ok(forecast(analysis.opportunities[0],ENGINE_CONFIG).annualRevenue>0);
assert.equal(Object.values(ENGINE_CONFIG.scoreWeights).reduce((a,b)=>a+b,0),1);
assert.equal(createDefaultRegistry().import('etsy-listings','keyword\n<script>alert(1)</script>')[0].keyword,'&lt;script&gt;alert(1)&lt;/script&gt;');
console.log('Etsy Intelligence Engine: all tests passed');
