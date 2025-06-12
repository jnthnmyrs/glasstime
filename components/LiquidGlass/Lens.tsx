import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LensProps, LensPosition } from './types';
import { useWebGL } from './hooks/useWebGL';
import { useDOMCapture } from './hooks/useDOMCapture';
import DOMRenderer from './DOMRenderer';

export default function Lens({
  position,
  size = 200,
  isVisible = true,
  className = ''
}: LensProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gl, program, initialize, render } = useWebGL(canvasRef);
  
  // Initialize position state with null
  const [currentPosition, setCurrentPosition] = useState<LensPosition | null>(null);

  // Set initial position after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPosition({
        x: position?.x ?? window.innerWidth / 2,
        y: position?.y ?? window.innerHeight / 2
      });
    }
  }, [position]);

  const { texture, updateTextureRegion, isReady } = useDOMCapture({
    gl,
    viewportSize: {
      width: typeof window !== 'undefined' ? window.innerWidth : 1920, // fallback value
      height: typeof window !== 'undefined' ? window.innerHeight : 1080 // fallback value
    }
  });

  // Handle texture updates
  const handleTextureUpdate = useCallback(() => {
    if (!isReady || !gl || !currentPosition) return;

    // Calculate the visible region around the lens
    const region = new DOMRect(
      currentPosition.x - size,
      currentPosition.y - size,
      size * 2,
      size * 2
    );

    // Update the texture for the visible region
    updateTextureRegion(document.body, region);

    // Render the lens with the updated texture
    if (texture) {
      render(currentPosition, texture);
    }
  }, [isReady, gl, currentPosition, size, texture, updateTextureRegion, render]);

  // Initialize WebGL
  useEffect(() => {
    if (isVisible && canvasRef.current) {
      initialize();
    }
  }, [isVisible, initialize]);

  // Handle position updates
  useEffect(() => {
    if (position) {
      setCurrentPosition(position);
      handleTextureUpdate();
    }
  }, [position, handleTextureUpdate]);

  // Only render when we have a position
  if (!isVisible || !gl || !currentPosition) return null;

  return (
    <>
      <DOMRenderer gl={gl} onTextureUpdate={handleTextureUpdate} />
      <canvas
        ref={canvasRef}
        className={`fixed pointer-events-none z-50 ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          willChange: 'transform',
          left: `${currentPosition.x - size/2}px`,
          top: `${currentPosition.y - size/2}px`
        }}
      />
    </>
  );
} 