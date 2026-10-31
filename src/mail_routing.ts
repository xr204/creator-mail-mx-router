import { z } from "zod";

export const creatorMailRequestSchema = z.object({
  domain: z.string().trim().toLowerCase().regex(/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/),
  provider: z.object({
    primaryMx: z.string().trim().min(1),
    primaryPriority: z.number().int().min(0).max(65535),
    backupMx: z.string().trim().min(1),
    backupPriority: z.number().int().min(0).max(65535)
  }).refine((provider) => provider.primaryPriority !== provider.backupPriority, {
    message: "MX priorities must be distinct"
  }),
  workflows: z.object({
    digitalAssetDelivery: z.boolean(),
    subscriberUpdates: z.boolean(),
    contentProcessing: z.boolean()
  })
});

export type CreatorMailRequest = z.infer<typeof creatorMailRequestSchema>;

export type MxRecord = {
  record_type: "MX";
  name: string;
  content: string;
  priority: number;
  ttl: number;
};

export function decideMxRecords(input: CreatorMailRequest): MxRecord[] {
  const records: MxRecord[] = [
    {
      record_type: "MX",
      name: input.domain,
      content: input.provider.primaryMx,
      priority: input.provider.primaryPriority,
      ttl: 3600
    },
    {
      record_type: "MX",
      name: input.domain,
      content: input.provider.backupMx,
      priority: input.provider.backupPriority,
      ttl: 3600
    }
  ];

  return records.sort((left, right) => left.priority - right.priority);
}

export function enabledWorkflows(input: CreatorMailRequest): string[] {
  return Object.entries(input.workflows)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}
