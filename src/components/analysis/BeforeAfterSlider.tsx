import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";

const BeforeAfterSlider = () => (
  <div className="col-span-12 lg:col-span-8 border-2 border-black bg-primary/20 p-1">
    <div className="bg-transparent border-b-2 border-black p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-0">
      <span className="text-base md:text-lg font-black uppercase text-ivory">BEFORE & AFTER TRANSFORMATION</span>
      <div className="flex gap-2">
        <span className="bg-card-dark text-ivory text-[10px] font-bold uppercase px-2 py-1">FULL HD</span>
        <span className="bg-black text-white text-[10px] font-bold uppercase px-2 py-1">AI ENHANCED</span>
      </div>
    </div>

    {/* TODO: Replace placeholder images with actual user-uploaded photo (itemOne) and ML-processed result (itemTwo) from FastAPI /analyze endpoint */}
    <div aria-label="Before and after transformation comparison slider" role="region">
      <ReactCompareSlider
        itemOne={
          <div className="relative w-full h-full">
          <ReactCompareSliderImage
            src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800"
            alt="Original smile"
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
          <span className="absolute bottom-4 left-4 bg-black text-white px-3 py-1 text-[10px] font-bold uppercase">ORIGINAL</span>
        </div>
      }
      itemTwo={
        <div className="relative w-full h-full">
          <ReactCompareSliderImage
            src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800"
            alt="Simulated smile with braces"
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
          <span className="absolute bottom-4 right-4 bg-primary text-white px-3 py-1 border border-black text-[10px] font-bold uppercase">SIMULATION</span>
        </div>
      }
      style={{ width: "100%", aspectRatio: "16/9" }}
      handle={
          <div className="bg-card-dark border-2 border-black p-1 flex items-center justify-center h-full">
            <span className="material-symbols-outlined text-ivory text-sm" aria-hidden="true">unfold_more_double</span>
          </div>
        }
      />
    </div>
  </div>
);

export default BeforeAfterSlider;
