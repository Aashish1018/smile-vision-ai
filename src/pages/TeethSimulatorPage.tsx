import { useState } from "react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";

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
  const [progressState, setProgressState] = useState<{ step: number; message: string } | null>(null);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setResult(null);
    setError(null);
    setProgressState(null);

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
    setProgressState({ step: 0, message: "Uploading image..." });

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

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split("\n");
            let eventType = "message";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.substring(7);
              } else if (line.startsWith("data: ")) {
                data = line.substring(6);
              }
            }

            if (data) {
              const parsed = JSON.parse(data);
              if (eventType === "progress") {
                setProgressState({ step: parsed.step, message: parsed.message });
              } else if (eventType === "complete") {
                setResult(parsed);
                setLoading(false);
                setProgressState(null);
              } else if (eventType === "error") {
                throw new Error(parsed.error);
              }
            }
          }
        }
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Simulation failed";
      setError(message);
      setLoading(false);
      setProgressState(null);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10 font-sans">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Ideal Teeth Simulator</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Upload one selfie or close-up smile photo to run a 4-step ML pipeline and preview an idealized simulation.
          </p>
        </header>

        <Card className="border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]">
          <CardHeader>
            <CardTitle>Upload Photo</CardTitle>
            <CardDescription>Select a clear photo showing your teeth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="cursor-pointer"
            />

            {preview && (
              <div className="relative rounded-lg overflow-hidden border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] bg-muted/30">
                <img
                  src={preview}
                  alt="Selected upload preview"
                  className="max-h-80 w-full object-contain"
                />
              </div>
            )}

            <Button
              type="button"
              disabled={!file || loading}
              onClick={handleSimulate}
              className="w-full sm:w-auto font-bold border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Simulating..." : "Simulate"}
            </Button>

            {progressState && (
              <div className="space-y-2 mt-4">
                <div className="flex justify-between text-sm text-muted-foreground font-medium">
                  <span>Step {Math.max(1, progressState.step)}/4</span>
                  <span>{progressState.message}</span>
                </div>
                <Progress value={Math.max(5, (progressState.step / 4) * 100)} className="h-2 border" />
              </div>
            )}
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {result && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Before / After</h2>
              <div className="rounded-xl overflow-hidden border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] bg-card">
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage src={result.originalImage} alt="Original image" />}
                  itemTwo={<ReactCompareSliderImage src={result.simulatedImage} alt="Simulated image" />}
                />
              </div>
            </div>

            <div className="space-y-4">
              <Card className="border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Visible Surface Analysis</CardTitle>
                  <CardDescription className="text-amber-600 dark:text-amber-400 font-medium">
                    Not a medical diagnosis.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc ml-5 text-sm space-y-1 text-muted-foreground">
                    {result.issuesList.length > 0 ? (
                      result.issuesList.map((issue) => <li key={issue}>{issue}</li>)
                    ) : (
                      <li>No visible issues detected.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="prompt" className="border-2 rounded-lg px-4 bg-card shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]">
                  <AccordionTrigger className="font-bold hover:no-underline">
                    AI Ideal Smile Prompt
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm">
                    {result.idealDescription}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default TeethSimulatorPage;
