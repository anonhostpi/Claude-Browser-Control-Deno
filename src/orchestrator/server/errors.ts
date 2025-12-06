export interface ServerError extends Error {
  readonly status: number;
}

export class InvalidResponseError extends Error implements ServerError {
  readonly status: 502 = 502;
  constructor(response: unknown) {
    super("The server returned an invalid response");
    this.cause = { response };
  }
}

export class SubrouteNotFoundError extends Error implements ServerError {
  readonly status: 422 = 422;
  constructor(route: string) {
    super(`The requested subroute on ${route} was not found`);
  }
}