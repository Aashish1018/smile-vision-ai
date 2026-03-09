// TODO: Replace this entire object with the response from POST /analyze endpoint
export const mockAnalysisData = {
  scores: {
    alignment: 78,   // TODO: from API response data.scores.alignment
    symmetry: 81,    // TODO: from API response data.scores.symmetry
    whiteness: 65,   // TODO: from API response data.scores.whiteness
    overall: 84,     // TODO: from API response data.overallScore
  },
  jaw: {
    midlineStatus: "Near Perfect",   // TODO: from API data.jaw.midlineStatus
    occlusalStatus: "Horizontal",    // TODO: from API data.jaw.occlusalStatus
    deviationMm: 1.2,                // TODO: from API data.jaw.deviationMm
    asymmetryPct: 3.1,               // TODO: from API data.jaw.asymmetryPct
  },
  recommendation: {
    text: "Invisalign Clear Aligners combined with Professional In-Office Whitening would achieve this 98% match to the simulation within 7–9 months.",
    matchPct: 98,
    timelineMonths: "7–9",
    treatments: ["Invisalign Clear Aligners", "Professional In-Office Whitening"],
  },
  user: {
    name: "Dr. Sarah Wilson",        // TODO: from Supabase auth session
    role: "Lead Orthodontist",       // TODO: from users table role field
  }
};
