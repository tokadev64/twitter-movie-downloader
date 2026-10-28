export interface FetchLogEntry {
  url: string;
  method: string;
  authorization: string | null;
  guestToken: string | null;
}

export interface FetchStubOptions {
  guestStatus?: number;
  guestToken?: string;
  tweetStatus?: number;
  // oxlint-disable-next-line typescript/no-explicit-any -- stub accepts arbitrary fixture JSON
  tweetData?: any;
  videoStatus?: number;
  videoBody?: string;
  contentLength?: string | null;
  onLog?: (entry: FetchLogEntry) => void;
}

export interface FetchStub {
  logs: FetchLogEntry[];
  restore(): void;
}

function normalizeFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function installFetchStub(options: FetchStubOptions): FetchStub {
  const original = globalThis.fetch;
  const logs: FetchLogEntry[] = [];

  const fetchStub = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = normalizeFetchUrl(input);
      const method = init?.method ?? "GET";
      const headers = new Headers(init?.headers ?? {});
      const entry: FetchLogEntry = {
        url,
        method,
        authorization: headers.get("authorization"),
        guestToken: headers.get("x-guest-token"),
      };
      logs.push(entry);
      options.onLog?.(entry);

      if (url.includes("/1.1/guest/activate.json")) {
        return new Response(
          JSON.stringify({ guest_token: options.guestToken ?? "e2e-guest-token" }),
          {
            status: options.guestStatus ?? 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url.includes("/graphql/") || url.includes("TweetResultByRestId")) {
        return new Response(JSON.stringify(options.tweetData ?? { data: {} }), {
          status: options.tweetStatus ?? 200,
          headers: { "content-type": "application/json" },
        });
      }

      const headersOut: Record<string, string> = { "content-type": "video/mp4" };
      if (options.contentLength !== undefined && options.contentLength !== null) {
        headersOut["content-length"] = options.contentLength;
      }
      return new Response(options.videoBody ?? "fake-video-bytes", {
        status: options.videoStatus ?? 200,
        headers: headersOut,
      });
    },
    {
      preconnect() {},
    },
  );

  globalThis.fetch = fetchStub;

  return {
    logs,
    restore() {
      globalThis.fetch = original;
    },
  };
}
