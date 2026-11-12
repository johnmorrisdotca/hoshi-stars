<script lang="ts">
  import "@johnmorrisdotca/hoshi-stars/chart/define";
  import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";

  let picked = $state("Tap a star.");
  const onPick = (event: Event) => {
    const { kind, id } = (event as CustomEvent<ChartPick>).detail;
    picked = `${kind} ${id ?? ""}`;
  };
</script>

<hoshi-chart constellation="Sco" layers="milky lines names" onhoshi-pick={onPick}></hoshi-chart>
<p>{picked}</p>
