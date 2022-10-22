function BadRequestException(reason) {
  this.status = 400;
  this.statusText = 'Bad Request';
  this.reason = reason;
}

function UnauthorizedException(reason) {
  this.status = 401;
  this.statusText = 'Unauthorized';
  this.reason = reason;
}

function basicAuthentication(request) {
  const Authorization = request.headers.get('Authorization');

  const [scheme, encoded] = Authorization.split(' ');

  // The Authorization header must start with Basic, followed by a space.
  if (!encoded || scheme !== 'Basic') {
    throw new BadRequestException('Malformed authorization header.');
  }

  // Decodes the base64 value and performs unicode normalization.
  // @see https://datatracker.ietf.org/doc/html/rfc7613#section-3.3.2 (and #section-4.2.2)
  // @see https://dev.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  const buffer = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const decoded = new TextDecoder().decode(buffer).normalize();

  // The username & password are split by the first colon.
  //=> example: "username:password"
  const index = decoded.indexOf(':');

  // The user & password are split by the first colon and MUST NOT contain control characters.
  // @see https://tools.ietf.org/html/rfc5234#appendix-B.1 (=> "CTL = %x00-1F / %x7F")
  if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    throw new BadRequestException('Invalid authorization value.');
  }

  return {
    user: decoded.substring(0, index),
    pass: decoded.substring(index + 1),
  };
}

function verifyCredentials(env, user, pass) {
  if (env.ADMIN_USERNAME !== user) {
    throw new UnauthorizedException('Invalid credentials.');
  }

  if (env.ADMIN_PASSWORD !== pass) {
    throw new UnauthorizedException('Invalid credentials.');
  }
}

const basicAuth = async ({request, next, env}) => {
  try {
    // The "Authorization" header is sent when authenticated.
    if (request.headers.has('Authorization')) {
      // Throws exception when authorization fails.
      const {user, pass} = basicAuthentication(request);
      verifyCredentials(env, user, pass);
    } else {
      // Not authenticated.
      return new Response('You need to login.', {
        status: 401,
        headers: {
          // Prompts the user for credentials.
          'WWW-Authenticate': 'Basic realm="my scope", charset="UTF-8"',
        },
      });
    }

    const response = await next();
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (err) {
    return new Response('Failed to login.', {
      status: 401,
      headers: {
        // Prompts the user for credentials.
        'WWW-Authenticate': 'Basic realm="my scope", charset="UTF-8"',
      },
    });
  }
};

export const onRequest = [basicAuth];
