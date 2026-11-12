<script setup lang="ts">
import "@johnmorrisdotca/hoshi-stars/chart/define";
import type { ChartPick } from "@johnmorrisdotca/hoshi-stars/chart/element";
import { ref } from "vue";

const picked = ref("Tap a star.");
const onPick = (event: Event) => {
  const { kind, id } = (event as CustomEvent<ChartPick>).detail;
  picked.value = `${kind} ${id ?? ""}`;
};
</script>

<template>
  <hoshi-chart constellation="Lyr" layers="milky lines names" @hoshi-pick="onPick"></hoshi-chart>
  <p>{{ picked }}</p>
</template>
