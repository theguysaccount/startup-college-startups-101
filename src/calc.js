// Calculators for learning, not advice: runway, and a simplified SAFE + priced-round ownership estimate.
// Pure functions; the pages and the tests use the same code.

/** Runway: months of cash at the current net burn, and how much to raise to reach a milestone with a buffer. */
export function runway({ cash = 0, monthlyCosts = 0, monthlyRevenue = 0, monthsToMilestone = 18, bufferMonths = 6 } = {}) {
  const burn = Math.max(0, monthlyCosts - monthlyRevenue);
  const months = burn > 0 ? cash / burn : Infinity;
  const needed = burn * (monthsToMilestone + bufferMonths);
  return { burn, months, toRaise: Math.max(0, needed - cash) };
}

/**
 * Ownership after post-money SAFEs and then a priced round, as fractions of the company.
 * Simplified model (stated on the page):
 *  - each post-money SAFE owns amount ÷ post-money cap of the company just before the priced round;
 *  - founders and the existing option pool share what is left, in proportion;
 *  - new investors in the priced round own investment ÷ post-money valuation; everyone else is diluted pro rata;
 *  - a target option pool (a share of the post-money company) is topped up before the round and comes out of the
 *    founders' share, which is how post-money SAFEs commonly treat a pool increase in the priced round.
 * Real conversions depend on the documents (caps vs. the round price, discounts, pro rata rights, MFN clauses).
 */
export function safeRound({ safes = [], poolBefore = 0, round = null } = {}) {
  const safeShares = safes.map((s) => (s.cap > 0 ? s.amount / s.cap : 0));
  const safeTotal = safeShares.reduce((a, b) => a + b, 0);
  if (safeTotal + poolBefore >= 1) throw new Error("The SAFEs and the option pool add up to the whole company.");
  const rest = 1 - safeTotal;
  const before = { founders: rest * (1 - poolBefore), pool: rest * poolBefore, safes: safeShares, investors: 0 };
  if (!round || !(round.investment > 0) || !(round.postMoney > round.investment)) return { before, after: null };
  const newInv = round.investment / round.postMoney;
  const keep = 1 - newInv;
  const after = { founders: before.founders * keep, pool: before.pool * keep, safes: before.safes.map((s) => s * keep), investors: newInv };
  const target = Math.max(0, round.poolTarget || 0);
  const topUp = Math.max(0, target - after.pool);
  if (topUp > after.founders) throw new Error("The option pool target is larger than the founders' share.");
  after.founders -= topUp;
  after.pool += topUp;
  return { before, after };
}

export const pct = (x, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const money = (x) => (Number.isFinite(x) ? x.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "∞");
