import { ImageOff } from "lucide-react";
import { useApiImage } from "@/hooks/useApiImage";
import { cn } from "@/lib/utils";

export function ApiImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const { url, failed } = useApiImage(path);
  if (failed) {
    return (
      <div className={cn("flex items-center justify-center bg-muted dv-muted", className)}>
        <ImageOff size={20} />
      </div>
    );
  }
  if (!url) return <div className={cn("animate-pulse bg-muted", className)} />;
  return <img src={url} alt={alt} className={cn("object-cover", className)} />;
}
