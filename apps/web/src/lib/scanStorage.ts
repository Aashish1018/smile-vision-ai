import { supabase } from "@/lib/supabase";

export interface ScanImage {
  angle: "FRONT" | "RIGHT" | "LEFT";
  dataUrl: string;
  fileSize: number;
  width: number;
  height: number;
}

export interface ScanScores {
  alignment: number;
  symmetry: number;
  whiteness: number;
  spacing: number;
  gumHealth: number;
  overbite: number;
  toothShape: number;
  midlineDeviation: number;
  overall: number;
}

export interface JawAnalysis {
  midlineStatus: string;
  occlusalStatus: string;
  deviationMm: number;
  asymmetryPct: number;
  overbiteEstimate: string;
}

export interface Recommendation {
  matchPct: number;
  timelineMonths: string;
  treatments: string[];
  summary: string;
}

export interface AngleModelResult {
  angle: ScanImage["angle"];
  issuesList: string[];
  idealDescription: string;
  scores: ScanScores;
  jaw: JawAnalysis;
  recommendation: Recommendation;
  modelMeta?: {
    segmentConfidence?: number;
    brightness?: number;
    maskCoverage?: number;
  };
}

export interface ScanResult {
  id: string;
  date: string;
  images: ScanImage[];
  scores: ScanScores;
  jaw: JawAnalysis;
  recommendation: Recommendation;
  thumbnailUrl: string;
  simulationType: string;
  originalImage?: string;
  simulatedImage?: string;
  issuesList?: string[];
  idealDescription?: string;
  angleResults?: AngleModelResult[];
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

export function generateHeuristicScores(images: ScanImage[]): ScanScores {
  const seedStr = images.map(i => `${i.fileSize}-${i.width}-${i.height}`).join("|");
  const seed = simpleHash(seedStr);
  const rangeScore = (min: number, max: number, idx: number) => Math.round(min + seededRandom(seed, idx) * (max - min));

  const alignment = rangeScore(60, 92, 0);
  const symmetry = rangeScore(65, 95, 1);
  const whiteness = rangeScore(50, 85, 2);
  const spacing = rangeScore(55, 90, 3);
  const gumHealth = rangeScore(65, 95, 4);
  const overbite = rangeScore(70, 95, 5);
  const toothShape = rangeScore(58, 90, 6);
  const midlineDeviation = Math.round((0.5 + seededRandom(seed, 7) * 3.0) * 10) / 10;

  const overall = Math.round(
    alignment * 0.18 +
    symmetry * 0.18 +
    whiteness * 0.12 +
    spacing * 0.12 +
    gumHealth * 0.15 +
    overbite * 0.10 +
    toothShape * 0.10 +
    Math.max(0, 100 - midlineDeviation * 15) * 0.05
  );

  return { alignment, symmetry, whiteness, spacing, gumHealth, overbite, toothShape, midlineDeviation, overall };
}

export function generateJawAnalysis(scores: ScanScores): JawAnalysis {
  const dev = scores.midlineDeviation;
  return {
    midlineStatus: dev < 1.5 ? "Near Perfect" : dev < 2.5 ? "Slight Deviation" : "Noticeable Deviation",
    occlusalStatus: scores.overbite > 80 ? "Horizontal" : "Slight Cant",
    deviationMm: dev,
    asymmetryPct: Math.round((100 - scores.symmetry) * 0.8 * 10) / 10,
    overbiteEstimate: scores.overbite > 85 ? "Mild Class I" : scores.overbite > 70 ? "Moderate Class I" : "Class II Tendency",
  };
}

export function generateRecommendation(scores: ScanScores): Recommendation {
  const treatments: string[] = [];
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

// Ensure we shrink the image significantly to avoid local storage bloat
export function fileToScanImage(file: File, angle: ScanImage["angle"]): Promise<ScanImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        // Create a small thumbnail for the local UI cache so we don't freeze the browser
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let { naturalWidth: width, naturalHeight: height } = img;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const thumbDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve({ angle, dataUrl: thumbDataUrl, fileSize: file.size, width: img.naturalWidth, height: img.naturalHeight });
        } else {
          resolve({ angle, dataUrl, fileSize: file.size, width: img.naturalWidth, height: img.naturalHeight });
        }
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STORAGE_KEY = "dental_vision_scans";
const SCANS_TABLE = "smile_scans";

function getUserKey(userId: string) {
  return `${STORAGE_KEY}_${userId}`;
}

function saveLocal(userId: string, scans: ScanResult[]) {
  try {
    localStorage.setItem(getUserKey(userId), JSON.stringify(scans));
  } catch {
    if (scans.length > 1) saveLocal(userId, scans.slice(-3));
  }
}

function loadLocal(userId: string): ScanResult[] {
  try {
    const raw = localStorage.getItem(getUserKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function uploadBase64ToStorage(userId: string, base64Str: string, filename: string): Promise<string> {
  if (!base64Str || !base64Str.startsWith("data:image")) return base64Str;

  try {
    // Convert base64 to blob
    const res = await fetch(base64Str);
    const blob = await res.blob();

    // Upload to 'scans' bucket
    const filePath = `${userId}/${Date.now()}_${filename}.png`;
    const { error: uploadError } = await supabase.storage
      .from('scans')
      .upload(filePath, blob, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError);
      return base64Str; // fallback to storing inline if upload fails
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('scans').getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (err) {
    console.error("Storage convert/upload error:", err);
    return base64Str;
  }
}

export async function saveScans(userId: string, scans: ScanResult[]) {
  // Try to limit local storage to 3 items to completely avoid freezing strings
  try {
    localStorage.setItem(getUserKey(userId), JSON.stringify(scans.slice(-3)));
  } catch {
    console.warn("Local storage limit exceeded");
  }

  if (!userId || userId === "anonymous") return;

  try {
    const { data: existingRows } = await supabase
      .from(SCANS_TABLE)
      .select("scan_id")
      .eq("user_id", userId);

    const existingIds = new Set((existingRows || []).map((row) => row.scan_id));
    const missing = scans.filter((scan) => !existingIds.has(scan.id));

    if (missing.length === 0) return;

    // Offload massive base64 images from JSON payload to Supabase Storage before DB insert
    const rows = await Promise.all(missing.map(async (scan) => {
      // Clone payload
      const payloadClone = { ...scan };

      // If we have massive original/simulated images from the HF API, upload them
      if (payloadClone.originalImage && payloadClone.originalImage.length > 500) {
        payloadClone.originalImage = await uploadBase64ToStorage(userId, payloadClone.originalImage, `orig_${scan.id}`);
      }
      if (payloadClone.simulatedImage && payloadClone.simulatedImage.length > 500) {
        payloadClone.simulatedImage = await uploadBase64ToStorage(userId, payloadClone.simulatedImage, `sim_${scan.id}`);
      }

      return {
        user_id: userId,
        scan_id: scan.id,
        created_at: scan.date,
        payload: payloadClone,
        overall_score: scan.scores.overall,
        simulation_type: scan.simulationType,
      };
    }));

    await supabase.from(SCANS_TABLE).insert(rows);
  } catch (err) {
    console.error("Failed to save to supabase DB", err);
  }
}

export async function loadScans(userId: string): Promise<ScanResult[]> {
  const local = loadLocal(userId);
  if (!userId || userId === "anonymous") return local;

  try {
    const { data, error } = await supabase
      .from(SCANS_TABLE)
      .select("scan_id,created_at,payload")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error || !data) return local;

    const scanMap = new Map<string, ScanResult>();

    for (const row of data) {
      const payload = (row.payload as ScanResult) || ({} as ScanResult);
      const id = payload.id || row.scan_id;
      const existing = scanMap.get(id);
      const candidate = {
        ...payload,
        id,
        date: payload.date || row.created_at,
      } as ScanResult;

      if (!existing || new Date(candidate.date).getTime() >= new Date(existing.date).getTime()) {
        scanMap.set(id, candidate);
      }
    }

    const scans = Array.from(scanMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    saveLocal(userId, scans);
    return scans;
  } catch {
    return local;
  }
}

export async function deleteScan(userId: string, scanId: string) {
  const existing = await loadScans(userId);
  const next = existing.filter((scan) => scan.id !== scanId);
  await saveScans(userId, next);
}

export function getDashboardStatsFromScans(scans: ScanResult[]) {
  if (scans.length === 0) return null;

  const latest = scans[scans.length - 1];
  const previous = scans.length > 1 ? scans[scans.length - 2] : null;
  const bestScore = Math.max(...scans.map(s => s.scores.overall));
  const scoreDiff = previous ? latest.scores.overall - previous.scores.overall : 0;

  const progressData = scans.map(s => ({
    date: new Date(s.date).toLocaleDateString("en-US", { month: "short" }),
    score: s.scores.overall,
    predicted: null as number | null,
  }));

  const lastScore = latest.scores.overall;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const lastMonth = new Date(latest.date).getMonth();
  for (let i = 1; i <= 3; i++) {
    progressData.push({ date: monthNames[(lastMonth + i) % 12], score: null as number | null, predicted: Math.min(99, lastScore + i * 3) });
  }

  return {
    latest,
    scans,
    bestScore,
    scoreDiff,
    progressData,
    topRecommendation: latest.recommendation.treatments[0] || "Routine Care",
  };
}
