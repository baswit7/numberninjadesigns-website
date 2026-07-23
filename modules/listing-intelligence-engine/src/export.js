import fs from 'node:fs/promises';import path from 'node:path';
const stable=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x,2)+'\n';
export async function exportPackage(pkg,root='output/listings'){const dir=path.join(root,pkg.product_id,pkg.locale),files={'listing-package.json':stable(pkg),'title-options.txt':pkg.titles.map(x=>`${x.kind}: ${x.value}`).join('\n')+'\n','tags.txt':pkg.tags.map(tag=>`${tag},`).join('\n')+'\n','description.txt':pkg.description+'\n','short-description.txt':pkg.short_description+'\n','highlights.txt':pkg.highlights.join('\n')+'\n','faq.txt':pkg.faq.map(x=>`${x.question}\n${x.answer}`).join('\n\n')+'\n','pricing.json':stable(pkg.pricing),'seo-report.json':stable(pkg.seo_report),'compliance-report.json':stable(pkg.compliance_report),'quality-report.json':stable(pkg.quality_report),'image-production-brief.md':brief(pkg.image_plan),'mockup-production-brief.md':brief(pkg.mockup_plan),'video-production-brief.md':`# Video production brief\n\n${stable(pkg.video_plan)}`,'ab-tests.json':stable(pkg.ab_tests),'publication-checklist.md':pkg.publication_checklist.map(x=>`- [ ] ${x}`).join('\n')+'\n','listingview-transfer-package.json':stable(pkg.transfer_package),'listingview-audit-input.json':stable(pkg.audit_roundtrip.input),'etsy-upload-values.json':stable(pkg.transfer_package.etsy_form),'etsy-paste-sheet.txt':pasteSheet(pkg.transfer_package.etsy_form)};await fs.mkdir(path.join(dir,'assets'),{recursive:true});await fs.mkdir(path.join(dir,'source-manifests'),{recursive:true});await Promise.all(Object.entries(files).map(([name,data])=>fs.writeFile(path.join(dir,name),data)));return {directory:dir,files:Object.keys(files)}}
const brief=items=>'# Production brief\n\n'+items.map((x,i)=>`## ${i+1}. ${x.purpose||x.scene}\n\n\`\`\`json\n${JSON.stringify(x,null,2)}\n\`\`\``).join('\n\n')+'\n';
const pasteSheet=form=>[
  `CATEGORIE\n${form.category.name}`,
  `CATEGORIE ZOEKTERM\n${form.category.search_term}`,
  `TYPE ITEM\nDigitale bestanden`,
  `WANNEER GEMAAKT\n${form.when_made}`,
  `TITEL\n${form.title}`,
  `BESCHRIJVING\n${form.description}`,
  `TAGS\n${form.tags.map(tag=>`${tag},`).join('\n')}`,
  `PRIJS\n${form.price.amount.toFixed(2).replace('.', ',')}`,
  `AANTAL\n${form.quantity}`,
  `SKU\n${form.sku}`,
  `WIE HEEFT HET GEMAAKT\nIkzelf`,
  `WAT IS HET\nEen eindproduct`,
  `DIGITALE CONTENT\nMet behulp van een AI-generator`,
  `PRODUCTIEPARTNER\nGeen`,
  `SHOPSECTIE\nGeen`,
  `UITGELICHTE LISTING\nUit`,
  `ETSY ADS\nUit`,
  `VERNIEUWING\nAutomatisch`
].join('\n\n')+'\n';
