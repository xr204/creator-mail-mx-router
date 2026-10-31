import { describe, expect, it } from "vitest";
import { creatorMailRequestSchema, decideMxRecords } from "../src/mail_routing.js";

describe("creator mail routing decision", () => {
  it("orders delivery MX records by provider priority", () => {
    const input = creatorMailRequestSchema.parse({
      domain: "studio.example",
      provider: {
        primaryMx: "inbound-a.provider.example",
        primaryPriority: 10,
        backupMx: "inbound-b.provider.example",
        backupPriority: 40
      },
      workflows: {
        digitalAssetDelivery: true,
        subscriberUpdates: true,
        contentProcessing: true
      }
    });

    expect(decideMxRecords(input)).toEqual([
      { record_type: "MX", name: "studio.example", content: "inbound-a.provider.example", priority: 10, ttl: 3600 },
      { record_type: "MX", name: "studio.example", content: "inbound-b.provider.example", priority: 40, ttl: 3600 }
    ]);
  });
});
