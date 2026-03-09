import { useNavigate } from "react-router-dom";

interface TopActionBarProps {
  onMenuClick: () => void;
}

const TopActionBar = ({ onMenuClick }: TopActionBarProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-3">
        <button className="lg:hidden bg-card-dark p-2 border border-black/20" onClick={onMenuClick}>
          <span className="material-symbols-outlined text-ivory">menu</span>
        </button>
        <button className="bg-card-dark p-2 border border-black/20" onClick={() => navigate("/")}>
          <span className="material-symbols-outlined text-ivory">arrow_back</span>
        </button>
      </div>

      <div className="flex gap-4">
        <button className="relative bg-card-dark p-2 border-2 border-black">
          <span className="material-symbols-outlined text-ivory">notifications</span>
          <span className="absolute -top-[2px] -right-[2px] size-2 bg-red-500 rounded-full border border-black" />
        </button>
        {/* TODO: implement save functionality */}
        <button className="flex items-center gap-2 px-6 py-2 bg-primary text-black border-2 border-black font-bold text-sm hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-sm">save</span>
          Save Plan
        </button>
      </div>
    </div>
  );
};

export default TopActionBar;
