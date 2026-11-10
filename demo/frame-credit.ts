// The credit in the corner of the three bare pages made to sit in an iframe (the chart, the constellation in 3D, a star's picture). They have no header or footer of the family's, so the page that is embedded names its source itself,
// with a link to every credit, and a reader sees it without opening anything.
const NOTICE = "https://github.com/johnmorrisdotca/hoshi-stars/blob/main/NOTICE.md";

/** Puts the credit in the corner of the page, in English or Japanese. */
export function frameCredit(ja: boolean): void {
  const link = document.createElement("a");
  link.dataset["testid"] = "frame-credit";
  link.href = NOTICE;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = ja ? "星: イェール輝星カタログほか。出典一覧" : "Stars: Yale Bright Star Catalogue and others. All credits";
  link.style.cssText = "position:fixed;left:6px;bottom:6px;z-index:5;max-width:calc(100% - 140px);padding:1px 6px;border-radius:4px;background:rgba(11,16,32,.78);color:#c9d1ec;font:.7rem/1.4 system-ui,sans-serif;text-decoration:underline";
  document.body.append(link);
}
