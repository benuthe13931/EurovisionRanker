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
};

export default function StyledDropdown({ label, options, value, onChange }: StyledDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(
    () =>
      options.filter((option) =>
        `${option.label} ${option.meta ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [options, query],
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div className="styledDropdown" ref={rootRef}>
      <span className="dropdownLabel">{label}</span>
      <button className="dropdownButton" type="button" onClick={() => setOpen((current) => !current)}>
        <span>
          <strong>{selected?.label ?? "Choose"}</strong>
          {selected?.meta ? <em>{selected.meta}</em> : null}
        </span>
        <ChevronDown size={17} />
      </button>
      {open ? (
        <div className="dropdownMenu">
          <label className="dropdownSearch">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}`}
              autoFocus
            />
          </label>
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
