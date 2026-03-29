function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function toScanScores({
  brightness = 70,
  maskCoverage = 0.12,
  issueFlags = {},
  issueCount = 0,
  segmentConfidence = 0.75,
}) {
  const discolorationPenalty = issueFlags.discoloration ? 16 : 0;
  const alignmentPenalty = issueFlags.misalignment ? 14 : 0;
  const spacingPenalty = issueFlags.gaps ? 12 : 0;
  const gumPenalty = issueFlags.gumIssue ? 10 : 0;
  const shapePenalty = issueFlags.chips ? 12 : 0;
  const missingPenalty = issueFlags.missingTeeth ? 18 : 0;
  const crowdingPenalty = issueFlags.crowding ? 10 : 0;

  const whiteness = Math.round(clamp(brightness - discolorationPenalty, 45, 98));
  const alignment = Math.round(clamp(82 + (segmentConfidence - 0.5) * 20 - alignmentPenalty - crowdingPenalty, 45, 98));
  const symmetry = Math.round(clamp(80 + (segmentConfidence - 0.5) * 18 - Math.abs(maskCoverage - 0.12) * 120 - crowdingPenalty, 45, 98));
  const spacing = Math.round(clamp(84 - spacingPenalty - crowdingPenalty - issueCount * 1.5, 40, 98));
  const gumHealth = Math.round(clamp(86 - gumPenalty - issueCount * 1.2, 40, 98));
  const overbite = Math.round(clamp(83 - (alignmentPenalty * 0.55) - (crowdingPenalty * 0.35), 45, 98));
  const toothShape = Math.round(clamp(85 - shapePenalty - missingPenalty - issueCount, 40, 98));
  const midlineDeviation = Math.round(clamp(0.8 + (100 - alignment) * 0.03 + (issueFlags.misalignment ? 0.4 : 0), 0.5, 4.5) * 10) / 10;

  const overall = Math.round(
    alignment * 0.18 +
      symmetry * 0.18 +
      whiteness * 0.12 +
      spacing * 0.12 +
      gumHealth * 0.15 +
      overbite * 0.1 +
      toothShape * 0.1 +
      Math.max(0, 100 - midlineDeviation * 15) * 0.05,
  );

  return {
    alignment,
    symmetry,
    whiteness,
    spacing,
    gumHealth,
    overbite,
    toothShape,
    midlineDeviation,
    overall,
  };
}

export function generateJawAnalysis(scores) {
  const dev = scores.midlineDeviation;
  return {
    midlineStatus: dev < 1.5 ? "Near Perfect" : dev < 2.5 ? "Slight Deviation" : "Noticeable Deviation",
    occlusalStatus: scores.overbite > 80 ? "Horizontal" : "Slight Cant",
    deviationMm: dev,
    asymmetryPct: Math.round((100 - scores.symmetry) * 0.8 * 10) / 10,
    overbiteEstimate: scores.overbite > 85 ? "Mild Class I" : scores.overbite > 70 ? "Moderate Class I" : "Class II Tendency",
  };
}

export function generateRecommendation(scores) {
  const treatments = [];
  if (scores.alignment < 80) treatments.push("Invisalign Clear Aligners");
  if (scores.whiteness < 75) treatments.push("Professional In-Office Whitening");
  if (scores.gumHealth < 75) treatments.push("Periodontal Maintenance");
  if (scores.spacing < 70) treatments.push("Dental Bonding");
  if (treatments.length === 0) treatments.push("Routine Maintenance");

  const matchPct = Math.min(99, scores.overall + Math.round((100 - scores.overall) * 0.7));
  const months = scores.overall > 80 ? "4–6" : scores.overall > 70 ? "6–10" : "8–14";

  return {
    matchPct,
    timelineMonths: months,
    treatments,
    summary: `${treatments.join(" combined with ")} would achieve a ${matchPct}% match to the simulation within ${months} months.`,
  };
}
