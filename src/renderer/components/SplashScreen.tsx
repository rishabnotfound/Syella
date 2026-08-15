import React, { useEffect, useRef, useState } from 'react';

export default function SplashScreen({ onFinished }: { onFinished: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 4200);
    const t4 = setTimeout(() => onFinished(), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onFinished]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const noise = (x: number, y: number) => {
      const G = 2.71828;
      return (G * Math.sin(G * x) * G * Math.sin(G * y) * (1 + x)) % 1;
    };

    const animate = () => {
      const { width, height } = canvas;
      const imageData = ctx.createImageData(width, height);
      const d = imageData.data;

      for (let x = 0; x < width; x += 2) {
        for (let y = 0; y < height; y += 2) {
          const u = (x / width) * 2;
          const v = (y / height) * 2;
          const tOff = 0.02 * time;
          const ty = v + 0.03 * Math.sin(8.0 * u - tOff);
          const pattern = 0.6 + 0.4 * Math.sin(
            5.0 * (u + ty + Math.cos(3.0 * u + 5.0 * ty) + 0.02 * tOff) +
            Math.sin(20.0 * (u + ty - 0.1 * tOff))
          );
          const rnd = noise(x, y);
          const intensity = Math.max(0, pattern - rnd / 15.0 * 0.8);
          const r = Math.floor(22 * intensity);
          const g = Math.floor(56 * intensity);
          const b = Math.floor(102 * intensity);
          const idx = (y * width + x) * 4;
          if (idx < d.length) {
            d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255;
            if (x + 1 < width) { d[idx + 4] = r; d[idx + 5] = g; d[idx + 6] = b; d[idx + 7] = 255; }
          }
          const idx2 = ((y + 1) * width + x) * 4;
          if (idx2 < d.length) {
            d[idx2] = r; d[idx2 + 1] = g; d[idx2 + 2] = b; d[idx2 + 3] = 255;
            if (x + 1 < width) { d[idx2 + 4] = r; d[idx2 + 5] = g; d[idx2 + 6] = b; d[idx2 + 7] = 255; }
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);

      const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
      grad.addColorStop(0, 'rgba(0,0,0,0.05)');
      grad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      time += 1;
      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: '#000',
      transition: 'opacity 800ms ease-out',
      opacity: phase >= 3 ? 0 : 1,
      pointerEvents: phase >= 3 ? 'none' : 'auto',
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
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
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
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
        v1.0.0
      </div>
    </div>
  );
}
