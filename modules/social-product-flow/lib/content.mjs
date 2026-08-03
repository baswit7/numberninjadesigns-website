import { SCHEMA_VERSION, assert, isSafeHttpsUrl } from "./core.mjs";

const PLATFORM_LIMITS = Object.freeze({
  facebook: { title: 100, body: 2_200, hashtags: 5 },
  instagram: { title: 0, body: 2_200, hashtags: 8 },
  youtube: { title: 100, body: 5_000, hashtags: 3 },
  tiktok: { title: 0, body: 2_200, hashtags: 5 },
  pinterest: { title: 100, body: 800, hashtags: 5 },
  etsy: { title: 140, body: 0, hashtags: 0 },
  threads: { title: 0, body: 500, hashtags: 3 },
  reddit: { title: 300, body: 10_000, hashtags: 0 }
});

const PLATFORM_LINK_BEHAVIOR = Object.freeze({
  etsy: "LISTING_DESTINATION",
  facebook: "CLICKABLE_CAPTION_LINK",
  instagram: "PROFILE_LINK_CTA",
  youtube: "SHORTS_EXTERNAL_LINK_NOT_CLICKABLE",
  tiktok: "PROFILE_LINK_CTA",
  pinterest: "PIN_DESTINATION_LINK",
  threads: "CLICKABLE_POST_LINK",
  reddit: "COMMUNITY_POLICY_GATED_LINK"
});

