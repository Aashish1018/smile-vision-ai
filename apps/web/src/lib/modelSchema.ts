import { z } from "zod";
import type { ScanResult, ScanScores } from "@/lib/scanStorage";

const scoreNumber = z.number().min(0).max(100);

const scanScoresSchema = z.object({
  alignment: scoreNumber,
  symmetry: scoreNumber,
  whiteness: scoreNumber,
  spacing: scoreNumber,
  gumHealth: scoreNumber,
  overbite: scoreNumber,
  toothShape: scoreNumber,
  midlineDeviation: z.number().min(0).max(10),
  overall: scoreNumber,
});

const apiSimulationResultSchema = z.object({
  success: z.literal(true),
  simulatedImage: z.string().min(10),
  originalImage: z.string().min(10),
  issuesList: z.array(z.string().min(1)).max(20),
  idealDescription: z.string().min(5),
  scores: scanScoresSchema,
  jaw: z.object({
    midlineStatus: z.string().min(1),
    occlusalStatus: z.string().min(1),
    deviationMm: z.number().min(0).max(10),
    asymmetryPct: z.number().min(0).max(100),
    overbiteEstimate: z.string().min(1),
  }),
  recommendation: z.object({
    matchPct: z.number().min(0).max(100),
    timelineMonths: z.string().min(1),
    treatments: z.array(z.string().min(1)).min(1),
    summary: z.string().min(1),
  }),
  modelMeta: z.object({
    segmentConfidence: z.number().min(0).max(1).optional(),
    brightness: z.number().min(0).max(100).optional(),
    maskCoverage: z.number().min(0).max(1).optional(),
    endpoint: z.string().url().optional(),
    proxyEnabled: z.boolean().optional(),
    diagnostics: z.array(z.object({
      task: z.string().min(1),
      model: z.string().min(1),
      status: z.enum(["success", "failed", "fallback"]),
      message: z.string().min(1).optional(),
      statusCode: z.number().int().optional(),
      endpoint: z.string().min(1).optional(),
      type: z.string().min(1).optional(),
    })).optional(),
  }).optional(),
});

export type ApiSimulationResult = z.infer<typeof apiSimulationResultSchema>;

export function parseApiSimulationResult(payload: unknown): ApiSimulationResult {
  return apiSimulationResultSchema.parse(payload);
}

export function averageScores(items: ScanScores[]): ScanScores {
  const fields: (keyof ScanScores)[] = ["alignment", "symmetry", "whiteness", "spacing", "gumHealth", "overbite", "toothShape", "midlineDeviation", "overall"];
  const output = {} as ScanScores;

  for (const field of fields) {
    const total = items.reduce((sum, row) => sum + row[field], 0);
    output[field] = Number((total / items.length).toFixed(field === "midlineDeviation" ? 1 : 0));
  }

  return output;
}

export function mergeModelRecommendations(
  results: Array<Pick<ApiSimulationResult, "recommendation">>,
): ScanResult["recommendation"] {
  const treatments = [...new Set(results.flatMap((result) => result.recommendation.treatments))];
  const matchPct = Math.round(results.reduce((sum, result) => sum + result.recommendation.matchPct, 0) / results.length);
  const timelineMonths = results[0]?.recommendation.timelineMonths || "6–10";

  return {
    matchPct,
    timelineMonths,
    treatments: treatments.length ? treatments : ["Routine Maintenance"],
    summary: `Combined model recommendation from ${results.length} view(s): ${treatments.join(", ")}.`,
  };
}
