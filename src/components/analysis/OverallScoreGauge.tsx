import { useEffect, useState } from "react";
import { mockAnalysisData } from "@/data/mockAnalysis";

const OverallScoreGauge = () => {
  const [mounted, setMounted] = useState(false);
  const score = mockAnalysisData.scores.overall;
  const circumference = 364;
  const finalOffset = circumference * (1 - score / 100);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-card-dark flex flex-col items-center p-4 md:p-6 gap-4 grow">
      {/* TODO: Replace hardcoded score (84) with data.overallScore from API. Recalculate strokeDashoffset as: 364 * (1 - data.overallScore / 100) */}
      <div className="relative size-32 flex items-center justify-center">
        <svg className="size-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="58" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
          <circle
            cx="64" cy="64" r="58" fill="transparent"
            stroke="#8ca989"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={mounted ? finalOffset : circumference}
            strokeLinecap="butt"
            style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
          />
        </svg>
        <span className="absolute text-3xl font-black text-ivory">{score}</span>
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-ivory">OVERALL SMILE SCORE</span>
      <span className="text-[10px] font-bold underline text-slate-400 mt-2 cursor-pointer">View detailed stats</span>
    </div>
  );
};

export default OverallScoreGauge;
