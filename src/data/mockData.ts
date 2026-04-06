// src/data/mockData.ts

// TODO: All values below to be replaced with API responses from POST /analyze

export const mockUser = {
  name: "Alex Johnson",
  email: "alex@example.com",
  // TODO: from supabase.auth.getUser()
}

export const mockScores = {
  overall: 74,
  alignment: 78,
  symmetry: 81,
  whiteness: 65,
  spacing: 70,
  gumHealth: 82,
  overbite: 88,
  toothShape: 73,
  midlineDeviation: 1.8, // mm
  // TODO: Replace with data.scores from POST /analyze response
}

export const mockJaw = {
  midlineStatus: "Near Perfect",
  occlusalStatus: "Horizontal",
  deviationMm: 1.8,
  asymmetryPct: 3.1,
  overbiteEstimate: "Mild Class I",
  // TODO: Replace with data.jaw from API
}

export const mockRecommendation = {
  matchPct: 96,
  timelineMonths: "8–12",
  summary: "Invisalign Clear Aligners combined with Professional In-Office Whitening would achieve a 96% match to the simulation.",
  treatments: ["Invisalign Clear Aligners", "Professional In-Office Whitening"],
  // TODO: Replace with data.recommendation from API
}

export const mockProgressData = [
  // TODO: Replace with historical scan data from Supabase scans table
  { date: "Jan", score: 61, predicted: null },
  { date: "Feb", score: 65, predicted: null },
  { date: "Mar", score: 68, predicted: null },
  { date: "Apr", score: 71, predicted: null },
  { date: "May", score: 74, predicted: null },
  // Predicted improvement curve (dashed)
  { date: "Jun", score: null, predicted: 77 },
  { date: "Jul", score: null, predicted: 80 },
  { date: "Aug", score: null, predicted: 83 },
]

export const mockScans = [
  // TODO: Replace with SELECT * FROM scans WHERE user_id = auth.uid() ORDER BY created_at DESC
  {
    id: "scan-001",
    date: "May 12, 2025",
    overallScore: 74,
    thumbnailUrl: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=200",
    simulationType: "Braces + Whitening",
  },
  {
    id: "scan-002",
    date: "Mar 3, 2025",
    overallScore: 68,
    thumbnailUrl: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=200",
    simulationType: "Braces",
  },
]

export const mockDoctors = [
  // TODO: Replace with real clinic/doctor directory from database
  {
    id: "doc-001",
    name: "Dr. Priya Sharma",
    specialty: "Orthodontist",
    clinic: "SmileCare Dental",
    location: "Mumbai, Maharashtra",
    rating: 4.9,
    reviews: 134,
    avatarUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100",
  },
  {
    id: "doc-002",
    name: "Dr. Rahul Mehta",
    specialty: "Cosmetic Dentist",
    clinic: "PearlDent Clinic",
    location: "Mumbai, Maharashtra",
    rating: 4.7,
    reviews: 89,
    avatarUrl: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100",
  },
  {
    id: "doc-003",
    name: "Dr. Ananya Iyer",
    specialty: "Periodontist",
    clinic: "Gum & Smile Centre",
    location: "Thane, Maharashtra",
    rating: 4.8,
    reviews: 62,
    avatarUrl: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=100",
  },
]
