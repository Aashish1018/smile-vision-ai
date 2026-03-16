// Local scan storage + heuristic scoring engine
// Stores scan data per user in localStorage
import { supabase } from "./supabase";

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
  midlineDeviation: number; // mm
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

export interface ScanResult {
  id: string;
  date: string;
  images: ScanImage[];
  scores: ScanScores;
  jaw: JawAnalysis;
  recommendation: Recommendation;
  thumbnailUrl: string;
  simulationType: string;
}

// Deterministic hash from string to produce consistent-per-image scores
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Seeded random from hash
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000;
  return x - Math.floor(x);
}

// Generate heuristic scores from image properties
export function generateHeuristicScores(images: ScanImage[]): ScanScores {
  // Use combined image data as seed for deterministic but unique scores
  const seedStr = images.map(i => `${i.fileSize}-${i.width}-${i.height}`).join("|");
  const seed = simpleHash(seedStr);

  const rangeScore = (min: number, max: number, idx: number) =>
    Math.round(min + seededRandom(seed, idx) * (max - min));

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

// File to dataUrl with dimensions
export function fileToScanImage(file: File, angle: ScanImage["angle"]): Promise<ScanImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          angle,
          dataUrl,
          fileSize: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STORAGE_KEY = "dental_vision_scans";

function getUserKey(userId: string) {
  return `${STORAGE_KEY}_${userId}`;
}

// Helper to convert base64 data URL to Blob
function dataURLtoBlob(dataurl: string) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export async function saveScansAsync(userId: string, scans: ScanResult[]): Promise<void> {
  // To avoid re-uploading and performance issues, we only process the LAST scan
  // if it was just added. (In reality, it's better to just pass the single new scan,
  // but to match the existing signature without breaking too much:)
  const newScan = scans[scans.length - 1];
  if (!newScan) return;

  // Create a deep copy to modify
  const scanToSave = JSON.parse(JSON.stringify(newScan)) as ScanResult;

  // Upload images to Supabase Storage if they are base64
  for (let i = 0; i < scanToSave.images.length; i++) {
    const img = scanToSave.images[i];
    if (img.dataUrl.startsWith('data:image')) {
      try {
        const blob = dataURLtoBlob(img.dataUrl);
        const fileName = `${userId}/${scanToSave.id}/${img.angle}.jpg`;
        const { error } = await supabase.storage.from('scans').upload(fileName, blob, {
          upsert: true,
          contentType: blob.type
        });
        if (error) {
          console.error("Error uploading to storage:", error);
        } else {
          // Get public URL
          const { data: publicUrlData } = supabase.storage.from('scans').getPublicUrl(fileName);
          scanToSave.images[i].dataUrl = publicUrlData.publicUrl;
        }
      } catch (e) {
        console.error("Failed to upload image blob", e);
      }
    }
  }

  // Handle thumbnailUrl
  if (scanToSave.thumbnailUrl.startsWith('data:image')) {
    try {
      const blob = dataURLtoBlob(scanToSave.thumbnailUrl);
      const fileName = `${userId}/${scanToSave.id}/thumbnail.jpg`;
      const { error } = await supabase.storage.from('scans').upload(fileName, blob, {
        upsert: true,
        contentType: blob.type
      });
      if (!error) {
        const { data: publicUrlData } = supabase.storage.from('scans').getPublicUrl(fileName);
        scanToSave.thumbnailUrl = publicUrlData.publicUrl;
      }
    } catch (e) {
      console.error("Failed to upload thumbnail blob", e);
    }
  }

  // Save the modified scan (with URLs instead of base64) to database
  const { error } = await supabase
    .from("scans")
    .upsert({ id: scanToSave.id, user_id: userId, scan_data: scanToSave });

  if (error) console.error("Error saving scan to Supabase DB:", error);
}

export async function loadScansAsync(userId: string): Promise<ScanResult[]> {
  const { data, error } = await supabase
    .from("scans")
    .select("scan_data")
    .eq("user_id", userId)
    .order("created_at", { ascending: true }); // Assuming created_at exists, or we can sort by date later

  if (error) {
    console.error("Error loading scans from Supabase:", error);
    return [];
  }

  const scans = data.map(row => row.scan_data as ScanResult);
  scans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return scans;
}

export async function deleteScanAsync(userId: string, scanId: string): Promise<boolean> {
  // First, get the scan to find associated storage files
  const { data: scanData, error: fetchError } = await supabase
    .from("scans")
    .select("scan_data")
    .eq("id", scanId)
    .eq("user_id", userId)
    .single();

  if (!fetchError && scanData) {
    // Delete associated files from storage
    const filesToRemove = [
      `${userId}/${scanId}/FRONT.jpg`,
      `${userId}/${scanId}/RIGHT.jpg`,
      `${userId}/${scanId}/LEFT.jpg`,
      `${userId}/${scanId}/thumbnail.jpg`
    ];
    await supabase.storage.from('scans').remove(filesToRemove);
  }

  const { error } = await supabase
    .from("scans")
    .delete()
    .eq("id", scanId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting scan:", error);
    return false;
  }
  return true;
}

export async function getDashboardStatsAsync(userId: string) {
  const scans = await loadScansAsync(userId);
  if (scans.length === 0) return null;

  const latest = scans[scans.length - 1];
  const previous = scans.length > 1 ? scans[scans.length - 2] : null;
  const bestScore = Math.max(...scans.map(s => s.scores.overall));
  const scoreDiff = previous ? latest.scores.overall - previous.scores.overall : 0;

  // Build progress data from actual scans
  const progressData = scans.map(s => ({
    date: new Date(s.date).toLocaleDateString("en-US", { month: "short" }),
    score: s.scores.overall,
    predicted: null as number | null,
  }));

  // Add predicted improvement
  const lastScore = latest.scores.overall;
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const lastMonth = new Date(latest.date).getMonth();
  for (let i = 1; i <= 3; i++) {
    progressData.push({
      date: monthNames[(lastMonth + i) % 12],
      score: null as number | null,
      predicted: Math.min(99, lastScore + i * 3),
    });
  }

  // Top recommendation
  const topRec = latest.recommendation.treatments[0] || "Routine Care";

  return {
    latest,
    scans,
    bestScore,
    scoreDiff,
    progressData,
    topRecommendation: topRec,
  };
}

export function saveScans(userId: string, scans: ScanResult[]) {
  try {
    localStorage.setItem(getUserKey(userId), JSON.stringify(scans));
  } catch {
    if (scans.length > 1) {
      saveScans(userId, scans.slice(-3));
    }
  }
}

export function loadScans(userId: string): ScanResult[] {
  try {
    const raw = localStorage.getItem(getUserKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLatestScan(userId: string): ScanResult | null {
  const scans = loadScans(userId);
  return scans.length > 0 ? scans[scans.length - 1] : null;
}

export function getDashboardStats(userId: string) {
  const scans = loadScans(userId);
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
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const lastMonth = new Date(latest.date).getMonth();
  for (let i = 1; i <= 3; i++) {
    progressData.push({
      date: monthNames[(lastMonth + i) % 12],
      score: null as number | null,
      predicted: Math.min(99, lastScore + i * 3),
    });
  }

  const topRec = latest.recommendation.treatments[0] || "Routine Care";

  return {
    latest,
    scans,
    bestScore,
    scoreDiff,
    progressData,
    topRecommendation: topRec,
  };
}
