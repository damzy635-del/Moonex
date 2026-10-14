export const MAX_IMAGE_COUNT = 4;
export const MAX_IMAGE_BYTES = 1_000_000;
export const MAX_TOTAL_IMAGE_BYTES = 3_000_000;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type VisionImage = { mimeType: string; data: string };

export function validateVisionImages(value: unknown): { images: VisionImage[]; error?: string } {
  if (value === undefined) return { images: [] };
  if (!Array.isArray(value)) return { images: [], error: "Images must be provided as an array." };
  if (value.length > MAX_IMAGE_COUNT) return { images: [], error: `Attach no more than ${MAX_IMAGE_COUNT} images.` };

  const images: VisionImage[] = [];
  let totalBytes = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") return { images: [], error: "Each image must include a MIME type and base64 data." };
    const candidate = item as { mimeType?: unknown; data?: unknown };
    if (typeof candidate.mimeType !== "string") return { images: [], error: "Each image must include a MIME type." };
    if (!allowedMimeTypes.has(candidate.mimeType)) return { images: [], error: "Images must be JPEG, PNG, WebP, or GIF." };
    if (typeof candidate.data !== "string" || !candidate.data.length || candidate.data.length % 4 !== 0 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(candidate.data)) {
      return { images: [], error: "Image data must be valid base64." };
    }
    const padding = candidate.data.endsWith("==") ? 2 : candidate.data.endsWith("=") ? 1 : 0;
    const bytes = (candidate.data.length / 4) * 3 - padding;
    if (bytes <= 0 || bytes > MAX_IMAGE_BYTES) return { images: [], error: "Each image must be no larger than 1 MB." };
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) return { images: [], error: "Combined image size must not exceed 3 MB." };
    images.push({ mimeType: candidate.mimeType, data: candidate.data });
  }
  return { images };
}
