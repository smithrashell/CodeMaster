import React from 'react';
import { cn, createVariants } from '../../utils/cn';

const buttonVariants = createVariants(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variant: {
      default: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
      destructive: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
      outline: "border border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white focus-visible:ring-gray-600",
      secondary: "bg-gray-700 text-gray-300 hover:bg-gray-600 focus-visible:ring-gray-600",
      ghost: "text-gray-400 hover:bg-gray-700 hover:text-white focus-visible:ring-gray-600",
      link: "text-blue-400 underline-offset-4 hover:underline focus-visible:ring-blue-600",
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8 py-6 text-base font-semibold",
      icon: "h-10 w-10",
    },
  },
  {
    variant: "default",
    size: "default",
  }
);

export function Button({ 
  className, 
  variant, 
  size, 
  children, 
  ...props 
}) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;