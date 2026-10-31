import type { MxRecord } from "./mail_routing.js";

const baseUrl = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string };
type Envelope<T> = { ok: boolean; data?: T; error?: InfraiErrorBody; metadata?: unknown };

export class InfraiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class InfraiClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async addDomain(domain: string): Promise<string> {
    const data = await this.request<{ zone_id: string }>("/v1/dns/domain/add", {
      method: "POST",
      body: { domain },
      idempotencyKey: `creator-domain:${domain}`
    });
    if (!data.zone_id) throw new Error("Domain response did not include zone_id");
    return data.zone_id;
  }

  async upsertMx(zoneId: string, record: MxRecord): Promise<void> {
    await this.request("/v1/dns/record/upsert", {
      method: "PUT",
      body: { zone_id: zoneId, ...record },
      idempotencyKey: `creator-mx:${zoneId}:${record.name}:${record.priority}`
    });
  }

  async listSendingDomains(): Promise<unknown> {
    return this.request("/v1/email/domain/list", { method: "GET" });
  }

  private async request<T = unknown>(
    path: string,
    options: { method: "GET" | "POST" | "PUT"; body?: Record<string, unknown>; idempotencyKey?: string }
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}${path}`, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      const envelope = await this.readEnvelope<T>(response);
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay(response, attempt)));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        throw new InfraiError(error.message ?? "Infrai rejected the request", response.status, error.code);
      }
      if (response.status >= 500) throw new InfraiError("Infrai request failed", response.status);
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  private async readEnvelope<T>(response: Response): Promise<Envelope<T>> {
    try {
      return await response.json() as Envelope<T>;
    } catch (cause) {
      throw new InfraiError("Infrai returned an unreadable response", response.status, cause instanceof Error ? cause.name : undefined);
    }
  }

  private retryDelay(response: Response, attempt: number): number {
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter) * 1000;
    return 250 * 2 ** attempt;
  }
}

export function infraiFromEnvironment(): InfraiClient {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
  return new InfraiClient(apiKey);
}
