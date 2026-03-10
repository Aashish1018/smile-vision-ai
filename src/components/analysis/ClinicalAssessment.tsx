import { mockAnalysisData } from "@/data/mockAnalysis";

const metrics = [
  { label: "ALIGNMENT", key: "alignment" as const },
  { label: "SYMMETRY", key: "symmetry" as const },
  { label: "WHITENESS", key: "whiteness" as const },
];

const ClinicalAssessment = () => (
  <div className="bg-card-dark">
    <div className="p-4 flex items-center gap-2 border-b border-black/20">
      <span className="material-symbols-outlined text-primary">clinical_notes</span>
      <span className="text-sm font-black uppercase text-ivory">CLINICAL ASSESSMENT</span>
    </div>
    <div className="p-4 md:p-6 flex flex-col gap-4">
      {/* TODO: Replace with data.scores from API response */}
      {metrics.map((m) => (
        <div key={m.key} className="flex justify-between items-end border-b border-white/10 pb-3">
          <span className="text-xs font-bold text-slate-400 uppercase">{m.label}</span>
          <span className="text-xl font-black text-ivory">{mockAnalysisData.scores[m.key]}%</span>
        </div>
      ))}
    </div>
  </div>
);

export default ClinicalAssessment;
