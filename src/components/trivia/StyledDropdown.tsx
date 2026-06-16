import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type DropdownOption = {
  label: string;
  value: string;
  meta?: string;
};

type StyledDropdownProps = {
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
  autoFocusSearch?: boolean;
};

export default function StyledDropdown({
  label,
  options,
  value,
  onChange,
  searchable = false,
  autoFocusSearch = false,
}: StyledDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(
    () =>
      options.filter((option) =>
        searchable
          ? `${option.label} ${option.meta ?? ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())
          : true,
      ),
    [options, query, searchable],
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const mobileQuery = window.matchMedia("(max-width: 720px)");
    if (!mobileQuery.matches) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  return (
    <div className="styledDropdown" ref={rootRef}>
      <span className="dropdownLabel">{label}</span>
      <button
        aria-expanded={open}
        className="dropdownButton"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>{selected?.label ?? "Choose"}</strong>
          {selected?.meta ? <em>{selected.meta}</em> : null}
        </span>
        <ChevronDown size={17} />
      </button>
      {open ? (
        <div className="dropdownMenu">
          {searchable ? (
            <label className="dropdownSearch">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                autoFocus={autoFocusSearch}
              />
            </label>
          ) : null}
          <div className="dropdownOptions">
            {filteredOptions.map((option) => (
              <button
                className={option.value === value ? "selected" : ""}
                type="button"
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.meta ? <em>{option.meta}</em> : null}
                </span>
                {option.value === value ? <Check size={16} /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
