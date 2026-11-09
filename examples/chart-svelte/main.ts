import { mount } from "svelte";
import Chart from "./Chart.svelte";

mount(Chart, { target: document.getElementById("app")!, props: { constellation: "Ori" } });