function trimTo(value, limit) {
  if (!limit || value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function hashtags(tags, limit) {
  return tags
    .slice(0, limit)
    .map((tag) => `#${tag.replace(/[^a-z0-9]/gi, "")}`)
    .filter((tag) => tag.length > 1);
}

function productFacts(product) {
  const name = product?.catalog?.name;
  const description = product?.catalog?.shortDescription;
  const primaryKeyword = product?.seo?.primaryKeyword;
  const features = product?.workbook?.features;

  assert(name, "PRODUCT_NAME_MISSING", "Product catalog name is required.");
  assert(description, "PRODUCT_DESCRIPTION_MISSING", "Product short description is required.");
  assert(primaryKeyword, "PRODUCT_KEYWORD_MISSING", "Product primary SEO keyword is required.");
  assert(Array.isArray(features) && features.length > 0, "PRODUCT_FEATURES_MISSING", "Product features are required.");

  return {
    id: product.identity.productId,
    slug: product.identity.slug,
    version: product.productVersion,
    name,
    description,
    primaryKeyword,
    targetAudience: product.catalog.targetAudience,
    features: [...features],
    tags: [...(product.seo.tags ?? [])],
    disclosure: product.disclosures?.ai ?? null
  };
}

function baseCopy(facts) {
  const featureLine = facts.features.slice(0, 3).join(" • ");
  return {
    hook: `Your spreadsheet should do the math, not create more of it.`,
    body: `${facts.name} turns everyday money tracking into a clear offline Excel workflow. ${featureLine}.`,
    ctaWithLink: "Open the Etsy listing:",
    ctaProfile: "Find the verified Etsy link in the NumberNinjaDesigns profile.",
    proof: `Built for ${facts.targetAudience}. Requires the compatibility version stated on the product page.`
  };
}

function metadataFor(platform, facts, copy, shareAndSaveUrl) {
  const limits = PLATFORM_LIMITS[platform];
  const selectedTags = hashtags(
    [facts.primaryKeyword, ...facts.tags, "NumberNinjaDesigns"],
    limits.hashtags
  );
  const clickable = ["facebook", "pinterest", "threads", "reddit"].includes(platform);
  const linkLine = clickable && shareAndSaveUrl
    ? `${copy.ctaWithLink} ${shareAndSaveUrl}`
    : copy.ctaProfile;

  const genericBody = [copy.hook, copy.body, copy.proof, linkLine, selectedTags.join(" ")]
    .filter(Boolean)
    .join("\n\n");

  switch (platform) {
    case "youtube":
      return {
        title: trimTo(`${facts.name}: 15-second Excel workflow`, limits.title),
        description: trimTo(
          [
            copy.hook,
            copy.body,
            copy.proof,
            "Shorts descriptions do not provide a clickable external link. Use the verified channel profile link; attach a related long-form instruction video manually when eligible.",
            selectedTags.join(" ")
          ].join("\n\n"),
          limits.body
        ),
        privacyStatus: "private",
        relatedVideo: { mode: "MANUAL_AFTER_UPLOAD", videoId: null }
      };
    case "pinterest":
      return {
        title: trimTo(`${facts.name} | ${facts.primaryKeyword}`, limits.title),
        description: trimTo(genericBody, limits.body),
        link: shareAndSaveUrl,
        altText: `${facts.name} Excel workbook dashboard and planning workflow.`
      };
    case "etsy":
      return {
        title: trimTo(`${facts.name} | ${facts.primaryKeyword}`, limits.title),
        listingUrl: shareAndSaveUrl,
        audioRequired: false
      };
    case "reddit":
      return {
        title: trimTo(`I built an offline ${facts.primaryKeyword}: feedback welcome`, limits.title),
        body: trimTo(
          [
            `${copy.body}`,
            "This is a commercial product disclosure from NumberNinjaDesigns.",
            shareAndSaveUrl ? `Product link: ${shareAndSaveUrl}` : "Product link withheld until the verified Etsy link is supplied.",
            "Post only where the community rules explicitly permit self-promotion and after a human approves the exact subreddit and post."
          ].join("\n\n"),
          limits.body
        ),
        destination: null,
        communityRulesAcceptedAt: null
      };
    default:
      return {
        caption: trimTo(genericBody, limits.body),
        link: clickable ? shareAndSaveUrl : null
      };
  }
}

function coverFor(platform, facts) {
  const tiktokSourceOnly = platform === "tiktok";
  return {
    schemaVersion: SCHEMA_VERSION,
    aspectRatio: platform === "etsy" ? "2:1" : "9:16",
    dimensions: platform === "etsy" ? { width: 1920, height: 960 } : { width: 1080, height: 1920 },
    safeZone:
      platform === "etsy"
        ? { x1: 96, y1: 96, x2: 1824, y2: 864 }
        : { x1: 120, y1: 288, x2: 840, y2: 1130 },
    overlay: {
      eyebrow: tiktokSourceOnly ? null : "NUMBERNINJADESIGNS • DIGITAL PRODUCTION",
      headline: tiktokSourceOnly ? null : facts.name.toUpperCase(),
      proof: tiktokSourceOnly ? null : facts.features[0].toUpperCase()
    },
    paletteStandard: "NND-BRAND-COLOR-2026.1",
    sourceArtworkPolicy: tiktokSourceOnly
      ? "Use a clean verified product frame; do not add an app watermark or promotional branding."
      : "Use only verified product screenshots or original source artwork."
  };
}

export function buildSocialMasterPlan(product) {
  const facts = productFacts(product);
  return {
    schemaVersion: SCHEMA_VERSION,
    durationSeconds: 15,
    dimensions: { width: 1080, height: 1920 },
    frameRate: 30,
    safeZone: { x1: 120, y1: 288, x2: 840, y2: 1130 },
    truthBoundary: {
      actualProductCaptureRequired: true,
      syntheticInterfaceAllowed: false,
      originalSourceArtworkRequired: true
    },
    scenes: [
      {
        start: 0,
        end: 1.5,
        purpose: "HOOK",
        visual: "Verified Dashboard close-up with readable workbook chrome.",
        overlay: "YOUR BUDGET SHOULD CALCULATE ITSELF"
      },
      {
        start: 1.5,
        end: 5,
        purpose: "INPUT",
        visual: "Actual Transactions sheet using clearly fictional demonstration rows.",
        overlay: "TRACK INCOME + EXPENSES"
      },
      {
        start: 5,
        end: 10,
        purpose: "WORKFLOW",
        visual: "Actual Monthly Budget and Savings Goals interactions.",
        overlay: facts.features.slice(1, 3).join(" • ").toUpperCase()
      },
      {
        start: 10,
        end: 13.5,
        purpose: "RESULT",
        visual: "Actual Dashboard response and Checks sheet.",
        overlay: "PLAN • TRACK • CHECK"
      },
      {
        start: 13.5,
        end: 15,
        purpose: "CTA",
        visual: "Verified product cover beside a readable Dashboard frame.",
        overlay: `${facts.name.toUpperCase()} • ETSY`
      }
    ]
  };
}

export function buildCampaignContent({
  product,
  platforms,
  shareAndSaveUrl = null
}) {
  assert(Array.isArray(platforms) && platforms.length > 0, "PLATFORMS_MISSING", "Select at least one platform.");
  assert(
    shareAndSaveUrl === null || isSafeHttpsUrl(shareAndSaveUrl),
    "SHARE_AND_SAVE_URL_INVALID",
    "Share & Save URL must be an HTTPS URL copied from Etsy."
  );

  const facts = productFacts(product);
  const copy = baseCopy(facts);
  const uniquePlatforms = [...new Set(platforms)].sort();

  return {
    schemaVersion: SCHEMA_VERSION,
    canonical: {
      product: facts,
      shareAndSaveUrl,
      masterHook: copy.hook,
      masterBody: copy.body,
      audience: facts.targetAudience
    },
    platforms: Object.fromEntries(
      uniquePlatforms.map((platform) => {
        assert(PLATFORM_LIMITS[platform], "PLATFORM_UNSUPPORTED", `Unsupported content platform: ${platform}.`);
        return [
          platform,
          {
            linkBehavior: PLATFORM_LINK_BEHAVIOR[platform],
            metadata: metadataFor(platform, facts, copy, shareAndSaveUrl),
            cover: coverFor(platform, facts)
          }
        ];
      })
    )
  };
}
