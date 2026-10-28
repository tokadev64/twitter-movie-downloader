import { beforeEach, expect, test } from "bun:test";

import { createApp } from "../packages/api/app.ts";
import { resetGuestTokenCache } from "../packages/api/twitter-client.ts";
import { buildGraphqlUrl } from "../packages/shared/build-graphql-url.ts";
import type { ApiErrorResponse } from "../packages/shared/types.ts";
import { installFetchStub } from "./support/fetch-mock.ts";
import {
  EXTERNAL_HIGH_MP4_URL,
  HIGH_MP4_URL,
  HLS_URL,
  LOW_MP4_URL,
  TWEET_ID,
  UNKNOWN_MP4_URL,
  makeTweetData,
  makeTweetDataWithVariants,
  makeVideoVariant,
} from "./support/fixtures.ts";

const bearerEnv = { TWITTER_BEARER_TOKEN: "Bearer e2e-api" };
const noBearerEnv = { TWITTER_BEARER_TOKEN: "" };

const infoVariants = [
  makeVideoVariant(HLS_URL, "application/x-mpegURL"),
  makeVideoVariant(HIGH_MP4_URL, "video/mp4", 2176000),
  makeVideoVariant(LOW_MP4_URL, "video/mp4", 832000),
  makeVideoVariant(UNKNOWN_MP4_URL, "video/mp4"),
];

const downloadExternalVariants = [
  makeVideoVariant(HLS_URL, "application/x-mpegURL"),
  makeVideoVariant(EXTERNAL_HIGH_MP4_URL, "video/mp4", 2176000),
];

beforeEach(() => {
  resetGuestTokenCache();
});

function expectErrorBody(body: { data: null; error: ApiErrorResponse }, code: string): void {
  expect(body.data).toBeNull();
  expect(body.error.code).toEqual(code);
  expect(typeof body.error.error).toEqual("string");
}

test("API-TWEETID-TOLERANT: URL-encoded tweet URLs are accepted by the :id path", async () => {
  const stub = installFetchStub({ tweetData: makeTweetDataWithVariants(infoVariants) });
  try {
    const encoded = encodeURIComponent("https://x.com/u/status/42");
    const res = await createApp().request(`/api/tweet/${encoded}`, undefined, bearerEnv);
    expect(res.status).toEqual(200);

    const body = await res.json();
    expect(body.data.tweetId).toEqual("42");
    expect(body.data.mediaList.map((media: { quality: string }) => media.quality)).toEqual([
      "2176000",
      "832000",
      "unknown",
    ]);

    const graphqlLog = stub.logs.find((entry) => entry.url.includes("/graphql/"));
    expect(graphqlLog?.url).toEqual(buildGraphqlUrl("42"));
    expect(graphqlLog?.guestToken).toEqual("e2e-guest-token");
  } finally {
    stub.restore();
  }
});

test("API-HLS-EXCLUDED: /api/tweet/:id omits HLS and enriches only allowed mp4 hosts", async () => {
  const stub = installFetchStub({
    tweetData: makeTweetDataWithVariants(infoVariants),
    contentLength: "1234",
  });
  try {
    const res = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(res.status).toEqual(200);

    const body = await res.json();
    expect(body.data.tweetId).toEqual(TWEET_ID);
    expect(body.data.mediaList.map((media: { quality: string }) => media.quality)).toEqual([
      "2176000",
      "832000",
      "unknown",
    ]);

    const [high, low, unknown] = body.data.mediaList;
    expect(high.videoUrl).toEqual(HIGH_MP4_URL);
    expect(high.fileSizeBytes).toEqual(1234);
    expect(low.videoUrl).toEqual(LOW_MP4_URL);
    expect(low.fileSizeBytes).toEqual(1234);
    expect(unknown.videoUrl).toEqual(UNKNOWN_MP4_URL);
    expect(unknown.fileSizeBytes).toBeUndefined();

    expect(stub.logs.find((entry) => entry.url.includes("/graphql/"))?.url).toEqual(
      buildGraphqlUrl(TWEET_ID),
    );
    expect(stub.logs.filter((entry) => entry.method === "HEAD").map((entry) => entry.url)).toEqual([
      HIGH_MP4_URL,
      LOW_MP4_URL,
    ]);
  } finally {
    stub.restore();
  }
});

