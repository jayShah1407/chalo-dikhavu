/**
 * Match a pathname against a pattern like "/student/teachers/:id".
 * A trailing "*" matches any rest: "/docs/*". Trailing slashes are ignored.
 */
export function matchPath(pattern: string, pathname: string): boolean {
  const clean = (p: string) => p.replace(/\/+$/, "") || "/";
  const pat = clean(pattern).split("/");
  const path = clean(pathname).split("/");
  for (let i = 0; i < pat.length; i++) {
    if (pat[i] === "*") return true;
    if (i >= path.length) return false;
    if (pat[i].startsWith(":")) {
      if (!path[i]) return false;
      continue;
    }
    if (decodeURIComponent(path[i]) !== pat[i]) return false;
  }
  return pat.length === path.length;
}

/** Static paths can be navigated to; patterns with params can only be waited for. */
export function isStaticPath(pattern: string): boolean {
  return !/(^|\/)(:|\*)/.test(pattern);
}
