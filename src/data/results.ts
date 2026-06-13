import type { YearResultData } from "../types";

const modules = import.meta.glob("./results/*-results.json", {
  eager: true,
  import: "default",
});

export const resultsByYear = new Map(
  Object.values(modules)
    .map((resultData) => resultData as YearResultData)
    .filter((resultData) => resultData.year > 0)
    .map((resultData) => [String(resultData.year), resultData]),
);
