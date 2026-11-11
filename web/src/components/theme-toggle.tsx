"use client";
import { useEffect, useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";
export const THEME_KEY = "vortrag4-theme";

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Schaltet zwischen Dark- und Light-Mode um und merkt sich die Wahl. */
export function ThemeToggle({ size = "lg" }: { size?: "lg" | "default" }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setTheme(currentTheme());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // ohne Speichern weitermachen
    }
    setTheme(next);
  };

  const label = theme === "dark" ? "Light-Mode" : theme === "light" ? "Dark-Mode" : "Farbmodus";
  const Icon = theme === "dark" ? Sun : theme === "light" ? Moon : SunMoon;
  return (
    <Button variant="ghost" size={size} onClick={toggle} aria-label={`Zum ${label} wechseln`} title={`Zum ${label} wechseln`} data-testid="theme-toggle">
      <Icon /> {label}
    </Button>
  );
}

/** Läuft vor dem ersten Zeichnen, damit die gespeicherte Wahl nicht aufblitzt. */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
