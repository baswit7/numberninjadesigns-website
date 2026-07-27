(function () {
  'use strict';

  function byGradeThenScore(a, b) {
    const gradeRank = { A: 0, B: 1, C: 2 };
    const gradeDelta = (gradeRank[a.grade] ?? 9) - (gradeRank[b.grade] ?? 9);
    if (gradeDelta !== 0) return gradeDelta;
    return Number(b.totalScore || b.score || 0) - Number(a.totalScore || a.score || 0);
  }

  function summarizeGrades(opportunities) {
    return opportunities.reduce((acc, item) => {
      acc[item.grade] = (acc[item.grade] || 0) + 1;
      return acc;
    }, { A: 0, B: 0, C: 0 });
  }

  window.MarketScoring = {
    byGradeThenScore,
    summarizeGrades
  };
})();
