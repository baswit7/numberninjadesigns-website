(function () {
  'use strict';

  const state = {
    marketSignals: null,
    opportunities: null,
    recommendations: null
  };

  const el = {
    statusStrip: document.getElementById('statusStrip'),
    metrics: document.getElementById('metrics'),
    sourceHealth: document.getElementById('sourceHealth'),
    opportunities: document.getElementById('opportunities'),
    recommendations: document.getElementById('recommendations')
  };

  function setStatus(text, tone) {
    el.statusStrip.innerHTML = `<span class="dot ${tone || ''}"></span><span>${escapeHtml(text)}</span>`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function loadRuntime() {
    if (window.MarketIntelligenceRuntime) {
      return window.MarketIntelligenceRuntime;
    }

    const [marketSignals, opportunities, recommendations] = await Promise.all([
      fetch('../../runtime/market-intelligence/market-signals.report.json').then((response) => response.json()),
      fetch('../../runtime/market-intelligence/opportunities.report.json').then((response) => response.json()),
      fetch('../../runtime/market-intelligence/recommendations.report.json').then((response) => response.json())
    ]);

    return { marketSignals, opportunities, recommendations };
  }

  function renderMetrics() {
    const opportunities = state.opportunities.opportunities || [];
    const recommendations = state.recommendations.recommendations || [];
    const gradeCounts = window.MarketScoring.summarizeGrades(opportunities);
    const sourceCount = (state.marketSignals.sources || []).length;

    el.metrics.innerHTML = [
      metric('Sources', sourceCount),
      metric('A Grade', gradeCounts.A || 0),
      metric('B Grade', gradeCounts.B || 0),
      metric('Recommendations', recommendations.length)
    ].join('');
  }

  function metric(label, value) {
    return `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
  }

  function renderSources() {
    const sources = state.marketSignals.sourceStatuses || [];
    el.sourceHealth.innerHTML = sources.map((source) => `
      <article class="source">
        <strong>${escapeHtml(source.sourceId)}</strong>
        <span>status: ${escapeHtml(source.status)}</span>
        <span>method: ${escapeHtml(source.extractionMethod)}</span>
        <span>${escapeHtml(source.sourceUrl || 'no url')}</span>
      </article>
    `).join('');
  }

  function renderOpportunities() {
    const opportunities = [...(state.opportunities.opportunities || [])].sort(window.MarketScoring.byGradeThenScore);
    el.opportunities.innerHTML = opportunities.map((item) => {
      const breakdown = item.scoreBreakdown || {};
      return `
        <article class="card">
          <div class="card-top">
            <div>
              <h3>${escapeHtml(item.query)}</h3>
              <p class="muted">confidence ${escapeHtml(item.confidence)}</p>
            </div>
            <b class="grade ${escapeHtml(String(item.grade).toLowerCase())}">${escapeHtml(item.grade)}</b>
          </div>
          <div class="score">${escapeHtml(item.totalScore)}</div>
          <div class="breakdown">
            ${pill('relevance', breakdown.relevanceToNumberNinjaDesigns)}
            ${pill('intent', breakdown.commercialIntent)}
            ${pill('trend', breakdown.trendSignal)}
            ${pill('etsy', breakdown.platformFitEtsy)}
            ${pill('tiktok', breakdown.platformFitTikTok)}
          </div>
        </article>
      `;
    }).join('');
  }

  function pill(label, value) {
    return `<span class="pill">${escapeHtml(label)} ${escapeHtml(value)}</span>`;
  }

  function renderRecommendations() {
    const recommendations = state.recommendations.recommendations || [];
    el.recommendations.innerHTML = recommendations.map((item) => {
      const copyText = [
        item.designIdea,
        item.productTitleAngle,
        item.tiktokHook,
        item.tiktokCaption,
        (item.hashtagSet || []).join(' '),
        item.etsyTitle,
        (item.etsyTags || []).join(', '),
        item.pinterestTitle,
        item.pinterestDescription
      ].join('\n\n');

      return `
        <article class="card">
          <div class="card-top">
            <div>
              <h3>${escapeHtml(item.query)}</h3>
              <p class="muted">Grade ${escapeHtml(item.grade)} | score ${escapeHtml(item.score)}</p>
            </div>
          </div>
          ${field('Design idea', item.designIdea)}
          ${field('TikTok hook', item.tiktokHook)}
          ${field('Etsy title', item.etsyTitle)}
          <div class="tags">${(item.etsyTags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
          ${field('Pinterest', `${item.pinterestTitle} - ${item.pinterestDescription}`)}
          ${field('Confidence', item.confidenceReason)}
          <button class="copy" type="button" data-copy="${escapeHtml(copyText)}">Copy card</button>
        </article>
      `;
    }).join('');
  }

  function field(label, value) {
    return `<div class="field"><span>${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`;
  }

  function wireTabs() {
    document.querySelectorAll('.tab').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
        document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(`${button.dataset.view}View`).classList.add('active');
      });
    });
  }

  function wireCopy() {
    document.body.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-copy]');
      if (!button) return;
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'Copied';
      window.setTimeout(() => {
        button.textContent = 'Copy card';
      }, 1200);
    });
  }

  async function init() {
    wireTabs();
    wireCopy();
    try {
      const runtime = await loadRuntime();
      state.marketSignals = runtime.marketSignals;
      state.opportunities = runtime.opportunities;
      state.recommendations = runtime.recommendations;
      renderMetrics();
      renderSources();
      renderOpportunities();
      renderRecommendations();
      setStatus('Runtime loaded', 'ok');
    }
    catch (error) {
      setStatus('Runtime reports unavailable', 'warn');
      el.metrics.innerHTML = metric('Status', 'Run collector');
      el.sourceHealth.innerHTML = '<article class="source"><strong>No runtime data</strong><span>Run tools/market-intelligence/collect-market-signals.ps1 first.</span></article>';
    }
  }

  init();
})();
