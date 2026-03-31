import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

/**
 * Gets a color along a red → blue → green gradient based on value 0-10
 * 0-1: deep red
 * 5: blue
 * 9-10: green
 */
function getGradientColor(value, max = 10) {
  const pct = value / max

  if (pct <= 0.5) {
    // Red → Blue (0% to 50%)
    const t = pct / 0.5
    const r = Math.round(220 * (1 - t))
    const g = Math.round(50 * (1 - t))
    const b = Math.round(50 + 170 * t)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Blue → Green (50% to 100%)
    const t = (pct - 0.5) / 0.5
    const r = Math.round(0 + 34 * t)
    const g = Math.round(80 + 117 * t)
    const b = Math.round(220 * (1 - t) + 82 * t)
    return `rgb(${r}, ${g}, ${b})`
  }
}

function getGradientBackground(value, max = 10) {
  // Build a gradient that shows the full spectrum up to the current value
  const pct = (value / max) * 100
  return `linear-gradient(to right, rgb(220, 50, 50), rgb(40, 60, 220) ${Math.min(50 / (pct / 100), 100)}%, rgb(34, 197, 82) 100%)`
}

const Slider = React.forwardRef(({ className, trackColor = "bg-navy", useGradient = false, ...props }, ref) => {
  const value = props.value?.[0] ?? props.defaultValue?.[0] ?? 0
  const max = props.max ?? 10
  const dynamicColor = useGradient ? getGradientColor(value, max) : null

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-gray-200">
        <SliderPrimitive.Range
          className={cn("absolute h-full rounded-full transition-colors duration-200", !useGradient && trackColor)}
          style={useGradient ? { backgroundColor: dynamicColor } : undefined}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-7 w-7 rounded-full border-2 bg-white shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold cursor-grab active:cursor-grabbing"
        style={useGradient ? { borderColor: dynamicColor } : { borderColor: '#0B1F3A' }}
      />
    </SliderPrimitive.Root>
  )
})
Slider.displayName = "Slider"

export { Slider, getGradientColor }
