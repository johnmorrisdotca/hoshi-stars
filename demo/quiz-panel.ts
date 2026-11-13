// The "Put it in your page" panel of the quiz page: the quiz is a page that runs, so the only way to embed it is an iframe (`embed-quiz.html`). The code follows the choices of the page: quiz.ts tells this script when one changes.
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import { quizChoiceOf, quizFrameAddress, quizFrameCode, type QuizChoice } from "./quiz-code.ts";
import { langNow } from "./thumbs.ts";
import { say } from "./words.ts";

const panel = document.getElementById("embed-panel") as EmbedPanelElement;
let choice: QuizChoice = { ...quizChoiceOf(new URLSearchParams(location.search)), lang: langNow() };
panel.kinds = ["iframe"];
panel.kind = "iframe";
panel.generate = ({ size, preview }) => quizFrameCode(choice, say("qz_embedLabel"), size, preview);
panel.credits = say("credit");
panel.docsHref = "docs/index.html";
function codes(): void {
  choice = { ...choice, lang: langNow() };
  panel.openHref = quizFrameAddress("", choice);
  panel.credits = say("credit");
  panel.update();
}
document.addEventListener("qz-change", (event) => {
  choice = { ...(event as CustomEvent<QuizChoice>).detail, lang: langNow() };
  codes();
});
document.addEventListener("hoshi-language", codes);
codes();
