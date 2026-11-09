<script lang="ts">
  import "@johnmorrisdotca/hoshi-stars/chart";

  let { constellation }: { constellation?: string } = $props();
</script>

<hoshi-chart projection="stereographic" ra="84" dec="0" layers="milky-way,lines,names" {constellation} style="width: 100%; max-width: 640px"></hoshi-chart>
