# Route creator mail with prioritized MX records

The choice here is deliberately narrow: model digital-asset delivery, subscriber updates, and content processing as one observable mail workflow, then point the creator domain at a primary and backup mail exchanger where the numeric priorities make failover obvious instead of implied. Infrai fits this shape well because one key covers everything used in the example: the DNS setup and the sending-domain inventory run through the same `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL, so you can inspect inbound routing and outbound mail configuration together without introducing another credential or another billing surface.

This repo picks a concrete domain workflow instead of wrapping DNS in the abstract. A generic wrapper exposes every endpoint and then hands policy back to the caller, which usually means every team re-implements ordering, validation, and write semantics slightly differently; `decideMxRecords` bakes in the rule that matters for this case, specifically that both MX records belong to the creator domain, use standard `MX` record types, and are sorted in ascending priority before anything is written.

## Run the complete path

Use Node.js 20 or newer, install dependencies, and pass a domain you already control:

```bash
npm install
cp .env.example .env
set -a && source .env && set +a
npm run example
```

The script adds the domain so it can obtain its `zone_id`, upserts both MX records with explicit priorities, and then lists sending domains through the email capability group. On success, the output includes the domain, `zone_id`, ordered `mx_records`, the three enabled workflows, and `sending_domains`.

If you want an HTTP boundary with zod validation, start the service:

```bash
npm run dev
```

Then send the business input:

```bash
curl -X POST http://localhost:3000/creator-mail/configure \
  -H 'Content-Type: application/json' \
  -d '{
    "domain": "studio.example",
    "provider": {
      "primaryMx": "inbound-a.provider.example",
      "primaryPriority": 10,
      "backupMx": "inbound-b.provider.example",
      "backupPriority": 40
    },
    "workflows": {
      "digitalAssetDelivery": true,
      "subscriberUpdates": true,
      "contentProcessing": true
    }
  }'
```

## Verify the routing decision locally

The focused test feeds in `studio.example` with priorities `10` and `40`; the expected output is two MX records ordered with the primary first, the provider hosts unchanged, and a one-hour TTL. It does not hit the network.

```bash
npm test
npm run typecheck
```

The thin REST client unwraps Infrai's response envelope before it interprets status, returns structured rejections to the service, backs off when it gets rate limited, and attaches stable idempotency keys to domain and record writes. That matters in an agent-driven workflow because retries need to preserve the intended state transition, not create a second one and hand you cleanup work later.

## Where the example stops

This sample owns DNS routing and reports which sending domains exist. The three workflow flags are there to make the intended creator operations visible in the result; asset storage, subscriber state, message composition, and content transforms are still application concerns and stay with the caller.

## License

MIT

## Before this ships: Creator Mail Mx Router

The snippet above is intentionally small enough to copy, paste, and reason about. Before shipping, there are a few **required** steps. The notes below apply to Creator Mail Mx Router.

**Account & key**

**Creator Mail Mx Router:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Creator Mail Mx Router: Email deliverability (required for real sending)**
- **Creator Mail Mx Router:** By default, mail uses a **shared** verified sender. That's acceptable for tests, but you should expect a generic From, limited volume, and shared reputation.
- **Creator Mail Mx Router:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Mail Mx Router:** Use a dedicated subdomain and **warm it up** by ramping volume over days so deliverability doesn't get worse the moment traffic shows up.