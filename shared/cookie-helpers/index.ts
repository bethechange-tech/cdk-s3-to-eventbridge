import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import { APIGatewayEvent, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';

/**
 * Build a string appropriate for a `Set-Cookie` header.
 * @param {string} key     Key-name for the cookie.
 * @param {string} value   Value to assign to the cookie.
 * @param {object} options Optional parameter that can be use to define additional option for the cookie.
 * ```
 * {
 *     secure: boolean // Watever to output the secure flag. Defaults to true.
 *     httpOnly: boolean // Watever to ouput the HttpOnly flag. Defaults to true.
 *     domain: string // Domain to which the limit the cookie. Default to not being outputted.
 *     path: string // Path to which to limit the cookie. Defaults to '/'
 *     expires: UTC string or Date // When this cookie should expire.  Default to not being outputted.
 *     maxAge: integer // Max age of the cookie in seconds. For compatibility with IE, this will be converted to a
 *          `expires` flag. If both the expires and maxAge flags are set, maxAge will be ignores. Default to not being
 *           outputted.
 * }
 * ```
 * @return string
 */
export function setCookieString(key: string, value: string, options?: Record<string, any>) {
  const defaults = {
    secure: true,
    httpOnly: true,
    domain: false,
    expires: new Date(new Date().getTime() + parseInt(options?.maxAge || 12) * 1000),
    maxAge: false,
  };

  if (typeof options == 'object') {
    options = Object.assign({}, defaults, options);
  } else {
    options = defaults;
  }

  let cookie = key + '=' + value;

  if (options.domain) {
    cookie = cookie + '; domain=' + options.domain;
  }

  if (options.path) {
    cookie = cookie + '; path=' + options.path;
  }

  if (!options.expires && options.maxAge) {
    options.expires = new Date(new Date().getTime() + parseInt(options.maxAge) * 1000); // JS operate in Milli-seconds
  }

  if (typeof options.expires == 'object' && typeof options.expires.toUTCString) {
    options.expires = options.expires.toUTCString();
  }

  if (options.expires) {
    cookie = cookie + '; expires=' + options.expires.toString();
  }

  if (options.secure) {
    cookie = cookie + '; Secure';
  }

  if (options.httpOnly) {
    cookie = cookie + '; HttpOnly';
  }

  return cookie;
}

/**
 * Receives an array of headers and extract the value from the cookie header
 * @param  {String}   errors List of errors
 * @return {Object}
 */
export function getCookiesFromHeader(
  headers: APIGatewayEvent['headers'] | APIGatewayRequestAuthorizerEvent['headers']
): Record<string, any> {
  if (headers === null || headers === undefined || headers.Cookie === undefined) {
    return {};
  }

  // Split a cookie string in an array (Originally found http://stackoverflow.com/a/3409200/1427439)
  const list = {},
    rc = headers.Cookie;

  rc &&
    rc.split(';').forEach((cookie: string) => {
      const parts = cookie.split('=');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      const key = parts.shift().trim();
      const value = decodeURI(parts.join('='));
      if (key != '') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        list[key] = value;
      }
    });

  return list;
}

/**
 * create access token to monitor if uder is logged in or out
 * @param id
 * signAccessToken(id);
 * // returns JWT token
 * @returns {String} returns The JSON Web Token string
 */
const signAccessToken = (id: string) => {
  const JWT_SECRET = String(process.env.JWT_SECRET) || 'The JSON Web Token string';

  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '60d',
  });
};

export const verifyAccessToken = (token: string) => {
  // 2) Verification token
  return promisify(jwt.verify)(token, process.env.JWT_SECRET as string) as unknown as {
    id: string;
  };
};

/**
 * create access token to monitor if user is logged in or out
 * @param user
 * @param headers
 * @example
 * createSendAccessToken(user, headers);
 * // returns { status, token, user }
 * @returns {String} status of success if successful
 * @returns {Object} users information
 * @returns {String} access token
 */
export const createSendAccessToken = (
  user: Record<string, any>,
  headers: APIGatewayEvent['headers']
) => {
  const token = signAccessToken(user.id);

  const JWT_COOKIE_EXPIRES_IN_DAYS = Number(process.env.JWT_COOKIE_EXPIRES_IN_DAYS) || 2;

  const cookie = setCookieString('jwt', token, {
    expires: new Date(Date.now() + JWT_COOKIE_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: headers.secure || headers['x-forwarded-proto'] === 'https',
  });

  user.password = undefined;

  return {
    token,
    user,
    cookie,
  };
};
