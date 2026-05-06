import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import type { Instructor } from "../types";
import { useTheme } from "../contexts/ThemeContext";

interface Props {
  instructors: Instructor[];
  value: string; // trigram or ""
  onChange: (trigram: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}

export const InstructorCombobox = ({
  instructors,
  value,
  onChange,
  placeholder = "Buscar docente...",
  emptyLabel = "— Nenhum —",
  className = "",
  size = "md",
  disabled = false,
}: Props) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = instructors.find((i) => i.trigram === value) ?? null;

  const sorted = [...instructors].sort((a, b) =>
    a.warName.localeCompare(b.warName, "pt-BR")
  );

  const filtered = search.trim()
    ? sorted.filter(
        (i) =>
          i.warName.toLowerCase().includes(search.toLowerCase()) ||
          i.trigram.toLowerCase().includes(search.toLowerCase()) ||
          (i.rank ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : sorted;

  const handleSelect = useCallback(
    (trigram: string) => {
      onChange(trigram);
      setSearch("");
      setOpen(false);
    },
    [onChange]
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const padY = size === "sm" ? "py-1 px-2" : "py-2 px-3";
  const textSz = size === "sm" ? "text-xs" : "text-sm";
  const baseCls = `w-full flex items-center gap-2 rounded-lg border cursor-pointer transition-colors ${padY} ${textSz} ${
    isDark
      ? "bg-slate-900 border-slate-700 text-slate-100 hover:border-blue-500"
      : "bg-white border-slate-200 text-slate-900 hover:border-blue-400"
  } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        className={baseCls}
        onClick={() => !disabled && setOpen((o) => !o)}
        role="combobox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <span className={`font-mono font-bold text-blue-500 ${size === "sm" ? "text-[10px]" : "text-xs"}`}>
              {selected.trigram}
            </span>
            <span className="flex-1 truncate">
              {selected.rank ? `${selected.rank} ` : ""}
              {selected.warName}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
            <span className={isDark ? "text-slate-400" : "text-slate-400"}>
              {emptyLabel}
            </span>
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className={`absolute z-50 mt-1 w-full min-w-[220px] rounded-xl border shadow-xl overflow-hidden ${
            isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
          }`}
        >
          {/* Search input */}
          <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDark ? "border-slate-700" : "border-slate-100"}`}>
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className={`flex-1 text-sm outline-none bg-transparent ${isDark ? "text-slate-100 placeholder-slate-500" : "text-slate-900 placeholder-slate-400"}`}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setSearch(""); }
                if (e.key === "Enter" && filtered.length > 0) handleSelect(filtered[0].trigram);
              }}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                <X size={12} className="text-slate-400" />
              </button>
            )}
          </div>

          {/* Empty option */}
          <div
            className={`px-3 py-2 cursor-pointer text-sm italic transition-colors ${
              isDark
                ? "text-slate-400 hover:bg-slate-800"
                : "text-slate-400 hover:bg-slate-50"
            }`}
            onClick={() => handleSelect("")}
          >
            {emptyLabel}
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className={`px-3 py-3 text-xs text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Nenhum docente encontrado
              </p>
            ) : (
              filtered.map((i) => (
                <div
                  key={i.trigram}
                  onClick={() => handleSelect(i.trigram)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    i.trigram === value
                      ? isDark ? "bg-blue-900/40 text-blue-300" : "bg-blue-50 text-blue-700"
                      : isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <span className={`font-mono font-bold text-blue-500 text-[10px] w-8 shrink-0`}>
                    {i.trigram}
                  </span>
                  <span className="text-sm truncate">
                    {i.rank ? `${i.rank} ` : ""}
                    {i.warName}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
