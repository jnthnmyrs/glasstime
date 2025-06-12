import { useRef, useCallback, useEffect, useState } from 'react';


interface DOMCaptureOptions {
  gl: WebGLRenderingContext | null;
  viewportSize: { width: number; height: number };
}

export function useDOMCapture({ gl, viewportSize }: DOMCaptureOptions) {
  const textureRef = useRef<WebGLTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize only on client side
  useEffect(() => {
    if (typeof window === 'undefined' || !gl) return;

    // Create offscreen canvas for DOM rendering
    const canvas = document.createElement('canvas');
    canvas.width = viewportSize.width;
    canvas.height = viewportSize.height;
    
    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: true
    });
    
    if (!ctx) return;

    // Create and initialize WebGL texture
    const texture = gl.createTexture();
    if (!texture) return;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Store refs
    canvasRef.current = canvas;
    contextRef.current = ctx;
    textureRef.current = texture;
    setIsReady(true);

    return () => {
      if (texture) gl.deleteTexture(texture);
    };
  }, [gl, viewportSize]);

  // Function to update texture from a specific DOM region
  const updateTextureRegion = useCallback((element: Element, region: DOMRect) => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas || !gl || !textureRef.current) return;

    // Clear the region
    ctx.clearRect(region.left, region.top, region.width, region.height);

    // Create a function to draw an element and its children
    const drawElement = (el: Element) => {
      if (el instanceof HTMLElement) {
        // Get computed styles
        const styles = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Check if element is visible and in viewport
        if (
          styles.display !== 'none' &&
          styles.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        ) {
          // Draw background
          if (styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            ctx.fillStyle = styles.backgroundColor;
            ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
          }

          // Draw borders if present
          if (styles.borderWidth !== '0px') {
            ctx.strokeStyle = styles.borderColor;
            ctx.lineWidth = parseFloat(styles.borderWidth);
            ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
          }

          // Handle text content
          if (el.textContent && styles.color !== 'rgba(0, 0, 0, 0)') {
            ctx.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
            ctx.fillStyle = styles.color;
            ctx.fillText(el.textContent, rect.left, rect.top + parseFloat(styles.fontSize));
          }

          // Handle images
          if (el instanceof HTMLImageElement && el.complete) {
            try {
              ctx.drawImage(el, rect.left, rect.top, rect.width, rect.height);
            } catch (e) {
              // Handle cross-origin images gracefully
              console.warn('Could not draw image:', e);
            }
          }
        }
      }
    };

    // Draw the element and its children
    drawElement(element);
    element.querySelectorAll('*').forEach(drawElement);

    // Update the WebGL texture with the new content
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      canvas
    );
  }, [gl]);

  return {
    texture: textureRef.current,
    updateTextureRegion,
    isReady
  };
} 