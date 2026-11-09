import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractiveHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
}

const InteractiveHoverButton = React.forwardRef<HTMLButtonElement, InteractiveHoverButtonProps>(
  ({ text = "Button", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "group relative w-32 cursor-pointer overflow-hidden rounded-full border bg-background p-2 text-center font-semibold",
        className,
      )}
      {...props}
    >
      <span className="relative z-10 inline-block translate-x-1 transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0 group-focus-visible:translate-x-12 group-focus-visible:opacity-0">
        {text}
      </span>
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 flex items-center justify-center gap-2 translate-x-12 text-primary-foreground opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100 group-focus-visible:-translate-x-1 group-focus-visible:opacity-100"
      >
        <span>{text}</span>
        <ArrowRight className="h-4 w-4" />
      </div>
      <div className="absolute left-[20%] top-[40%] h-2 w-2 scale-[1] rounded-lg bg-primary transition-all duration-300 group-hover:left-[0%] group-hover:top-[0%] group-hover:h-full group-hover:w-full group-hover:scale-[1.8] group-focus-visible:left-[0%] group-focus-visible:top-[0%] group-focus-visible:h-full group-focus-visible:w-full group-focus-visible:scale-[1.8]" />
    </button>
  ),
);

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton };
