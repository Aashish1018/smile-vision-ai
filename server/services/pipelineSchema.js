import { z } from "zod";

const scoreNumber = z.number().min(0).max(100);

export const scanScoresSchema = z.object({
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

export const jawAnalysisSchema = z.object({
  midlineStatus: z.string().min(1),
  occlusalStatus: z.string().min(1),
  deviationMm: z.number().min(0).max(10),
  asymmetryPct: z.number().min(0).max(100),
  overbiteEstimate: z.string().min(1),
});

export const recommendationSchema = z.object({
  matchPct: z.number().min(0).max(100),
  timelineMonths: z.string().min(1),
  treatments: z.array(z.string().min(1)).min(1),
  summary: z.string().min(1),
});

export const issueFlagsSchema = z.object({
  discoloration: z.boolean(),
  gaps: z.boolean(),
  chips: z.boolean(),
  misalignment: z.boolean(),
  crowding: z.boolean(),
  missingTeeth: z.boolean(),
  gumIssue: z.boolean(),
});

export const issueExtractionSchema = z.object({
  issuesList: z.array(z.string().min(3)).max(12),
  issueFlags: issueFlagsSchema,
});

export const pipelineResultSchema = z.object({
  simulatedImage: z.string().min(10),
  originalImage: z.string().min(10),
  issuesList: z.array(z.string()),
  idealDescription: z.string().min(5),
  scores: scanScoresSchema,
  jaw: jawAnalysisSchema,
  recommendation: recommendationSchema,
  modelMeta: z.object({
    segmentConfidence: z.number().min(0).max(1),
    brightness: z.number().min(0).max(100),
    maskCoverage: z.number().min(0).max(1),
    endpoint: z.string().url().optional(),
    proxyEnabled: z.boolean().optional(),
    diagnostics: z.array(z.object({
      task: z.string().min(1),
      model: z.string().min(1),
      status: z.enum(["success", "failed", "fallback"]),
      message: z.string().min(1).optional(),
      statusCode: z.number().int().optional(),
      endpoint: z.string().optional(),
      type: z.string().optional(),
    })).optional(),
  }),
});
