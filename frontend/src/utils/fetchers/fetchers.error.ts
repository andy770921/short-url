export class ApiResponseError<TErrorBody = unknown> extends Error {
  /*
   * status is an error code for api error
   */
  public status: number;

  /*
   * status text is an error text for api error
   */
  public statusText: string;

  /*
   * body is an error response body
   */
  public body: TErrorBody;

  public constructor(rawResponse: Response, body: TErrorBody, message?: string) {
    super(message);
    this.name = 'ApiResponseError';
    this.statusText = rawResponse.statusText;
    this.status = rawResponse.status;
    this.body = body;
  }

  public hasStatusCode(statusCode: number) {
    return this.status === statusCode;
  }
}
