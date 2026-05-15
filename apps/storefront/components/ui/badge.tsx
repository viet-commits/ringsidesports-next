import * as React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warning" | "outline";
  className?: string;
}

const variantClasses: Record<string, string> = {
  default: "bg-primary text-white",
  success: "bg-green-600 text-white",
  danger: "bg-accent text-white",
  warning: "bg-yellow-500 text-black",
  outline: "bg-transparent text-primary border border-primary",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
