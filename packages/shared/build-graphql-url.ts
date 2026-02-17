import { GRAPHQL_FEATURES, GRAPHQL_QUERY_ID } from "./consts.ts";

export function buildGraphqlUrl(tweetId: string): string {
  const variables = {
    tweetId,
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false,
  };

  return `https://api.twitter.com/graphql/${GRAPHQL_QUERY_ID}/TweetResultByRestId?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(GRAPHQL_FEATURES))}`;
}
