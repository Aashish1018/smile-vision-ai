const RecommendedTreatment = () => (
  <div className="col-span-12 lg:col-span-7 border-2 border-black bg-primary/10 p-6 md:p-8 h-full flex flex-col justify-center gap-6">
    <div className="flex items-center gap-4">
      <div className="size-10 md:size-12 bg-black text-white flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-lg md:text-xl">lightbulb</span>
      </div>
      <span className="text-lg md:text-xl font-black uppercase text-ivory">RECOMMENDED TREATMENT</span>
    </div>

    {/* TODO: Replace hardcoded treatment recommendation with data.recommendation.text from API. Highlight treatment names from data.recommendation.treatments array */}
    <p className="text-sm font-medium leading-relaxed text-ivory">
      Based on your results, <span className="underline font-bold">Invisalign Clear Aligners</span> combined with{" "}
      <span className="underline font-bold">Professional In-Office Whitening</span> would achieve this 98% match to the simulation within 7–9 months.
    </p>

    <button
      className="px-8 py-3 bg-black text-white border-2 border-black font-black uppercase text-sm hover:translate-x-1 hover:-translate-y-1 transition-transform shadow-[4px_4px_0px_0px_rgba(158,193,155,1)] cursor-not-allowed opacity-80 w-fit"
      disabled
      // TODO: Implement booking flow — open modal or navigate to /book
    >
      BOOK CONSULTATION
    </button>
  </div>
);

export default RecommendedTreatment;
