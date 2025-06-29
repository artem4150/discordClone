import { NextResponse } from 'next/server';

export async function GET() {
  // В реальном приложении используйте переменные окружения!
const turnServer = process.env.NODE_ENV === 'development' 
  ? 'localhost' 
  : 'your-production-domain.com';

return NextResponse.json({
  iceServers: [
    {
      urls: [
        `turn:${turnServer}:3478?transport=udp`,
        `turn:${turnServer}:3478?transport=tcp`
      ],
      username: "local_user",
      credential: "local_password"
    }
  ]
});
}