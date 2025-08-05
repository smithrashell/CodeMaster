import React from "react";
import { cn, createVariants } from "../../utils/cn";

const badgeVariants = createVariants(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variant: {
      default: "border-transparent bg-blue-600 text-white hover:bg-blue-700",
      secondary:
        "border-transparent bg-gray-700 text-gray-300 hover:bg-gray-600",
      easy: "border-transparent text-white hover:opacity-90",
      medium: "border-transparent text-white hover:opacity-90",
      hard: "border-transparent text-white hover:opacity-90",
      outline: "text-gray-300 border-gray-600 hover:bg-gray-700",
    },
  },
  {
    variant: "default",
  }
);

export function Badge({ className, variant, children, ...props }) {
  const getInlineStyles = () => {
    if (variant === "easy") {
      return { backgroundColor: "#10b981", color: "white" };
    }
    if (variant === "medium") {
      return { backgroundColor: "#f59e0b", color: "white" };
    }
    if (variant === "hard") {
      return { backgroundColor: "#ef4444", color: "white" };
    }
    return {};
  };

  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={getInlineStyles()}
      {...props}
    >
      {children}
    </div>
  );
}

export default Badge;
