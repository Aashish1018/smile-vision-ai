import { useState } from "react";
import Sidebar from "@/components/analysis/Sidebar";
import TopActionBar from "@/components/analysis/TopActionBar";
import BeforeAfterSlider from "@/components/analysis/BeforeAfterSlider";
import ClinicalAssessment from "@/components/analysis/ClinicalAssessment";
import OverallScoreGauge from "@/components/analysis/OverallScoreGauge";
import JawSymmetryPanel from "@/components/analysis/JawSymmetryPanel";
import RecommendedTreatment from "@/components/analysis/RecommendedTreatment";
import AnalysisFooter from "@/components/analysis/AnalysisFooter";

const AnalysisPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden flex font-display bg-background-dark">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <TopActionBar onMenuClick={() => setSidebarOpen(true)} />

        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-ivory mb-6 md:mb-8">
          SMILE ANALYSIS
        </h1>

        <div className="grid grid-cols-12 gap-4 md:gap-6">
          <BeforeAfterSlider />

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 md:gap-6">
            <ClinicalAssessment />
            <OverallScoreGauge />
          </div>

          <JawSymmetryPanel />
          <RecommendedTreatment />
        </div>

        <AnalysisFooter />
      </main>
    </div>
  );
};

export default AnalysisPage;
