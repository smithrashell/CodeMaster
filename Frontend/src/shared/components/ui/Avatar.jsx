import React from "react";
import { cn } from "../../utils/cn";

export function Avatar({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AvatarFallback({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-gray-600 text-white text-sm font-semibold",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Avatar;
