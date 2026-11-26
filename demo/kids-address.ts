// The address of one printable sheet: the same query the sheets page reads, so an iframe and a printed sheet open that sheet.

/** The published sheets page. */
export const KIDS_FRAME = "https://johnmorrisdotca.github.io/hoshi-stars/kids.html";

/** The choices an iframe of the sheets page has to carry. */
export interface KidsFrame {
  kind: string;
  level: string;
  which: string;
  country: string;
  region: string;
  lat: number | null;
  month: number;
  paper: string;
  type: string;
  form: string;
}

/** The sheets page opened on this sheet: kind, place, latitude, month and paper. */
export function kidsFrameAddress(choice: KidsFrame): string {
  const query = new URLSearchParams();
  query.set("kind", choice.kind);
  query.set("level", choice.level);
  query.set("c", choice.which);
  query.set("country", choice.country);
  query.set("region", choice.region);
  if (choice.lat !== null) query.set("lat", String(choice.lat));
  query.set("month", String(choice.month));
  query.set("paper", choice.paper);
  query.set("type", choice.type);
  query.set("form", choice.form);
  return `${KIDS_FRAME}?${query.toString()}`;
}
