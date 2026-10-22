import type { YearResultData } from "../types";

const modules = import.meta.glob("./results/*-results.json", {
  eager: true,
  import: "default",
});

export const resultsByYear = new Map(
  Object.entries(modules)
    .map(([path, resultData]) => [
      path.replace("./results/", "").replace(/-results\.json$/, ""),
      resultData as YearResultData,
    ] as const)
    .filter(([, resultData]) => resultData.year > 0),
);
