import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

const ScoreGauge = ({ score, size = 128, strokeWidth = 10 }: ScoreGaugeProps) => {
  const [mounted, setMounted] = useState(false);
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#8ca989"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? offset : circumference}
          strokeLinecap="butt"
          style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
        />
      </svg>
      <span className="absolute text-3xl font-black text-ivory">{score}</span>
    </div>
  );
};

export default ScoreGauge;
