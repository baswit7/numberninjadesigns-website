(function exposeCatalog(global) {
  "use strict";

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function freezeChild(key) {
      deepFreeze(value[key]);
    });
    return Object.freeze(value);
  }

  global.NumberNinjaCatalog = deepFreeze(
  {
    "products": [
      {
        "id": "budget-planner-basic",
        "slug": "budget-planner-basic",
        "productId": "numberninja-budget-planner-v1",
        "sku": "NND-DIG-FIN-001",
        "version": "1.0.1",
        "name": "Budget Planner",
        "status": "available",
        "statusLabel": "Available on Etsy",
        "type": "Excel workbook",
        "shortDescription": "An offline Excel budget planner for income and expense tracking, plan-versus-actual budgeting, savings goals, and a 12-month cash-flow dashboard.",
        "targetAudience": "households, couples, and budget-conscious individuals",
        "features": [
          "Income and expense tracking",
          "Plan versus actual monthly budget",
          "Savings goal progress",
          "12-month cash-flow dashboard",
          "Built-in model checks",
          "Privacy-safe offline workflow"
        ],
        "sheets": [
          "Start",
          "Setup",
          "Transactions",
          "Monthly Budget",
          "Savings Goals",
          "Dashboard",
          "Checks"
        ],
        "formulaFamilies": [
          "SUM",
          "SUMIFS",
          "COUNTIF",
          "IF"
        ],
        "compatibility": [
          "Microsoft Excel 2021 or later on Windows"
        ],
        "availability": "etsy-download",
        "detailHref": "budget-planner-basic.html",
        "pricingRationale": "Seller-defined introductory launch price; not derived from marketplace sales, demand, conversion, or revenue evidence.",
        "ownerPricing": {
          "strategy": "FIXED_LAUNCH",
          "amount": 12.95,
          "currency": "EUR",
          "discountFloor": 8.95,
          "basis": "owner-hypothesis",
          "marketDataUsed": false
        },
        "cta": {
          "label": "Buy on Etsy",
          "href": "https://www.etsy.com/listing/4545099893/monthly-budget-planner-spreadsheet"
        }
      },
      {
        "id": "debt-payoff-tracker",
        "slug": "debt-payoff-tracker",
        "productId": "numberninja-debt-payoff-tracker-v1",
        "sku": "NND-DIG-FIN-002",
        "version": "1.0.1",
        "name": "Debt Payoff Tracker",
        "status": "available",
        "statusLabel": "Available on Etsy",
        "type": "Excel workbook",
        "shortDescription": "An offline Excel debt tracker for balances, APR, planned payments, payment history, and payoff progress.",
        "targetAudience": "people organizing debt balances and planned payments",
        "features": [
          "Balance and APR overview",
          "Minimum plus extra payment planning",
          "Principal and interest payment log",
          "Payoff progress dashboard",
          "Payment sustainability checks",
          "Privacy-safe offline workflow"
        ],
        "sheets": [
          "Start",
          "Debts",
          "Payment Log",
          "Dashboard",
          "Checks"
        ],
        "formulaFamilies": [
          "SUM",
          "SUMIFS",
          "COUNTIF",
          "IF"
        ],
        "compatibility": [
          "Microsoft Excel 2021 or later on Windows"
        ],
        "availability": "etsy-download",
        "detailHref": "debt-payoff-tracker.html",
        "pricingRationale": "Seller-defined introductory launch price; not derived from marketplace sales, demand, conversion, or revenue evidence.",
        "ownerPricing": {
          "strategy": "FIXED_LAUNCH",
          "amount": 9.95,
          "currency": "EUR",
          "discountFloor": 7.45,
          "basis": "owner-hypothesis",
          "marketDataUsed": false
        },
        "cta": {
          "label": "Buy on Etsy",
          "href": "https://www.etsy.com/listing/4545117926/debt-snowball-tracker-spreadsheet-payoff"
        }
      },
      {
        "id": "net-worth-tracker",
        "slug": "net-worth-tracker",
        "productId": "numberninja-net-worth-tracker-v1",
        "sku": "NND-DIG-FIN-003",
        "version": "1.0.1",
        "name": "Net Worth Tracker",
        "status": "available",
        "statusLabel": "Available on Etsy",
        "type": "Excel workbook",
        "shortDescription": "An offline Excel net-worth tracker for assets, liabilities, monthly history, and long-term progress.",
        "targetAudience": "individuals tracking assets, liabilities, and net worth over time",
        "features": [
          "Asset value overview",
          "Liability balance overview",
          "Monthly net-worth history",
          "Net-worth trend dashboard",
          "Built-in integrity checks",
          "Privacy-safe offline workflow"
        ],
        "sheets": [
          "Start",
          "Assets",
          "Liabilities",
          "History",
          "Dashboard",
          "Checks"
        ],
        "formulaFamilies": [
          "SUM",
          "SUMIFS",
          "COUNTIF",
          "IF"
        ],
        "compatibility": [
          "Microsoft Excel 2021 or later on Windows"
        ],
        "availability": "etsy-download",
        "detailHref": "net-worth-tracker.html",
        "pricingRationale": "Seller-defined introductory launch price; not derived from marketplace sales, demand, conversion, or revenue evidence.",
        "ownerPricing": {
          "strategy": "FIXED_LAUNCH",
          "amount": 8.95,
          "currency": "EUR",
          "discountFloor": 6.75,
          "basis": "owner-hypothesis",
          "marketDataUsed": false
        },
        "cta": {
          "label": "Buy on Etsy",
          "href": "https://www.etsy.com/listing/4545099579/net-worth-tracker-spreadsheet-assets"
        }
      }
    ],
    "liveListingSync": {
      "shopUrl": "https://www.etsy.com/shop/NumberNinjaDesigns",
      "observedAt": "2026-08-02",
      "observedMarket": "NL",
      "currency": "EUR",
      "listingCount": 10,
      "priceNote": "Public Etsy prices observed in the Netherlands; Etsy may localize currency, tax, and the final checkout total."
    },
    "liveListings": [
      {
        "listingId": "4545118638",
        "name": "Family Budget Binder",
        "title": "Family Budget Binder Spreadsheet | Household Income, Shared Expenses and Bill Split | Excel Digital Download",
        "category": "Budget Planners",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": 1,
        "priceDisplay": "€ 30,24",
        "url": "https://www.etsy.com/listing/4545118638/",
        "image": "https://i.etsystatic.com/67071325/r/il/b8d78d/8377800459/il_800x800.8377800459_o7ih.jpg"
      },
      {
        "listingId": "4545117498",
        "name": "Dividend Tracker",
        "title": "Dividend Tracker Spreadsheet | Passive Income Goal and Distribution Log | Excel Portfolio Organizer Digital Download",
        "category": "Investing & Net Worth",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": 2,
        "priceDisplay": "€ 18,14",
        "url": "https://www.etsy.com/listing/4545117498/",
        "image": "https://i.etsystatic.com/67071325/r/il/c1cd45/8329905536/il_800x800.8329905536_9frn.jpg"
      },
      {
        "listingId": "4545117926",
        "name": "Debt Snowball Tracker",
        "title": "Debt Snowball Tracker Spreadsheet | Payoff Plan, Payment Log and Progress Dashboard | Excel Digital Download",
        "category": "Debt Payoff",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": 3,
        "priceDisplay": "€ 14,51",
        "url": "https://www.etsy.com/listing/4545117926/",
        "image": "https://i.etsystatic.com/67071325/r/il/7f9775/8329908914/il_800x800.8329908914_6wao.jpg"
      },
      {
        "listingId": "4545118486",
        "name": "Wedding Budget",
        "title": "Wedding Budget Spreadsheet | Vendor Cost, Payment and Expense Tracker | Excel Event Planner Digital Download",
        "category": "Weddings & Events",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": 4,
        "priceDisplay": "€ 10,88",
        "url": "https://www.etsy.com/listing/4545118486/",
        "image": "https://i.etsystatic.com/67071325/r/il/64186d/8329912662/il_800x800.8329912662_tuw5.jpg"
      },
      {
        "listingId": "4545118344",
        "name": "Small Business Profit & Loss",
        "title": "Small Business Profit Loss Spreadsheet | Excel Monthly Revenue Expense Tracker (Digital Download)",
        "category": "Business Finance",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": 5,
        "priceDisplay": "€ 21,77",
        "url": "https://www.etsy.com/listing/4545118344/",
        "image": "https://i.etsystatic.com/67071325/r/il/217b2b/8377796795/il_800x800.8377796795_a7mu.jpg"
      },
      {
        "listingId": "4545100025",
        "name": "Focus-Friendly Budget Planner",
        "title": "Focus-Friendly Budget Planner | Simple Weekly Spending and Bill Tracker Spreadsheet | Excel Digital Download",
        "category": "Budget Planners",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": null,
        "priceDisplay": "€ 12,09",
        "url": "https://www.etsy.com/listing/4545100025/",
        "image": "https://i.etsystatic.com/67071325/r/il/1e2c07/8377789963/il_800x800.8377789963_6695.jpg"
      },
      {
        "listingId": "4545099893",
        "name": "Monthly Budget Planner",
        "title": "Monthly Budget Planner Spreadsheet | Income, Expense and Cash Flow Tracker | Excel Household Digital Download",
        "category": "Budget Planners",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": null,
        "priceDisplay": "€ 12,09",
        "url": "https://www.etsy.com/listing/4545099893/",
        "image": "https://i.etsystatic.com/67071325/r/il/070da2/8329902164/il_800x800.8329902164_6zx8.jpg"
      },
      {
        "listingId": "4545099579",
        "name": "Net Worth Tracker",
        "title": "Net Worth Tracker Spreadsheet | Assets, Liabilities and Monthly Wealth Dashboard | Excel Finance Digital Download",
        "category": "Investing & Net Worth",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": null,
        "priceDisplay": "€ 15,72",
        "url": "https://www.etsy.com/listing/4545099579/",
        "image": "https://i.etsystatic.com/67071325/r/il/f1ade9/8329900650/il_800x800.8329900650_1spd.jpg"
      },
      {
        "listingId": "4545117616",
        "name": "Small Business Expense Tracker",
        "title": "Small Business Expense Tracker | Income, Profit and Category Summary Spreadsheet | Excel Bookkeeping Download",
        "category": "Business Finance",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": null,
        "priceDisplay": "€ 26,61",
        "url": "https://www.etsy.com/listing/4545117616/",
        "image": "https://i.etsystatic.com/67071325/r/il/d8fc24/8377793211/il_800x800.8377793211_cj73.jpg"
      },
      {
        "listingId": "4545099189",
        "name": "FIRE Retirement Planner",
        "title": "FIRE Retirement Planner Spreadsheet | Financial Independence Assets, Expenses and Withdrawal Rate | Excel Download",
        "category": "Investing & Net Worth",
        "kind": "Digital download",
        "status": "live",
        "featuredRank": null,
        "priceDisplay": "€ 36,29",
        "url": "https://www.etsy.com/listing/4545099189/",
        "image": "https://i.etsystatic.com/67071325/r/il/65fd1d/8329898936/il_800x800.8329898936_mb4e.jpg"
      }
    ],
    "bundles": [
      {
        "id": "finance-bundle",
        "name": "Finance Bundle",
        "statusLabel": "Coming soon"
      },
      {
        "id": "excel-bundle",
        "name": "Excel Bundle",
        "statusLabel": "Coming soon"
      },
      {
        "id": "data-analyst-bundle",
        "name": "Data Analyst Bundle",
        "statusLabel": "Coming soon"
      }
    ],
    "resources": []
  }
  );
})(window);
