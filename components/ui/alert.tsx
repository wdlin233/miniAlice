import * as React from "react";
import { AlertCircle, CheckCircle, Info, X, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type AlertVariant = "default" | "destructive" | "success" | "warning" | "info";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  description?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant = "default",
      title,
      description,
      dismissible = false,
      onDismiss,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      default: "bg-background border border-input text-foreground",
      destructive: "bg-destructive/10 border border-destructive text-destructive",
      success: "bg-success/10 border border-success text-success",
      warning: "bg-warning/10 border border-warning text-warning",
      info: "bg-info/10 border border-info text-info"
    };

    const variantIcons = {
      default: AlertCircle,
      destructive: AlertCircle,
      success: CheckCircle,
      warning: TriangleAlert,
      info: Info
    };

    const Icon = variantIcons[variant];

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-start rounded-lg border p-4",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="ml-3 flex-1">
          {title && <h4 className="text-sm font-medium">{title}</h4>}
          {description && (
            <div className="mt-1 text-sm text-muted-foreground">{description}</div>
          )}
        </div>
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-4 shrink-0 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = "Alert";

export { Alert };
