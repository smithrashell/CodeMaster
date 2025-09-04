// Utility function for combining class names, similar to clsx/classNames
export function cn(...classes) {
  return classes
    .filter(Boolean)
    .map((cls) => (typeof cls === "string" ? cls.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

// Utility function for conditional classes
export function conditionalClass(condition, trueClass, falseClass = "") {
  return condition ? trueClass : falseClass;
}

// Variant utility for component styling (simplified version of class-variance-authority)
export function createVariants(base, variants, defaultVariants = {}) {
  return function (props = {}) {
    let classes = [base];

    Object.keys(variants).forEach((key) => {
      const value = props[key] || defaultVariants[key];
      if (value && variants[key][value]) {
        classes.push(variants[key][value]);
      }
    });

    return classes.filter(Boolean).join(" ");
  };
}
