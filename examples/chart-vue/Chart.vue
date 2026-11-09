<script setup lang="ts">
import "@johnmorrisdotca/hoshi-stars/chart";

defineProps<{ constellation?: string }>();
</script>

<template>
  <hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" :constellation="constellation" style="width: 100%; max-width: 640px" />
</template>
