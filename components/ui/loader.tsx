import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "inline";
}

const Loader = React.forwardRef<HTMLDivElement, LoaderProps>(
  ({ className, size = "md", variant = "default", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-8 w-8"
    };

    const variantClasses = {
      default: "flex items-center justify-center",
      inline: "inline-flex items-center justify-center"
    };

    return (
      <div
        ref={ref}
        className={cn(
          variantClasses[variant],
          className
        )}
        {...props}
      >
        <Loader2
          className={cn(
            "animate-spin text-primary",
            sizeClasses[size]
          )}
        />
      </div>
    );
  }
);

Loader.displayName = "Loader";

export { Loader };
