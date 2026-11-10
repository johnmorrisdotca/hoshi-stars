// The list's filter bar: one small chip for each filter that opens a menu of its choices (a desk), and on a phone one "Filters" button that opens a sheet with every choice in a row of buttons.
// Both read and write the same choices, so what one shows the other shows. A chip's menu follows the menu-button pattern: Down or Enter opens it, the arrows, Home and End move, Space or Enter
// ticks a choice and leaves the menu open (the choices add up), Escape closes it and puts the focus back on the chip, and so does a click outside.
import { say } from "./words.ts";

export interface FilterGroup {
  key: string;
  /** The words key of the filter's name. */
  label: string;
  /** The words key of a shorter name for the chip, where the chip is too wide with the full one. */
  chip?: string;
  values: readonly string[];
  text: (value: string) => string;
}

export interface FilterBarOptions<G extends FilterGroup> {
  /** The filters, or a function that gives them now (the Japanese and Chinese skies have their own). Call `rebuild` when they change. */
  groups: readonly G[] | (() => readonly G[]);
  /** The words key of the sheet's "Show {n}" button (`ls_show` when left out). */
  showWord?: () => string;
  chosen: (group: G) => string[];
  toggle: (group: G, value: string) => void;
  clearAll: () => void;
  /** How many constellations the choices show now, for the sheet's button. */
  shown: () => number;
}

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {}, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] => {
  const element = Object.assign(document.createElement(tag), props);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  return element;
};

let nextId = 0;

/** What a chip says of its filter's choice: the one chosen, how many are, or `any`. */
export function chipValue(group: FilterGroup, on: readonly string[]): string {
  if (on.length === 0) return say("ls_any");
  return on.length === 1 ? group.text(on[0]!) : say("ls_chosen", { n: on.length });
}

