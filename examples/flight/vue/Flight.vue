<script setup lang="ts">
import "@johnmorrisdotca/hoshi-stars/flight/define";
import type { FlightChange, HoshiFlightElement } from "@johnmorrisdotca/hoshi-stars/flight/element";
import { ref } from "vue";

const flight = ref<HoshiFlightElement>();
const where = ref("sun");
const onChange = (event: Event) => {
  const { change, at } = (event as CustomEvent<FlightChange>).detail;
  if (change !== "moving") where.value = at;
};
const fly = () => flight.value?.goTo("hr-7001");
</script>

<template>
  <hoshi-flight ref="flight" at="sun" style="height: 60vh" @hoshi-flight="onChange"></hoshi-flight>
  <button type="button" @click="fly">Fly to Vega</button>
  <p>{{ where }}</p>
</template>
