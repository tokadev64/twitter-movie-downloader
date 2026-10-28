import { appendFileSync } from "node:fs";

import { installFetchStub } from "./fetch-mock.ts";

const fetchLogPath = process.env.E2E_CLI_FETCH_LOG;
const tweetDataRaw = process.env.E2E_CLI_TWEET_DATA;
// oxlint-disable-next-line typescript/no-explicit-any -- preload accepts arbitrary fixture JSON
let tweetData: any;
if (tweetDataRaw) {
  tweetData = JSON.parse(tweetDataRaw);
}

installFetchStub({
  guestStatus: Number(process.env.E2E_CLI_GUEST_STATUS ?? 200),
  tweetStatus: Number(process.env.E2E_CLI_GRAPHQL_STATUS ?? 200),
  videoStatus: Number(process.env.E2E_CLI_VIDEO_STATUS ?? 200),
  tweetData,
  onLog: fetchLogPath
    ? (entry) => {
        appendFileSync(fetchLogPath, `${JSON.stringify(entry)}\n`);
      }
    : undefined,
});
