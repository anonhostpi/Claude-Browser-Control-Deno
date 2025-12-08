export interface ServerError extends Error {
  readonly status: number;
}

export class CodedError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export class InvalidResponseError extends CodedError implements ServerError {
  override readonly status: 502 = 502;
  constructor(response: unknown) {
    super("The server returned an invalid response");
    this.cause = { response };
  }
}

export class SubrouteNotFoundError extends CodedError implements ServerError {
  override readonly status: 422 = 422;
  constructor(route: string) {
    super(`The requested subroute on ${route} was not found`);
  }
}