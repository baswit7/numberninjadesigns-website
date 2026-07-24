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
        "status": "coming-soon",
        "statusLabel": "Coming soon",
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
        "availability": "preview-only",
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
          "label": "View product preview",
          "href": "budget-planner-basic.html"
        }
      },
      {
        "id": "debt-payoff-tracker",
        "slug": "debt-payoff-tracker",
        "productId": "numberninja-debt-payoff-tracker-v1",
        "sku": "NND-DIG-FIN-002",
        "version": "1.0.1",
        "name": "Debt Payoff Tracker",
        "status": "coming-soon",
        "statusLabel": "Coming soon",
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
        "availability": "preview-only",
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
          "label": "View product preview",
          "href": "debt-payoff-tracker.html"
        }
      },
      {
        "id": "net-worth-tracker",
        "slug": "net-worth-tracker",
        "productId": "numberninja-net-worth-tracker-v1",
        "sku": "NND-DIG-FIN-003",
        "version": "1.0.1",
        "name": "Net Worth Tracker",
        "status": "coming-soon",
        "statusLabel": "Coming soon",
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
        "availability": "preview-only",
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
          "label": "View product preview",
          "href": "net-worth-tracker.html"
        }
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
