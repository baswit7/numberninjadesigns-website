export const VISUAL_QUALITY_STANDARD = Object.freeze({
  standard_id: 'NND-VISUAL-QUALITY-2026.1',
  name: 'NumberNinjaDesigns World-Class Media Gate',
  enforcement: 'HARD_GATE',
  principles: [
    'Show the real product experience instead of a decorative approximation.',
    'Every asset must be immediately usable in a premium commercial listing.',
    'A failed visual direction is rebuilt from a clean source; it is never patched into approval.'
  ],
  image_requirements: [
    'Inspect every final image at 100% scale.',
    'Use original, exact and fully legible product artwork or verified product captures.',
    'Match the approved light premium campaign direction while retaining the tactical-tech brand.',
    'Integrate physical artwork with believable scale, material texture, folds, light and shadow.',
    'Include digital-product visuals whenever the listing sells or promotes a digital product.'
  ],
  image_rejection_reasons: [
    'selection halos, white haze, pasted overlays or visible cut edges',
    'plastic skin, anatomy defects, stock-photo staging or impossible object interaction',
    'regenerated, distorted, simplified or unreadable product artwork',
    'an apparel-only media set for a digital-product listing',
    'placeholder assets, fabricated results or unverified compatibility claims'
  ],
  video_requirements: {
    format: 'MP4/H.264',
    duration_seconds: { min: 3, max: 15 },
    resolution: { min_width: 1920, min_height: 960 },
    aspect_ratio: '2:1',
    frame_rate: 30,
    required_content: [
      'real product or faithful interactive product interface',
      'visible cursor or touch interaction',
      'actual navigation through the key product sections',
      'verified features, formulas, files or workflow',
      'clear product identity and closing promise'
    ],
    forbidden: [
      'PowerPoint-style slideshow',
      'static image montage presented as a product walkthrough',
      'generic stock footage without product interaction',
      'fabricated functionality or unlabeled fabricated outcomes'
    ],
    exports: [
      'silent Etsy master because Etsy removes listing-video audio',
      'promotional master with original or royalty-cleared music'
    ]
  },
  mandatory_review_checks: [
    'premium_campaign_quality',
    'product_truthfulness',
    'source_asset_accuracy',
    'digital_product_coverage',
    'artifact_free_at_100_percent',
    'mobile_readability',
    'video_is_real_walkthrough',
    'etsy_export_compliance'
  ]
});

export function createVisualQualityGate(product) {
  const approval = product.visual_quality_approval;
  const required = VISUAL_QUALITY_STANDARD.mandatory_review_checks;
  const suppliedChecks = approval?.checks || {};
  const missingChecks = required.filter(check => suppliedChecks[check] !== true);
  const standardMatches = approval?.standard_id === VISUAL_QUALITY_STANDARD.standard_id;
  const approved = approval?.approved === true && standardMatches && missingChecks.length === 0;
  const explicitlyRejected = approval?.approved === false;

  return {
    standard_id: VISUAL_QUALITY_STANDARD.standard_id,
    status: approved ? 'APPROVED' : explicitlyRejected ? 'BLOCKED' : 'REQUIRES_HUMAN_REVIEW',
    publication_blocked: !approved,
    reviewer: approval?.reviewer || null,
    inspected_at: approval?.inspected_at || null,
    approved_asset_ids: approval?.approved_asset_ids || [],
    missing_checks: missingChecks,
    issues: [
      ...(approval && !standardMatches ? ['QUALITY_STANDARD_VERSION_MISMATCH'] : []),
      ...(missingChecks.length ? ['MANDATORY_VISUAL_CHECKS_INCOMPLETE'] : []),
      ...(explicitlyRejected ? ['VISUAL_ASSETS_REJECTED'] : [])
    ]
  };
}
