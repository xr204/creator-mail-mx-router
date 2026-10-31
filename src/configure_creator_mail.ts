import { fileURLToPath } from "node:url";
import { infraiFromEnvironment, type InfraiClient } from "./infrai_client.js";
import { creatorMailRequestSchema, decideMxRecords, enabledWorkflows } from "./mail_routing.js";

export async function configureCreatorMail(rawInput: unknown, infrai: InfraiClient) {
  const input = creatorMailRequestSchema.parse(rawInput);
  const zoneId = await infrai.addDomain(input.domain);
  const mxRecords = decideMxRecords(input);
  await Promise.all(mxRecords.map((record) => infrai.upsertMx(zoneId, record)));
  const sendingDomains = await infrai.listSendingDomains();
  return {
    domain: input.domain,
    zone_id: zoneId,
    mx_records: mxRecords,
    workflows: enabledWorkflows(input),
    sending_domains: sendingDomains
  };
}

async function runExample() {
  const result = await configureCreatorMail({
    domain: process.env.CREATOR_DOMAIN ?? "creator.example",
    provider: {
      primaryMx: "mx1.mail-provider.example",
      primaryPriority: 10,
      backupMx: "mx2.mail-provider.example",
      backupPriority: 20
    },
    workflows: {
      digitalAssetDelivery: true,
      subscriberUpdates: true,
      contentProcessing: true
    }
  }, infraiFromEnvironment());
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runExample().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
