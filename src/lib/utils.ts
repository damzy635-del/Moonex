/** Small dependency-free class helper for the shadcn-style component layer. */
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}