test("API-ENRICH-GATED-FAILOPEN: HEAD failure or non-finite content-length keeps media unchanged", async () => {
  const stub = installFetchStub({
    tweetData: makeTweetDataWithVariants([makeVideoVariant(HIGH_MP4_URL, "video/mp4", 2176000)]),
    videoStatus: 500,
    contentLength: "not-a-number",
  });
  try {
    const res = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(res.status).toEqual(200);

    const body = await res.json();
    expect(body.data.mediaList[0].fileSizeBytes).toBeUndefined();
    expect(body.data.mediaList[0].videoUrl).toEqual(HIGH_MP4_URL);
    expect(stub.logs.filter((entry) => entry.method === "HEAD").length).toEqual(1);
  } finally {
    stub.restore();
  }
});

test("API-DOWNLOAD-QUALITY-FIRST: missing quality returns 400 before tweet ID validation or fetch", async () => {
  const stub = installFetchStub({ tweetData: makeTweetData([]) });
  try {
    const res = await createApp().request(
      "/api/tweet/not-a-valid-id/download?quality=",
      undefined,
      bearerEnv,
    );
    expect(res.status).toEqual(400);

    const body = await res.json();
    expectErrorBody(body, "INVALID_REQUEST");
    expect(body.error.error).toEqual("quality parameter is required");
    expect(stub.logs.length).toEqual(0);
  } finally {
    stub.restore();
  }
});

test("API-DOWNLOAD-QUALITY-NOT-FOUND: missing selected quality returns 404 NOT_FOUND after media lookup", async () => {
  const stub = installFetchStub({ tweetData: makeTweetDataWithVariants(infoVariants) });
  try {
    const res = await createApp().request(
      `/api/tweet/${TWEET_ID}/download?quality=999`,
      undefined,
      bearerEnv,
    );
    expect(res.status).toEqual(404);

    const body = await res.json();
    expectErrorBody(body, "NOT_FOUND");
    expect(body.error.error).toEqual("No video found with quality: 999");
    expect(stub.logs.filter((entry) => entry.url.includes("guest")).length).toEqual(1);
    expect(stub.logs.filter((entry) => entry.url.includes("/graphql/")).length).toEqual(1);
  } finally {
    stub.restore();
  }
});

test("API-DOWNLOAD-CQ9: download proxies selected mp4 URLs without host validation", async () => {
  const stub = installFetchStub({ tweetData: makeTweetDataWithVariants(downloadExternalVariants) });
  try {
    const res = await createApp().request(
      `/api/tweet/${TWEET_ID}/download?quality=2176000`,
      undefined,
      bearerEnv,
    );
    expect(res.status).toEqual(200);
    expect(res.headers.get("Content-Type")).toEqual("video/mp4");
    expect(res.headers.get("Content-Disposition")).toEqual(
      `attachment; filename="twitter_video_${TWEET_ID}.mp4"`,
    );
    expect(await res.text()).toEqual("fake-video-bytes");

    expect(
      stub.logs.some((entry) => entry.method === "GET" && entry.url === EXTERNAL_HIGH_MP4_URL),
    ).toEqual(true);
  } finally {
    stub.restore();
  }
});

