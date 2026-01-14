export default async (request: Request, context: any) => {
  const host = new URL(request.url).hostname;

  if (host !== "beta.hffapp.com") {
    return context.next();
  }

  const user = Deno.env.get("BETA_USER") ?? "BETA";
  const pass = Deno.env.get("BETA_PASS") ?? "";

  const deny = () =>
    new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="HFF Beta"' },
    });

  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return deny();

  const decoded = atob(auth.slice(6));
  const i = decoded.indexOf(":");
  const u = i >= 0 ? decoded.slice(0, i) : decoded;
  const p = i >= 0 ? decoded.slice(i + 1) : "";

  if (u !== user || p !== pass) return deny();

  return context.next();
};