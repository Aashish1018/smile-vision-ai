const AnalysisFooter = () => (
  <div className="mt-8 border-t-2 border-black pt-6 pb-12">
    <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase mb-4">
      Disclaimer: This simulation is for illustrative purposes only and does not constitute medical advice or a guaranteed clinical outcome. Actual results may vary based on individual biological factors and adherence to treatment plans. A physical examination by a licensed dental professional is required to confirm candidacy for the treatments shown. AI-generated metrics are estimates based on provided scan data.
    </p>
    <div className="flex gap-4">
      <a href="#" className="text-[10px] font-bold underline uppercase text-slate-400 hover:text-primary transition-colors">Privacy Policy</a>
      <a href="#" className="text-[10px] font-bold underline uppercase text-slate-400 hover:text-primary transition-colors">Terms of Service</a>
    </div>
  </div>
);

export default AnalysisFooter;
