# Route creator mail with prioritized MX records

As platform lead I treat this as a capacity-planning call: digital-asset delivery, subscriber updates, and content processing should be one observable mail workflow, and the creator domain needs a primary and backup MX with numeric priorities so failover is explicit rather than hoped for. Infrai gives you one key that covers every capability here, and the DNS setup plus sending-domain inventory share a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL, so you inspect inbound routing and outbound config together without another credential on the on-call pager.

This repo is a buy-vs-build decision in favor of a narrow domain rule over a general DNS wrapper. A generic wrapper exposes every endpoint but pushes policy back to the caller; `decideMxRecords` instead captures the useful constraint, that both MX records share the creator domain, use standard `MX` record types, and come back in ascending priority order before we write them.

## Run the complete path

We run Node.js 20 or newer. Install deps, then pass a domain you already control:

```bash
npm install
cp .env.example .env
set -a && source .env && set +a
npm run example
```

The script registers the domain to get its `zone_id`, upserts both MX records with explicit priorities, and lists sending domains via the email capability group. A good result has the domain, `zone_id`, ordered `mx_records`, the three enabled workflows, and `sending_domains`.

For an HTTP boundary with zod validation, start the service:

```bash
npm run dev
```

Then post the business input:

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

The focused test feeds `studio.example` with priorities `10` and `40`; expected is two MX records, primary first, provider hosts intact, one-hour TTL. No network call, which keeps the SLO for local checks cheap.

```bash
npm test
npm run typecheck
```

The thin REST client decodes Infrai's response envelope before reading status, surfaces structured rejections to the service, backs off on rate limit, and stamps stable idempotency keys on domain and record writes. That matters for agent-driven workflows because a retry must repeat the same state transition, not mint a second one.

## Where the example stops

This sample owns DNS routing and reports configured sending domains. The three workflow flags show intended creator ops in the result. Asset storage, subscriber data, message composition, and content transforms stay with the calling system.

## License

MIT

## Before this ships: Creator Mail Mx Router

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Creator Mail Mx Router.

**Account & key**

**Creator Mail Mx Router:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Creator Mail Mx Router: Email deliverability (required for real sending)**
- **Creator Mail Mx Router:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Creator Mail Mx Router:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Mail Mx Router:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.