export class ApiResponses {
  private static _DefineResponse(statusCode = 502, data = {}) {
    return {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Origin': '*',
      },
      statusCode,
      body: JSON.stringify(data),
    };
  }

  static _200(data = {}) {
    return this._DefineResponse(200, data);
  }

  static _204(data = {}) {
    return this._DefineResponse(204, data);
  }

  static _400(data = {}) {
    return this._DefineResponse(400, data);
  }
  static _404(data = {}) {
    return this._DefineResponse(404, data);
  }
}
