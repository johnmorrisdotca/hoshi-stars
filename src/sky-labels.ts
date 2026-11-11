// Names for the brightest stars and faint constellation lines, for a sky a page draws itself (a three.js scene, a canvas, an SVG): the page says where a star is on its screen, this chooses and lays out, and the page draws.
// The sky-labels tier (`@johnmorrisdotca/hoshi-stars/sky-labels`). Pure: no DOM, no clock; after the first call `update` and `point` allocate nothing.
export { DEFAULT_LABEL_STYLE, designationWidth, LABEL_STYLE_PROPERTIES, labelHeight, labelStyle, labelStyleFrom, labelStyleVars, labelText, labelWidth, type LabelStyle } from "./label-style.ts";
export {
  createStarNames,
  discCover,
  LABEL_SIDES,
  placeLabel,
  STAR_NAMES_ATTRIBUTES,
  starNamesFromAttributes,
  type CoverMask,
  type LabelSide,
  type NameLanguage,
  type ScreenPoint,
  type SkyProjector,
  type SkyView,
  type StarNameLabel,
  type StarNames,
  type StarNamesSettings,
} from "./star-names.ts";
export {
  clampStrength,
  CONSTELLATION_LINES_ATTRIBUTE,
  createFigureLines,
  DEFAULT_LINE_STRENGTH,
  lineStrengthFromAttribute,
  type Box,
  type FigureLines,
  type FigureLinesSettings,
  type FigureName,
  type FigureOnScreen,
} from "./figure-lines.ts";
