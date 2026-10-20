import { Workbench } from "@/components/workbench";
import data from "@/lib/vernacular/benchmark/results.json";
import { summarize } from "@/lib/vernacular/benchmark/summarize";
import type { BenchmarkRun } from "@/lib/vernacular/benchmark/types";

export default function Home() {
  // Headline numbers from the published benchmark, computed on the server.
  const run = data as BenchmarkRun;
  const s = summarize(run.pairs, run.audiences);
  return <Workbench stats={{ lift: s.paired.meanDiff, missRate: s.arms.vernacular.missRate }} />;
}
