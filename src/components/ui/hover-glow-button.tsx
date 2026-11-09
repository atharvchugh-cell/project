import React, { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HoverGlowButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  // Defaults derive from the global semantic tokens so the effect follows the theme.
  glowColor?: string;
  backgroundColor?: string;
  textColor?: string;
  hoverTextColor?: string;
  type?: "button" | "submit";
  "aria-label"?: string;
}

/**
 * Button whose glow follows the cursor on hover.
 * Colors default to semantic tokens (card background, foreground text,
 * primary glow/hover text) so it adapts to theming and dark mode.
 */
export const HoverGlowButton = React.forwardRef<HTMLButtonElement, HoverGlowButtonProps>(
  (
    {
      children,
      onClick,
      className,
      disabled = false,
      glowColor = "hsl(var(--primary))",
      backgroundColor = "hsl(var(--card))",
      textColor = "hsl(var(--foreground))",
      hoverTextColor = "hsl(var(--primary))",
      type = "button",
      ...props
    },
    ref,
  ) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setGlowPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg border border-border/60 font-medium cursor-pointer z-10 transition-colors duration-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        style={{
          backgroundColor,
          color: isHovered ? hoverTextColor : textColor,
        }}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute w-40 h-40 rounded-full opacity-40 pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 ease-out",
            isHovered ? "scale-100" : "scale-0",
          )}
          style={{
            left: `${glowPosition.x}px`,
            top: `${glowPosition.y}px`,
            background: `radial-gradient(circle, ${glowColor} 10%, transparent 70%)`,
            zIndex: 0,
          }}
        />
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </button>
    );
  },
);
HoverGlowButton.displayName = "HoverGlowButton";