test("INV-API-STATUS: Invalid substrings map to 400 and other upstream failures map to 502", async () => {
  const invalidStub = installFetchStub({ tweetData: makeTweetData([]) });
  try {
    const invalidRes = await createApp().request("/api/tweet/not-a-valid-id", undefined, bearerEnv);
    expect(invalidRes.status).toEqual(400);
    const invalidBody = await invalidRes.json();
    expectErrorBody(invalidBody, "INVALID_REQUEST");
    expect(invalidBody.error.error).toEqual("Invalid Twitter/X URL");
    expect(invalidStub.logs.length).toEqual(0);
  } finally {
    invalidStub.restore();
  }

  const noBearerStub = installFetchStub({ tweetData: makeTweetData([]) });
  try {
    const noBearerRes = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, noBearerEnv);
    expect(noBearerRes.status).toEqual(502);
    const noBearerBody = await noBearerRes.json();
    expectErrorBody(noBearerBody, "UPSTREAM_ERROR");
    expect(noBearerBody.error.error).toEqual(
      "TWITTER_BEARER_TOKEN environment variable is required",
    );
    expect(noBearerStub.logs.length).toEqual(0);
  } finally {
    noBearerStub.restore();
  }

  const guestStub = installFetchStub({ guestStatus: 401 });
  try {
    const guestRes = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(guestRes.status).toEqual(502);
    const guestBody = await guestRes.json();
    expectErrorBody(guestBody, "UPSTREAM_ERROR");
    expect(guestBody.error.error).toEqual("Failed to get guest token: 401");
    expect(guestStub.logs.length).toEqual(1);
  } finally {
    guestStub.restore();
  }

  const graphqlStub = installFetchStub({ tweetStatus: 404, tweetData: makeTweetData([]) });
  try {
    const graphqlRes = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(graphqlRes.status).toEqual(502);
    const graphqlBody = await graphqlRes.json();
    expectErrorBody(graphqlBody, "UPSTREAM_ERROR");
    expect(graphqlBody.error.error).toEqual("Failed to fetch tweet data: 404");
    expect(graphqlStub.logs.filter((entry) => entry.url.includes("guest")).length).toEqual(1);
    expect(graphqlStub.logs.filter((entry) => entry.url.includes("/graphql/")).length).toEqual(1);
  } finally {
    graphqlStub.restore();
  }

  const tombstoneStub = installFetchStub({
    tweetData: {
      data: {
        tweetResult: {
          result: {
            __typename: "TweetTombstone",
          },
        },
      },
    },
  });
  try {
    const tombstoneRes = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(tombstoneRes.status).toEqual(502);
    const tombstoneBody = await tombstoneRes.json();
    expectErrorBody(tombstoneBody, "UPSTREAM_ERROR");
    expect(tombstoneBody.error.error).toEqual(
      "Tweet is not available (deleted, protected, or restricted)",
    );
  } finally {
    tombstoneStub.restore();
  }
});

test("API-GUEST-TOKEN-CACHE: the cache expires exactly when TTL elapses", async () => {
  const stub = installFetchStub({ tweetData: makeTweetDataWithVariants(infoVariants) });
  const originalNow = Date.now;
  let fakeNow = 1_000_000;
  Object.defineProperty(Date, "now", {
    configurable: true,
    writable: true,
    value: () => fakeNow,
  });

  try {
    await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(stub.logs.filter((entry) => entry.url.includes("guest")).length).toEqual(1);

    fakeNow += 30 * 60 * 1000;
    await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(stub.logs.filter((entry) => entry.url.includes("guest")).length).toEqual(2);
  } finally {
    Object.defineProperty(Date, "now", {
      configurable: true,
      writable: true,
      value: originalNow,
    });
    stub.restore();
  }
});

test("CQ6: graphql failure does not invalidate a previously cached guest token", async () => {
  const options = { tweetData: makeTweetDataWithVariants(infoVariants), tweetStatus: 404 };
  const stub = installFetchStub(options);
  try {
    const failedRes = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(failedRes.status).toEqual(502);
    expect(stub.logs.filter((entry) => entry.url.includes("guest")).length).toEqual(1);

    options.tweetStatus = 200;
    const cachedRes = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(cachedRes.status).toEqual(200);
    expect(stub.logs.filter((entry) => entry.url.includes("guest")).length).toEqual(1);
    const graphqlLogs = stub.logs.filter((entry) => entry.url.includes("/graphql/"));
    expect(graphqlLogs.length).toEqual(2);
    expect(graphqlLogs.at(-1)?.guestToken).toEqual("e2e-guest-token");
  } finally {
    stub.restore();
  }
});

test("CQ6: guest token activate failure does not populate the cache", async () => {
  const options = { tweetData: makeTweetDataWithVariants(infoVariants), guestStatus: 401 };
  const stub = installFetchStub(options);
  try {
    const failedRes = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(failedRes.status).toEqual(502);
    expect(stub.logs.filter((entry) => entry.url.includes("guest")).length).toEqual(1);

    options.guestStatus = 200;
    const okRes = await createApp().request(`/api/tweet/${TWEET_ID}`, undefined, bearerEnv);
    expect(okRes.status).toEqual(200);
    expect(stub.logs.filter((entry) => entry.url.includes("guest")).length).toEqual(2);
  } finally {
    stub.restore();
  }
});
