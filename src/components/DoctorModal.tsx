import { useState } from "react";
import { mockDoctors } from "@/data/mockData";

interface DoctorModalProps {
  open: boolean;
  onClose: () => void;
  scanId: string;
}

const DoctorModal = ({ open, onClose, scanId }: DoctorModalProps) => {
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card-dark border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h3 className="text-lg font-black uppercase text-ivory">CONNECT WITH A DENTIST</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="p-6 pb-0 text-sm text-slate-400">
          Select a dentist below to share your scan report with them. They'll receive a link to your full analysis.
        </p>

        {/* TODO: Replace mockDoctors with real doctors fetched from SELECT * FROM doctors WHERE active = true */}
        <div className="p-6 flex flex-col gap-3">
          {mockDoctors.map((doc) => (
            <div
              key={doc.id}
              onClick={() => { setSelectedDoctor(doc.id); setShared(false); }}
              className={`flex items-center gap-4 p-4 bg-background-dark rounded-xl border transition-colors cursor-pointer ${
                selectedDoctor === doc.id ? "border-primary bg-primary/5" : "border-white/5 hover:border-primary/30"
              }`}
            >
              <img src={doc.avatarUrl} alt="" className="size-12 rounded-full object-cover border-2 border-white/10" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-ivory">{doc.name}</p>
                <p className="text-xs text-slate-500">{doc.specialty}</p>
                <p className="text-xs text-slate-600">{doc.clinic} · {doc.location}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-primary text-sm">star</span>
                  <span className="text-xs text-primary font-bold">{doc.rating}</span>
                </div>
                <p className="text-xs text-slate-600">{doc.reviews} reviews</p>
              </div>
              {selectedDoctor === doc.id && (
                <span className="material-symbols-outlined text-primary">check_circle</span>
              )}
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-white/10">
          <button
            disabled={!selectedDoctor}
            onClick={() => {
              // TODO: POST /share-with-doctor { scanId, doctorId } to FastAPI
              console.log("TODO: Share scan", scanId, "with doctor", selectedDoctor);
              setShared(true);
            }}
            className="w-full py-3 bg-primary text-white font-black text-sm rounded-xl disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            {shared ? "✓ Report Sent!" : "Send My Report to Selected Dentist"}
          </button>
          <p className="text-[10px] text-slate-600 mt-2 text-center">
            The dentist will receive a secure link to your full analysis. No personal data beyond your scan is shared.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DoctorModal;
