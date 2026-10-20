// Calls the running app's MCP endpoint like an agent would.
// Usage: npm run mcp:smoke -- [base-url]   (default http://localhost:3000)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const base = process.argv[2] ?? "http://localhost:3000";
const main = async () => {
  const client = new Client({ name: "vernacular-smoke", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("/api/mcp", base)));
  const { tools } = await client.listTools();
  console.log("tools:", tools.map((t) => t.name).join(", "));
  const audience = await client.callTool({ name: "build_audience", arguments: { description: "new parents who love cooking" } });
  console.log("\nbuild_audience →", (audience.content as { text: string }[])[0].text);
  const grid = await client.callTool({
    name: "compare_audiences",
    arguments: {
      text: "Smoother than a Fleetwood Mac album and more addictive than a Succession binge.",
      audiences: [
        { label: "Gen Z", anchors: [{ query: "Bad Bunny", type: "artist" }], age: "24_and_younger" },
        { label: "55+", anchors: [{ query: "Eagles", type: "artist" }], age: "55_and_older" },
      ],
    },
  });
  console.log("\ncompare_audiences →\n" + (grid.content as { text: string }[])[0].text);
  const map = await client.callTool({
    name: "where_it_lands",
    arguments: {
      city: "Chicago",
      audience: { label: "Gen Z Latin-pop fans", anchors: [{ query: "Bad Bunny", type: "artist" }], age: "24_and_younger" },
      references: [{ query: "Seinfeld", type: "tv_show" }, { query: "Kali Uchis", type: "artist" }],
    },
  });
  console.log("\nwhere_it_lands →\n" + (map.content as { text: string }[])[0].text);
  await client.close();
};
main().catch((e) => {
  console.error("MCP smoke failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
