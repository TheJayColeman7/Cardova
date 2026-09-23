import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import type { IncomingMessage } from "node:http";
import { ImageUploadError, MAX_IMAGE_BYTES, parseCardImage } from "./imageUpload.js";

function asRequest(body: Buffer, contentType: string): IncomingMessage {
  const stream = Readable.from([body]);
  return Object.assign(stream, {
    headers: {
      "content-type": contentType,
      "content-length": String(body.length),
    },
  }) as IncomingMessage;
}

function multipart(parts: Array<{ name: string; filename?: string; type?: string; body: Buffer }>) {
  const boundary = "----shcboundary";
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`
      : `Content-Disposition: form-data; name="${part.name}"`;
    chunks.push(
      Buffer.from(`--${boundary}\r\n${disposition}\r\n${part.type ? `Content-Type: ${part.type}\r\n` : ""}\r\n`)
    );
    chunks.push(part.body);
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11]);

describe("parseCardImage", () => {
  it("accepts one JPEG part", async () => {
    const form = multipart([{ name: "image", filename: "card.jpg", type: "image/jpeg", body: jpeg }]);
    const image = await parseCardImage(asRequest(form.body, form.contentType));
    assert.equal(image.mimeType, "image/jpeg");
    assert.equal(image.bytes.length, jpeg.length);
  });

  it("rejects a MIME type that is not jpeg, png, or webp", async () => {
    const form = multipart([{ name: "image", filename: "card.gif", type: "image/gif", body: Buffer.from("GIF89a") }]);
    await assert.rejects(parseCardImage(asRequest(form.body, form.contentType)), (error: unknown) => {
      assert.ok(error instanceof ImageUploadError);
      assert.equal(error.code, "unsupported_type");
      return true;
    });
  });

  it("rejects a file whose bytes do not match the declared type", async () => {
    const form = multipart([
      { name: "image", filename: "card.jpg", type: "image/jpeg", body: Buffer.from("not a jpeg") },
    ]);
    await assert.rejects(parseCardImage(asRequest(form.body, form.contentType)), (error: unknown) => {
      assert.ok(error instanceof ImageUploadError);
      assert.equal(error.code, "unsupported_type");
      return true;
    });
  });

  it("rejects an image over the configured limit", async () => {
    const form = multipart([{ name: "image", filename: "card.jpg", type: "image/jpeg", body: jpeg }]);
    await assert.rejects(parseCardImage(asRequest(form.body, form.contentType), 4), (error: unknown) => {
      assert.ok(error instanceof ImageUploadError);
      assert.equal(error.code, "image_too_large");
      return true;
    });
  });

  it("rejects more than one image", async () => {
    const form = multipart([
      { name: "image", filename: "a.jpg", type: "image/jpeg", body: jpeg },
      { name: "image", filename: "b.jpg", type: "image/jpeg", body: jpeg },
    ]);
    await assert.rejects(parseCardImage(asRequest(form.body, form.contentType)), (error: unknown) => {
      assert.ok(error instanceof ImageUploadError);
      assert.equal(error.code, "invalid_upload");
      return true;
    });
  });

  it("rejects malformed multipart input", async () => {
    await assert.rejects(
      parseCardImage(asRequest(Buffer.from("this is not multipart"), "multipart/form-data; boundary=----nope")),
      (error: unknown) => {
        assert.ok(error instanceof ImageUploadError);
        assert.equal(error.code, "invalid_upload");
        return true;
      }
    );
  });

  it("uses a 10 MB default limit", () => {
    assert.equal(MAX_IMAGE_BYTES, 10 * 1024 * 1024);
  });
});
