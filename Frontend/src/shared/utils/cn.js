// Utility function for combining class names, similar to clsx/classNames
export function cn(...classes) {
  return classes
    .filter(Boolean)
    .map((cls) => (typeof cls === "string" ? cls.trim() : ""))
    .filter(Boolean)
    .join(" ");
}
