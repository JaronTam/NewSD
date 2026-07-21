// Story 1a.12 T9 - AtMentionAutocomplete (D1 controlled formula + name<->id reverse map).
// gov: SDR#11 (controlled 双路径) / SDR#23 (name 反向映射) / AC-19 / AC-20.
//
// Reads formula strings in stored id-form ("10 * @s1") and displays them in
// name-form ("10 * 库存"). Typing @ triggers a listbox of stock+cloud names
// (flow excluded). Selecting a name inserts the id-form (@id) into the stored
// value while onChange receives the display form. Blur → onBlur receives the
// stored id-form for persistence.

import { useState, useRef, useEffect, useCallback } from "react";
import { useSyncExternalStore } from "react";
import { t } from "../sd/i18n";
import { langStore } from "../sd/langStore";

export interface ElementRef {
  id: string;
  kind: "stock" | "cloud" | "flow";
  name: string;
}

export interface AtMentionAutocompleteProps {
  /** Stored formula value in id-form (e.g. "10 * @s1"). */
  value: string;
  /** Elements for name<->id mapping. */
  elements: readonly ElementRef[];
  /** Fires on every change with display form (name references). */
  onChange: (displayForm: string) => void;
  /** Fires on blur with stored id-form. */
  onBlur?: (storedForm: string) => void;
  /** Optional data-testid override for the textarea. */
  inputTestId?: string;
  /** Optional className for the textarea. */
  className?: string;
  /** Optional aria-label for the textarea. */
  ariaLabel?: string;
}

/** Build a name→id map from elements. */
function buildNameMap(elements: readonly ElementRef[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const el of elements) {
    map.set(el.name, el.id);
  }
  return map;
}

/** Build an id→name map from elements. */
function buildIdMap(elements: readonly ElementRef[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const el of elements) {
    map.set(el.id, el.name);
  }
  return map;
}

/** Convert stored id-form ("@s1") to display name-form ("库存"). */
function toDisplay(value: string, idMap: Map<string, string>): string {
  return value.replace(/@([\w-]+)/g, (_match, id) => {
    const name = idMap.get(id);
    return name ?? `@${id}`;
  });
}

/** Convert display name-form ("库存") to stored id-form ("@s1"). */
function toStored(display: string, nameMap: Map<string, string>): string {
  const names = Array.from(nameMap.keys());
  if (names.length === 0) return display;
  // Sort by length descending to match longer names before shorter ones.
  names.sort((a, b) => b.length - a.length);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(escaped.join("|"), "g");
  return display.replace(pattern, (name) => {
    const id = nameMap.get(name);
    return id ? `@${id}` : name;
  });
}

/** Extract the partial query after the last "@" in the value. */
function getQuery(value: string, cursorPos: number): { query: string; atPos: number } | null {
  const beforeCursor = value.slice(0, cursorPos);
  const atIdx = beforeCursor.lastIndexOf("@");
  if (atIdx === -1) return null;
  const query = beforeCursor.slice(atIdx + 1);
  // Only trigger if @ is immediately before typing (no space between @ and cursor)
  return { query, atPos: atIdx };
}

export function AtMentionAutocomplete({
  value,
  elements,
  onChange,
  onBlur,
  inputTestId,
  className,
  ariaLabel,
}: AtMentionAutocompleteProps) {
  const lang = useSyncExternalStore(langStore.subscribe, langStore.getSnapshot);
  const idMap = useRef<Map<string, string>>(buildIdMap(elements));
  const nameMap = useRef<Map<string, string>>(buildNameMap(elements));

  // Update maps when elements change.
  useEffect(() => {
    idMap.current = buildIdMap(elements);
    nameMap.current = buildNameMap(elements);
  }, [elements]);

  // Internal display state — derived from value prop (id-form → name-form).
  const [displayValue, setDisplayValue] = useState(() => toDisplay(value, idMap.current));
  const [listboxOpen, setListboxOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<ElementRef[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AC-9 / SDR#10: input spark — toggled on each keypress, cleared on animation end.
  const [spark, setSpark] = useState(false);

  // Sync display when external value changes.
  useEffect(() => {
    const nextDisplay = toDisplay(value, idMap.current);
    setDisplayValue(nextDisplay);
  }, [value]);

  const stockCloudElements = elements.filter((e) => e.kind !== "flow");

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newDisplay = e.target.value;
      setDisplayValue(newDisplay);
      onChange(newDisplay);

      // Check for @ trigger.
      const cursorPos = e.target.selectionStart ?? newDisplay.length;
      const q = getQuery(newDisplay, cursorPos);
      if (q) {
        const filtered = stockCloudElements.filter((el) =>
          el.name.toLowerCase().includes(q.query.toLowerCase()),
        );
        setFilteredOptions(filtered);
        setListboxOpen(true);
      } else {
        setListboxOpen(false);
      }
    },
    [onChange, stockCloudElements],
  );

  const handleSelect = useCallback(
    (el: ElementRef) => {
      const cursorPos = textareaRef.current?.selectionStart ?? displayValue.length;
      const q = getQuery(displayValue, cursorPos);
      if (!q) return;

      // Replace "@query" with the element name (display form, no @ prefix).
      const before = displayValue.slice(0, q.atPos);
      const after = displayValue.slice(cursorPos);
      const newDisplay = `${before}${el.name}${after}`;
      setDisplayValue(newDisplay);
      onChange(newDisplay);
      setListboxOpen(false);
    },
    [displayValue, onChange],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setListboxOpen(false);
    }
    // AC-9 / SDR#10: input spark on each keypress (printable chars only).
    if (e.key.length === 1) {
      setSpark(true);
    }
  }, []);

  const handleBlur = useCallback(() => {
    // Convert display form to stored id-form synchronously.
    // The onMouseDown e.preventDefault() on listbox options prevents
    // the textarea from losing focus during option clicks.
    if (onBlur) {
      const stored = toStored(displayValue, nameMap.current);
      onBlur(stored);
    }
  }, [displayValue, onBlur]);

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={textareaRef}
        data-testid={inputTestId ?? "ns-at-mention-input"}
        className={`${className ?? ""}${spark ? " ns-property-panel__input--spark" : ""}`}
        aria-label={ariaLabel}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onAnimationEnd={() => setSpark(false)}
        onBlur={handleBlur}
      />
      {listboxOpen && (
        <div data-testid="ns-at-mention-listbox" role="listbox">
          {filteredOptions.length === 0 ? (
            <div className="ns-at-mention-empty">{t("noMatch", lang)}</div>
          ) : (
            filteredOptions.map((el) => (
              <div
                key={el.id}
                data-testid="ns-at-mention-option"
                role="option"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur before click
                  handleSelect(el);
                }}
              >
                {el.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
