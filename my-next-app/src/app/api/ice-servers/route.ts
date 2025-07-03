import { NextResponse } from 'next/server';

export async function GET() {
  // В реальном приложении используйте переменные окружения!
  const turnServer =
    process.env.TURN_DOMAIN ||
    process.env.REALM ||
    (process.env.NODE_ENV === 'development'
      ? 'localhost'
      : 'your-production-domain.com');

  const username = process.env.TURN_USERNAME || 'local_user';
  const credential = process.env.TURN_PASSWORD || 'local_password';

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