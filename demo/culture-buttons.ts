// The three sky-culture buttons (Western, Japanese, Chinese) for the gallery and the list: one choice, kept in the address as `culture=` (nothing for the Western sky), as on the sky map.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { CULTURE_IDS, DEFAULT_CULTURE, cultureOf, type CultureId } from "./cultures.ts";
import { say } from "./words.ts";

type Address = ReturnType<typeof createAddressState>;

/** The sky culture an address names: the Western sky for a word that is none of them. */
export const cultureIn = (address: Address): CultureId => (cultureOf(address.get("culture"))?.id as CultureId | undefined) ?? DEFAULT_CULTURE;

/**
 * Fills `host` with the three buttons and keeps them in step with the address. `changed` runs after a button writes the address, so the page draws again. Returns `refresh`, to call when the language changes.
 */
export function mountCultureButtons(host: HTMLElement, address: Address, changed: () => void): { refresh: () => void } {
  const buttons = CULTURE_IDS.map((id) => {
    const button = Object.assign(document.createElement("button"), { type: "button" });
    button.dataset.value = id;
    button.addEventListener("click", () => {
      address.setMany({ culture: id === DEFAULT_CULTURE ? null : id, page: null });
      changed();
    });
    return button;
  });
  host.replaceChildren(...buttons);
  function refresh(): void {
    const now = cultureIn(address);
    for (const button of buttons) {
      const id = button.dataset.value!;
      button.textContent = say(`culture${id[0]!.toUpperCase()}${id.slice(1)}`);
      button.setAttribute("aria-pressed", String(id === now));
    }
  }
  refresh();
  return { refresh };
}
