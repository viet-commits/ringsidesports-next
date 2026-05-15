import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-secondary mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-primary placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${error ? "border-accent focus:ring-accent" : ""} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-accent">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
