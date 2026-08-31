export interface ApiEnv {
  TWITTER_BEARER_TOKEN: string;
  ASSETS?: {
    fetch(request: Request | string): Promise<Response>;
  };
}
