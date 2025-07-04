import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

export async function GET() {
  // В реальном приложении используйте переменные окружения!
  const turnServer =
    process.env.TURN_DOMAIN ||
    process.env.REALM ||
    (process.env.NODE_ENV === 'development'
      ? 'localhost'
      : 'your-production-domain.com');

  // When TURN_SECRET is provided we generate time-limited credentials
  // following the TURN REST API specification. Username is the expiry
  // timestamp (current UNIX time + 24h) and credential is the HMAC-SHA1
  // of this username using the secret.
  let username: string;
  let credential: string;

  if (process.env.TURN_SECRET) {
    const expiry = Math.floor(Date.now() / 1000) + 24 * 3600;
    username = `${expiry}`;
    credential = createHmac('sha1', process.env.TURN_SECRET)
      .update(username)
      .digest('base64');
  } else {
    username = process.env.TURN_USERNAME || 'local_user';
    credential = process.env.TURN_PASSWORD || 'local_password';
  }

  return NextResponse.json({
    iceServers: [
      {
        urls: [
          `turn:${turnServer}:3478?transport=udp`,
          `turn:${turnServer}:3478?transport=tcp`
        ],
        username,
        credential
      }
    ]
  });
}