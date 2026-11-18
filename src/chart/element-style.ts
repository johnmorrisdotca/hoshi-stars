// The chart element's style sheet, as one string. Moved out of element.ts as it was.
import { CHART_BACKGROUND } from "./svg.ts";

export const STYLE = `:host{display:block;position:relative;aspect-ratio:16/10;min-height:160px;background:${CHART_BACKGROUND};border-radius:8px;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;outline:none}
:host(:focus-visible){box-shadow:0 0 0 3px var(--hoshi-focus,#8fb3ff)}:host([theme="light"]:focus-visible){box-shadow:0 0 0 3px var(--hoshi-focus,#1d4ed8)}
svg{position:absolute;inset:0;width:100%;height:100%;display:block}
[data-marker]{cursor:pointer;outline:none}[data-marker]:focus-visible circle{stroke:var(--hoshi-focus,#8fb3ff);stroke-width:3}`;