/** Builds the chips and the sheet in the page's language. Returns `refresh` (read the choices again) and `rebuild` (the language changed). */
export function mountFilterBar<G extends FilterGroup>(chips: HTMLElement, sheet: HTMLDialogElement, opener: HTMLButtonElement, options: FilterBarOptions<G>): { refresh: () => void; rebuild: () => void } {
  const { chosen, toggle } = options;
  const groups = (): readonly G[] => (typeof options.groups === "function" ? options.groups() : options.groups);
  let openChip: HTMLElement | undefined;

  const items = (menu: HTMLElement): HTMLButtonElement[] => Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]'));

  function closeMenu(focusChip = false): void {
    if (openChip === undefined) return;
    const chip = openChip;
    openChip = undefined;
    chip.querySelector<HTMLElement>(".ls-menu")!.hidden = true;
    const button = chip.querySelector<HTMLButtonElement>(".ls-chip-button")!;
    button.setAttribute("aria-expanded", "false");
    if (focusChip) button.focus();
  }

  function openMenu(chip: HTMLElement, focus: "first" | "last" | "none"): void {
    if (openChip !== undefined && openChip !== chip) closeMenu();
    openChip = chip;
    const menu = chip.querySelector<HTMLElement>(".ls-menu")!;
    menu.hidden = false;
    chip.querySelector(".ls-chip-button")!.setAttribute("aria-expanded", "true");
    // a menu that would run past the right edge of the page opens to the left of its chip instead
    menu.classList.remove("ls-menu-right");
    if (menu.getBoundingClientRect().right > document.documentElement.clientWidth - 8) menu.classList.add("ls-menu-right");
    const list = items(menu);
    if (focus !== "none") (focus === "first" ? list[0] : list[list.length - 1])?.focus();
  }

  function buildChip(group: G): HTMLElement {
    const id = `ls-menu-${nextId++}`;
    const chip = make("div", { className: "ls-chip" }, { "data-group": group.key });
    const button = make("button", { type: "button", className: "ls-chip-button" }, { "aria-haspopup": "menu", "aria-expanded": "false", "aria-controls": id, "data-testid": `chip-${group.key}` });
    const name = make("span", { className: "ls-chip-name", textContent: say(group.chip ?? group.label) });
    const value = make("span", { className: "ls-chip-value" });
    button.append(name, make("span", { textContent: ": " }, { "aria-hidden": "true" }), value);
    const menu = make("div", { id, className: `ls-menu ls-menu-${group.values.length > 6 ? "grid" : "list"}`, hidden: true }, { role: "menu", "aria-label": say(group.label) });
    for (const one of group.values) {
      const item = make("button", { type: "button", className: "ls-item", textContent: group.text(one) }, { role: "menuitemcheckbox", "aria-checked": "false", tabindex: "-1", "data-value": one });
      item.addEventListener("click", () => toggle(group, one));
      menu.append(item);
    }
    button.addEventListener("click", () => (openChip === chip ? closeMenu() : openMenu(chip, "none")));
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openMenu(chip, event.key === "ArrowDown" ? "first" : "last");
      }
    });
    menu.addEventListener("keydown", (event) => {
      const list = items(menu);
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      const go = (index: number): void => {
        event.preventDefault();
        list[(index + list.length) % list.length]?.focus();
      };
      if (event.key === "ArrowDown" || event.key === "ArrowRight") go(at + 1);
      else if (event.key === "ArrowUp" || event.key === "ArrowLeft") go(at - 1);
      else if (event.key === "Home") go(0);
      else if (event.key === "End") go(list.length - 1);
      else if (event.key === "Tab") closeMenu();
      else if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    });
    chip.addEventListener("focusout", (event) => {
      // Safari does not focus a button that is clicked, so a focus that goes nowhere (no relatedTarget) is not a leave; the click outside handler covers a click.
      const to = event.relatedTarget as Node | null;
      if (openChip === chip && to !== null && !chip.contains(to)) closeMenu();
    });
    chip.append(button, menu);
    return chip;
  }

  function buildSheet(): void {
    const title = make("h2", { id: "ls-sheet-title", className: "ls-sheet-title", textContent: say("ls_filters") });
    const close = make("button", { type: "button", className: "fam-button", textContent: say("ls_close") }, { "data-testid": "list-sheet-close" });
    close.addEventListener("click", () => sheet.close());
    const head = make("div", { className: "ls-sheet-head" });
    head.append(title, close);
    const body = make("div", { className: "ls-sheet-body" });
    for (const group of groups()) {
      const row = make("div", { className: "ls-sheet-row" });
      const label = make("span", { className: "fam-label", textContent: say(group.label), id: `ls-sheet-${group.key}` });
      const seg = make("span", { className: "ls-sheet-choices" }, { role: "group", "aria-labelledby": label.id, "data-sheet-group": group.key });
      for (const one of group.values) {
        const choice = make("button", { type: "button", className: "ls-choice", textContent: group.text(one) }, { "aria-pressed": "false", "data-value": one });
        choice.addEventListener("click", () => toggle(group, one));
        seg.append(choice);
      }
      row.append(label, seg);
      body.append(row);
    }
    const clear = make("button", { type: "button", className: "fam-button", textContent: say("ls_clear") }, { "data-testid": "list-sheet-clear" });
    clear.addEventListener("click", () => options.clearAll());
    const show = make("button", { type: "button", className: "fam-button ls-show" }, { "data-testid": "list-sheet-show" });
    show.addEventListener("click", () => sheet.close());
    const foot = make("div", { className: "ls-sheet-foot" });
    foot.append(clear, show);
    sheet.replaceChildren(head, body, foot);
  }

  function refresh(): void {
    let active = 0;
    for (const group of groups()) {
      const on = chosen(group);
      if (on.length > 0) active += 1;
      const chip = chips.querySelector<HTMLElement>(`[data-group="${group.key}"]`)!;
      chip.querySelector(".ls-chip-value")!.textContent = chipValue(group, on);
      chip.classList.toggle("ls-on", on.length > 0);
      chip.querySelectorAll<HTMLElement>(".ls-item").forEach((item) => item.setAttribute("aria-checked", String(on.includes(item.dataset.value!))));
      sheet.querySelectorAll<HTMLElement>(`[data-sheet-group="${group.key}"] .ls-choice`).forEach((choice) => choice.setAttribute("aria-pressed", String(on.includes(choice.dataset.value!))));
    }
    opener.replaceChildren(document.createTextNode(say("ls_filters")), ...(active === 0 ? [] : [make("span", { className: "ls-badge", textContent: String(active) }, { "data-testid": "list-active" })]));
    opener.classList.toggle("ls-on", active > 0);
    const show = sheet.querySelector<HTMLElement>(".ls-show");
    if (show !== null) show.textContent = say(options.showWord?.() ?? "ls_show", { n: options.shown() });
    sheet.querySelector<HTMLButtonElement>('[data-testid="list-sheet-clear"]')!.disabled = active === 0;
  }

  function rebuild(): void {
    openChip = undefined;
    chips.replaceChildren(...groups().map(buildChip));
    buildSheet();
    refresh();
  }

  opener.setAttribute("aria-haspopup", "dialog");
  opener.addEventListener("click", () => {
    closeMenu();
    sheet.showModal();
  });
  // a click on the sheet's backdrop (the dialog itself, outside its content) closes it
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) sheet.close();
  });
  document.addEventListener("click", (event) => {
    if (openChip !== undefined && !openChip.contains(event.target as Node)) closeMenu();
  });
  rebuild();
  return { refresh, rebuild };
}
