// The gallery: a grid of all 88 constellations' pictures with a search box and pages. A tile opens that constellation's own page (constellation.html). The search and the page are kept in the address.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { answers, inOrder, langNow, lookNow, nameIn, onLook, thumbSrc } from "./thumbs.ts";
import { say } from "./words.ts";

const PAGE = 24;
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const address = createAddressState({ defaults: { q: "", page: "1" } });

function render(): void {
  const lang = langNow();
  const look = lookNow();
  const found = inOrder(lang).filter((c) => answers(c, address.get("q") ?? ""));
  const pages = Math.max(1, Math.ceil(found.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number(address.get("page")) || 1));
  const search = $<HTMLInputElement>("gl-search");
  if (search.value !== (address.get("q") ?? "") && document.activeElement !== search) search.value = address.get("q") ?? "";
  $("gl-count").textContent = say("gl_count", { n: found.length });
  $("gl-none").hidden = found.length > 0;
  $("gl-grid").replaceChildren(
    ...found.slice((page - 1) * PAGE, page * PAGE).map((c) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.className = "gl-tile";
      link.href = `constellation.html?c=${c.abbreviation}`;
      link.dataset.abbr = c.abbreviation;
      const image = document.createElement("img");
      image.src = thumbSrc(c.abbreviation, 480, look);
      image.width = 240;
      image.height = 240;
      image.loading = "lazy";
      image.alt = "";
      const name = Object.assign(document.createElement("span"), { className: "gl-name", textContent: nameIn(c, lang) });
      const sub = Object.assign(document.createElement("span"), { className: "gl-sub", textContent: `${c.abbreviation} · ${lang === "ja" ? c.name : c.japanese}` });
      link.append(image, name, sub);
      item.append(link);
      return item;
    }),
  );
  const pager = $("gl-pager");
  pager.hidden = pages === 1;
  const buttons: HTMLButtonElement[] = [];
  const add = (label: string, to: number, current = false, name = label): void => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fam-button";
    button.textContent = label;
    button.setAttribute("aria-label", name);
    button.disabled = to < 1 || to > pages;
    if (current) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => {
      address.set("page", to === 1 ? null : String(to));
      render();
      window.scrollTo({ top: 0 });
    });
    buttons.push(button);
  };
  add(say("gl_prev"), page - 1);
  for (let n = 1; n <= pages; n++) add(String(n), n, n === page, say("gl_page", { n, total: pages }));
  add(say("gl_next"), page + 1);
  pager.replaceChildren(...buttons);
}

$("gl-find").addEventListener("submit", (event) => event.preventDefault());
$<HTMLInputElement>("gl-search").addEventListener("input", (event) => {
  const text = (event.target as HTMLInputElement).value;
  address.setMany({ q: text === "" ? null : text, page: null });
  render();
});
address.subscribe(({ source }) => {
  if (source === "navigation") render();
});
document.addEventListener("hoshi-language", render);
onLook(render);
render();
