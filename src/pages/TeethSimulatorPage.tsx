import { useMemo, useState } from "react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";

interface SimulationResult {
  success: boolean;
  simulatedImage: string;
  originalImage: string;
  issuesList: string[];
  idealDescription: string;
}

const TeethSimulatorPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progressLabel = useMemo(() => {
    if (!loading) return null;
    return "Running pipeline: segmenting teeth, analyzing ideal smile, simulating, and detecting visible issues...";
  }, [loading]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setResult(null);
    setError(null);

    if (!next) {
      setPreview(null);
      return;
    }

    setPreview(URL.createObjectURL(next));
  };

  const handleSimulate = async () => {
    if (!file) {
      setError("Please choose an image first.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/teeth/simulate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Simulation failed");
      }

      const json = (await response.json()) as SimulationResult;
      setResult(json);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Simulation failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background-dark text-ivory px-6 py-10 font-display">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Ideal Teeth Simulator</h1>
          <p className="text-slate-300 text-sm md:text-base">
            Upload one selfie or close-up smile photo to run a 4-step ML pipeline and preview an idealized simulation.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-card-dark p-5 space-y-4">
          <input
            className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white file:font-bold"
            type="file"
            accept="image/*"
            onChange={onFileChange}
          />

          {preview && (
            <img
              src={preview}
              alt="Selected upload preview"
              className="max-h-80 rounded-xl border border-white/10 object-contain w-full bg-black/20"
            />
          )}

          <button
            type="button"
            disabled={!file || loading}
            onClick={handleSimulate}
            className="rounded-lg bg-primary px-5 py-2 font-bold text-white disabled:opacity-60"
          >
            {loading ? "Simulating..." : "Simulate"}
          </button>

          {progressLabel && <p className="text-xs text-slate-300">{progressLabel}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </section>

        {result && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-xl font-black">Before / After</h2>
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage src={result.originalImage} alt="Original image" />}
                  itemTwo={<ReactCompareSliderImage src={result.simulatedImage} alt="Simulated image" />}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-card-dark p-4">
                <h3 className="text-lg font-black mb-2">Visible Surface Analysis</h3>
                <p className="text-xs text-amber-300 mb-3">Not a medical diagnosis.</p>
                <ul className="list-disc ml-5 text-sm text-slate-200 space-y-1">
                  {result.issuesList.length > 0 ? (
                    result.issuesList.map((issue) => <li key={issue}>{issue}</li>)
                  ) : (
                    <li>No visible issues detected.</li>
                  )}
                </ul>
              </div>

              <details className="rounded-2xl border border-white/10 bg-card-dark p-4">
                <summary className="cursor-pointer font-black">AI Ideal Smile Prompt</summary>
                <p className="mt-2 text-sm text-slate-200">{result.idealDescription}</p>
              </details>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default TeethSimulatorPage;
