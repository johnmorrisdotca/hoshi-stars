<script lang="ts">
  import "@johnmorrisdotca/hoshi-stars/flight/define";
  import type { FlightChange, HoshiFlightElement } from "@johnmorrisdotca/hoshi-stars/flight/element";

  let flight: HoshiFlightElement;
  let where = $state("sun");
  const onChange = (event: Event) => {
    const { change, at } = (event as CustomEvent<FlightChange>).detail;
    if (change !== "moving") where = at;
  };
</script>

<hoshi-flight bind:this={flight} at="sun" style="height: 60vh" onhoshi-flight={onChange}></hoshi-flight>
<button type="button" onclick={() => flight.goTo("hr-7001")}>Fly to Vega</button>
<p>{where}</p>
