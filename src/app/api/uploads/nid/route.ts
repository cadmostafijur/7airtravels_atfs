import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireApiSession } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function POST(request: Request) {
  try {
    await requireApiSession(request, "employees.write");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("Choose an NID image or PDF to upload.", 400);
    }
    if (!ALLOWED.has(file.type)) {
      throw new AppError("NID must be JPG, PNG, WEBP, or PDF.", 400);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("NID file must be 5 MB or smaller.", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const name = `nid-${Date.now()}-${randomUUID().slice(0, 8)}.${EXT[file.type]}`;
    const dir = path.join(process.cwd(), "public", "uploads", "nid");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);

    return jsonOk({ url: `/uploads/nid/${name}`, fileName: name, size: file.size });
  } catch (error) {
    return jsonError(error);
  }
}
