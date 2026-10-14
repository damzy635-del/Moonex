import test from "node:test";
import assert from "node:assert/strict";
import { MAX_IMAGE_BYTES, MAX_IMAGE_COUNT, MAX_TOTAL_IMAGE_BYTES, validateVisionImages } from "../server/vision-input.ts";

const image = (data = "AQID", mimeType = "image/png") => ({ data, mimeType });

test("accepts supported image MIME types and valid base64", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
    const result = validateVisionImages([image("AQID", mime)]);
    assert.equal(result.error, undefined);
    assert.equal(result.images[0].mimeType, mime);
  }
});

test("rejects malformed payloads, unsupported types, and invalid base64", () => {
  assert.match(validateVisionImages("nope").error ?? "", /array/);
  assert.match(validateVisionImages([{}]).error ?? "", /MIME type/);
  assert.match(validateVisionImages([image("AQ=Z")]).error ?? "", /base64/);
  assert.match(validateVisionImages([image("AQID", "image/svg+xml")]).error ?? "", /JPEG/);
});

test("enforces image count, per-image size, and aggregate size limits", () => {
  assert.equal(MAX_IMAGE_COUNT, 4);
  assert.equal(MAX_IMAGE_BYTES, 1_000_000);
  assert.equal(MAX_TOTAL_IMAGE_BYTES, 3_000_000);
  assert.match(validateVisionImages(Array.from({ length: 5 }, () => image())).error ?? "", /no more than 4/);
  const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1).toString("base64");
  assert.match(validateVisionImages([image(oversized)]).error ?? "", /no larger than 1 MB/);
  const chunk = Buffer.alloc(800_000).toString("base64");
  assert.match(validateVisionImages([image(chunk), image(chunk), image(chunk), image(chunk)]).error ?? "", /Combined image size/);
});

test("empty images are valid for text profiles but zero-byte image data is rejected", () => {
  assert.deepEqual(validateVisionImages(undefined), { images: [] });
  assert.match(validateVisionImages([image("")]).error ?? "", /base64/);
});
