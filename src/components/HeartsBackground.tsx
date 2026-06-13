'use client';
import { useEffect, useRef } from 'react';

export default function HeartsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let hearts: Array<{
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      angle: number;
      wobble: number;
    }> = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const createHeart = () => {
      if (hearts.length > 30) return;
      hearts.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 20,
        size: Math.random() * 12 + 6,
        speed: Math.random() * 1.0 + 0.4,
        opacity: Math.random() * 0.35 + 0.1,
        angle: Math.random() * Math.PI * 2,
        wobble: Math.random() * 0.02 - 0.01,
      });
    };

    const drawHeart = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opacity: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.translate(x, y);
      ctx.fillStyle = `rgba(255, 51, 102, ${opacity})`;
      
      // Draw heart path
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-size / 2, -size / 2, -size, size / 3, 0, size);
      ctx.bezierCurveTo(size, size / 3, size / 2, -size / 2, 0, 0);
      
      ctx.fill();
      ctx.restore();
    };

    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (Math.random() < 0.03) {
        createHeart();
      }

      for (let i = hearts.length - 1; i >= 0; i--) {
        const heart = hearts[i];
        heart.y -= heart.speed;
        heart.angle += heart.wobble;
        heart.x += Math.sin(heart.angle) * 0.3;

        drawHeart(ctx, heart.x, heart.y, heart.size, heart.opacity);

        if (heart.y < -50) {
          hearts.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
}
