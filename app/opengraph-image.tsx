import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          color: '#0f1728',
          background: 'linear-gradient(135deg, #eef6ff 0%, #ffffff 48%, #dbeafe 100%)',
          fontFamily: 'Arial',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 34, fontWeight: 700 }}>
          <div
            style={{
              width: 66,
              height: 66,
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ff503d',
              color: 'white',
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: '-0.08em',
            }}
          >
            D
          </div>
          CreatorDocks
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 88, lineHeight: 0.96, letterSpacing: '-0.07em', fontWeight: 700, maxWidth: 920 }}>
            Get matched with local brand deals that fit.
          </div>
          <div style={{ fontSize: 34, lineHeight: 1.28, color: '#53627a', maxWidth: 850 }}>
            Join free. We match creators with local cafes, gyms, salons, boutiques, and home services.
          </div>
        </div>
      </div>
    ),
    size,
  )
}
