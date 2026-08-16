import React, { useEffect, useRef, useState } from 'react';

// Render the noise texture ONCE at a low internal resolution, then let the
// browser upscale it via CSS. Previously this ran a per-pixel trig shader in
// JS every animation frame, which pinned the GPU/renderer at ~50% CPU on
// Retina displays and heated the machine within seconds of opening the app.
const NOISE_W = 320;
const NOISE_H = 200;

export default function SplashScreen({ onFinished }: { onFinished: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 250);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 2400);
    const t4 = setTimeout(() => onFinished(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onFinished]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = NOISE_W;
    canvas.height = NOISE_H;

    const noise = (x: number, y: number) => {
      const G = 2.71828;
      return (G * Math.sin(G * x) * G * Math.sin(G * y) * (1 + x)) % 1;
    };

    const image = ctx.createImageData(NOISE_W, NOISE_H);
    const d = image.data;
    for (let y = 0; y < NOISE_H; y++) {
      for (let x = 0; x < NOISE_W; x++) {
        const u = (x / NOISE_W) * 2;
        const v = (y / NOISE_H) * 2;
        const ty = v + 0.03 * Math.sin(8.0 * u);
        const pattern = 0.6 + 0.4 * Math.sin(
          5.0 * (u + ty + Math.cos(3.0 * u + 5.0 * ty)) + Math.sin(20.0 * (u + ty))
        );
        const rnd = noise(x, y);
        const intensity = Math.max(0, pattern - rnd / 15.0 * 0.8);
        const idx = (y * NOISE_W + x) * 4;
        d[idx]     = Math.floor(22 * intensity);
        d[idx + 1] = Math.floor(56 * intensity);
        d[idx + 2] = Math.floor(102 * intensity);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    const grad = ctx.createRadialGradient(
      NOISE_W / 2, NOISE_H / 2, 0,
      NOISE_W / 2, NOISE_H / 2, Math.max(NOISE_W, NOISE_H) / 2
    );
    grad.addColorStop(0, 'rgba(0,0,0,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, NOISE_W, NOISE_H);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: '#000',
      transition: 'opacity 800ms ease-out',
      opacity: phase >= 3 ? 0 : 1,
      pointerEvents: phase >= 3 ? 'none' : 'auto',
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        imageRendering: 'auto', filter: 'blur(1px)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent, rgba(0,0,0,0.5))',
      }} />
      <div style={{
        position: 'relative', zIndex: 20, width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <img src="assets/icon.png" alt="" style={{
            width: 72, height: 72, marginBottom: 24,
            filter: 'drop-shadow(0 0 40px rgba(56,140,255,0.4))',
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
            transition: 'all 800ms cubic-bezier(0.16,1,0.3,1)',
          }} />
          <div style={{
            fontSize: 56, fontWeight: 200, letterSpacing: 16, color: '#fff',
            textShadow: '0 0 60px rgba(56,140,255,0.2)',
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 900ms cubic-bezier(0.16,1,0.3,1)',
          }}>
            SYELLA
          </div>
          <div style={{
            marginTop: 20, fontSize: 13, letterSpacing: 6, textTransform: 'uppercase',
            color: 'rgba(180,200,220,0.5)', fontWeight: 300,
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'translateY(0)' : 'translateY(16px)',
            transition: 'all 700ms cubic-bezier(0.16,1,0.3,1) 200ms',
          }}>
            portable ssh workstation
          </div>
        </div>
      </div>
      <div style={{
        position: 'absolute', bottom: 40, left: 0, right: 0, zIndex: 20,
        textAlign: 'center', fontSize: 11, color: 'rgba(90,112,144,0.4)',
        letterSpacing: 3, fontWeight: 300,
        opacity: phase >= 2 ? 1 : 0,
        transition: 'opacity 600ms ease-out 400ms',
      }}>
        v1.1.1
      </div>
    </div>
  );
}
