import { useEffect, useState } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "#/components/ui/button"

type ThemeMode = "light" | "dark" | "auto"

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "auto"
  const stored = window.localStorage.getItem("theme")
  return stored === "light" || stored === "dark" || stored === "auto"
    ? stored
    : "auto"
}

function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode

  document.documentElement.classList.remove("light", "dark")
  document.documentElement.classList.add(resolved)
  document.documentElement.style.colorScheme = resolved

  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme")
  } else {
    document.documentElement.setAttribute("data-theme", mode)
  }
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto")

  useEffect(() => {
    const initialMode = getInitialMode()
    setMode(initialMode)
    applyThemeMode(initialMode)
  }, [])

  function toggleMode() {
    const nextMode: ThemeMode =
      mode === "light" ? "dark" : mode === "dark" ? "auto" : "light"
    setMode(nextMode)
    applyThemeMode(nextMode)
    window.localStorage.setItem("theme", nextMode)
  }

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleMode}
      aria-label={`Theme mode ${mode}`}
      title={`Theme mode ${mode}`}
    >
      <Icon className="size-4" />
    </Button>
  )
}
