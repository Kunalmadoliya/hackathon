import { readFile } from "node:fs/promises";
import path from "node:path";

const TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;

// Serves banner images saved by the theme studio. Only names we generated are allowed.
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[file]">) {
  const { file } = await ctx.params;
  const m = /^([a-f0-9-]{36})\.(png|jpg|webp)$/.exec(file);
  if (!m) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(process.cwd(), "uploads", file));
    return new Response(buf, {
      headers: {
        "Content-Type": TYPES[m[2] as keyof typeof TYPES],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
