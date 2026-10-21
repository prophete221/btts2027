/** Minimum recent-match evidence required before publishing a team-based prediction. */
export function hasSufficientTeamStats(stats, minimumMatches = 4) {
  return Boolean(
    stats?.available === true &&
    Number.isFinite(stats.matchCount) &&
    stats.matchCount >= minimumMatches &&
    Number.isFinite(stats.avgScored) &&
    Number.isFinite(stats.avgConceded),
  )
}

/**
 * Return the mean observed BTTS rate (0–100) from available teams' recent
 * match records. This is a historical rate, not a conversion of goals scored.
 */
export function deriveFormBtts(homeStats, awayStats) {
  const rates = [homeStats, awayStats]
    .filter((stats) => stats?.available && Number.isFinite(stats?.form?.bttsRate))
    .map((stats) => stats.form.bttsRate)
    .filter((rate) => rate >= 0 && rate <= 1)
  if (!rates.length) return null
  return Math.round((rates.reduce((sum, rate) => sum + rate, 0) / rates.length) * 100)
}
