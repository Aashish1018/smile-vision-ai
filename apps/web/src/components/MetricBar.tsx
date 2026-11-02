import { useEffect, useState } from "react";

interface MetricBarProps {
  label: string;
  value: number;
  unit?: string;
  icon?: string;
  description?: string;
}

const MetricBar = ({ label, value, unit = "%", icon, description }: MetricBarProps) => {
  const [mounted, setMounted] = useState(false);
  const isPercentage = unit === "%";
  const barColor = value >= 70 ? "bg-primary" : value >= 40 ? "bg-amber-400" : "bg-red-400";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-card-dark p-5 flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {icon && <span className="material-symbols-outlined text-primary text-sm">{icon}</span>}
          <span className="text-xs font-bold text-slate-400 uppercase">{label}</span>
        </div>
        <span className="text-2xl font-black text-ivory">
          {value}{unit}
        </span>
      </div>
      {isPercentage && (
        <div className="h-1.5 bg-white/5 rounded-full mt-2">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
            style={{ width: mounted ? `${value}%` : "0%" }}
          />
        </div>
      )}
      {description && <p className="text-[10px] text-slate-600 mt-1">{description}</p>}
    </div>
  );
};

export default MetricBar;
