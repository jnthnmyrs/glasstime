'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import html2canvas from 'html2canvas';

interface LiquidGlassLensProps {
  x?: number;
  y?: number;
  isVisible?: boolean;
  size?: number;
  intensity?: number;
  className?: string;
  showCursor?: boolean;
}

export default function LiquidGlassLens({ 
  x: propX,
  y: propY,
  isVisible = true,
  size = 200, 
  intensity = 1,
  className = '',
  showCursor = false,
}: LiquidGlassLensProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [pageTexture, setPageTexture] = useState<{ width: number; height: number } | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [currentSize, setCurrentSize] = useState(0);
  const [isWebGLReady, setIsWebGLReady] = useState(false);
  
  // FIXED: Safe initial position that works with SSR
  const [smoothedPos, setSmoothedPos] = useState({ 
    x: propX || 0, 
    y: propY || 0 
  });

  // Initialize position after component mounts (when window is available)
  useEffect(() => {
    if (typeof window !== 'undefined' && !propX && !propY) {
      setSmoothedPos({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
    }
  }, []); // Run once on mount

  // Set up gesture handlers
  useGesture(
    {
      // Mouse move with smooth interpolation
      onMove: ({ xy: [x, y], velocity, direction, intentional }) => {
        // Only update if this is an intentional movement (not just noise)
        if (intentional) {
          const targetX = propX !== undefined ? propX : x;
          const targetY = propY !== undefined ? propY : y;
          
          setSmoothedPos({ x: targetX, y: targetY });
        }
      },
      
      // Handle mouse press/release
      onPointerDown: ({ event }) => {
        if (event.button === 0) {
          console.log('🖱️ Mouse pressed - activating lens');
          setIsPressed(true);
          if (typeof document !== 'undefined') {
            document.body.style.cursor = 'none';
          }
        }
      },
      
      onPointerUp: ({ event }) => {
        if (event.button === 0) {
          console.log('🖱️ Mouse released - deactivating lens');
          setIsPressed(false);
          if (typeof document !== 'undefined') {
            document.body.style.cursor = 'auto';
          }
        }
      }
    },
    {
      // Configuration for smooth movement
      move: {
        // Add some filtering/smoothing
        filterTaps: true,
        threshold: 1, // Minimum movement to register
      },
      // FIXED: Safe document reference
      target: typeof document !== 'undefined' ? document : undefined,
      eventOptions: { passive: false }
    }
  );

  // Size animation (keep your existing logic)
  useEffect(() => {
    const targetSize = isPressed ? size : 0;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    const animate = () => {
      setCurrentSize(prevSize => {
        const diff = targetSize - prevSize;
        const step = diff * 0.001;
        
        if (Math.abs(diff) < 1) {
          return targetSize;
        }
        
        animationFrameRef.current = requestAnimationFrame(animate);
        return prevSize + step;
      });


    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPressed, size]);

  // Use the smoothed position
  const x = smoothedPos.x;
  const y = smoothedPos.y;

  // Add debugging info
  useEffect(() => {
    if (pageTexture) {
      console.log('🔍 Debug Info:');
      console.log('Mouse position:', { x, y });
      console.log('Window size:', { width: window.innerWidth, height: window.innerHeight });
      console.log('Captured texture size:', pageTexture);
      console.log('Lens size:', size);
    }
  }, [x, y, pageTexture, size]);

  const initWebGL = useCallback(() => {
    console.log('🔧 Initializing WebGL...');
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext('webgl', { 
      preserveDrawingBuffer: true,
      antialias: true,
      alpha: true
    }) as WebGLRenderingContext | null;
    
    if (!gl) return false;
    glRef.current = gl;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) return false;

    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) return false;

    // TESTING: Remove Y flip entirely to see natural orientation
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) return false;

    const fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform vec2 u_pageResolution;
      uniform vec2 u_lensPosition;
      uniform vec2 u_lensSize;
      varying vec2 v_texCoord;
      
      void main() {
        vec2 lensCenter = vec2(0.5); 
        float lensRadius = 0.5;
        
        float distFromCenter = distance(v_texCoord, lensCenter);
        
        if (distFromCenter > lensRadius) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
          return;
        }
        
        vec2 lensOffset = (v_texCoord - lensCenter) * u_lensSize ;
        lensOffset.y = -lensOffset.y;
        vec2 basePageCoord = u_lensPosition + lensOffset;
        
        float normalizedDist = distFromCenter / lensRadius;
        
        // ENHANCED: Create liquid glass melting effect with more aggressive distortion
        vec2 finalPageCoord = basePageCoord;
        
        if (normalizedDist > 0.6) {
          // Start distortion earlier for more melting effect
          float edgeZone = (normalizedDist - 0.4) / 0.9;
          vec2 direction = normalize(v_texCoord - lensCenter);
          
          // Create liquid melting distortion - content bends toward lens edges
          float distortionStrength = edgeZone * edgeZone * edgeZone; // Cubic for more dramatic effect
          vec2 radialDistortion = direction * distortionStrength * 80.0; // Increased strength
          
          // Add swirl effect for more liquid behavior
          float angle = atan(direction.y, direction.x);
          float swirl = sin(angle * 3.0 + normalizedDist * 6.28) * edgeZone * 15.0;
          vec2 swirlOffset = vec2(-direction.y, direction.x) * swirl;
          
          finalPageCoord = basePageCoord + radialDistortion + swirlOffset;
          
          // Add chromatic aberration for realism
          if (normalizedDist > 0.7) {
            float chromatic = (normalizedDist - 0.7) / 0.2;
            finalPageCoord += direction * chromatic * 5.0;
          }
        }
        
        // Convert to texture coordinates (0-1)
        vec2 texCoord = finalPageCoord / u_pageResolution;
        
        // ENHANCED: Colorful chromatic aberration at edges
        vec4 color = vec4(0.0);
        
        if (normalizedDist > 0.6) {
          // Create dramatic chromatic aberration for colorful edges
          float chromaticStrength = (normalizedDist - 0.6) / 0.4;
          vec2 direction = normalize(v_texCoord - lensCenter);
          
          // Sample RGB channels separately with different offsets for rainbow effect
          float aberrationAmount = chromaticStrength * chromaticStrength * 8.0;
          
          vec2 redOffset = direction * aberrationAmount * 0.8;
          vec2 greenOffset = direction * aberrationAmount * 1.0;
          vec2 blueOffset = direction * aberrationAmount * 1.2;
          
          vec2 redCoord = texCoord + redOffset / u_pageResolution;
          vec2 greenCoord = texCoord + greenOffset / u_pageResolution;
          vec2 blueCoord = texCoord + blueOffset / u_pageResolution;
          
          // Sample each channel separately
          float red = 0.0;
          float green = 0.0;
          float blue = 0.0;
          
          if (redCoord.x >= 0.0 && redCoord.x <= 1.0 && redCoord.y >= 0.0 && redCoord.y <= 1.0) {
            red = texture2D(u_texture, redCoord).r;
          }
          if (greenCoord.x >= 0.0 && greenCoord.x <= 1.0 && greenCoord.y >= 0.0 && greenCoord.y <= 1.0) {
            green = texture2D(u_texture, greenCoord).g;
          }
          if (blueCoord.x >= 0.0 && blueCoord.x <= 1.0 && blueCoord.y >= 0.0 && blueCoord.y <= 1.0) {
            blue = texture2D(u_texture, blueCoord).b;
          }
          
          color = vec4(red, green, blue, 1.0);
          
          // Add rainbow prismatic effects at extreme edges
          if (normalizedDist > 0.85) {
            float prismIntensity = (normalizedDist - 0.85) / 0.15;
            float angle = atan(direction.y, direction.x);
            
            // Create rainbow spectrum effect
            vec3 spectrum = vec3(
              sin(angle * 2.0 + 0.0) * 0.5 + 0.5,
              sin(angle * 2.0 + 2.09) * 0.5 + 0.5,
              sin(angle * 2.0 + 4.18) * 0.5 + 0.5
            );
            
            color.rgb = mix(color.rgb, spectrum, prismIntensity * 0.3);
          }
          
        } else {
          // Normal sampling for center area
          if (texCoord.x >= 0.0 && texCoord.x <= 1.0 && texCoord.y >= 0.0 && texCoord.y <= 1.0) {
            color = texture2D(u_texture, texCoord);
          } else {
            discard;
          }
        }
        
        // Enhanced glass effects for liquid appearance
        if (normalizedDist > 0.4) {
          float edgeIntensity = (normalizedDist - 0.4) / 0.6;
          
          // Liquid glass tinting - more blue/cyan at edges
          vec3 liquidTint = mix(vec3(1.0), vec3(0.85, 0.95, 1.0), edgeIntensity * 0.4);
          color.rgb *= liquidTint;
          
          // Add liquid shimmer effect
          float shimmer = sin(normalizedDist * 12.0) * 0.1 * edgeIntensity;
          color.rgb += vec3(shimmer * 0.3, shimmer * 0.5, shimmer * 0.8);
          
          // Increase refraction-like brightness at edges
          if (normalizedDist > 0.8) {
            float refraction = (normalizedDist - 0.8) / 0.2;
            color.rgb += vec3(refraction * 0.1);
          }
        }
        
        // Softer edge falloff for liquid appearance
        float edgeSoftness = smoothstep(0.92, 1.0, normalizedDist);
        color.a *= (1.0 - edgeSoftness);
        
        gl_FragColor = color;
      }
    `;

    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('❌ Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
      return false;
    }

    const program = gl.createProgram();
    if (!program) return false;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('❌ Program linking error:', gl.getProgramInfoLog(program));
      return false;
    }

    programRef.current = program;

    const vertices = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
       1,  1,  1, 1
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    
    gl.enableVertexAttribArray(positionLocation);
    gl.enableVertexAttribArray(texCoordLocation);
    
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);

    console.log('✅ Natural orientation test!');
    return true;
  }, []);

  const captureAndRender = useCallback(async () => {
    if (!glRef.current || !programRef.current || !canvasRef.current) return;

    try {
      const pageCanvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        scale: 1, // Keep at 1x to avoid bold text artifacts
        width: window.innerWidth,
        height: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY + 35,
        ignoreElements: (element) => element === canvasRef.current,
        // IMPROVED: Better text rendering settings
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.textContent = `
            * {
              color: rgb(0, 0, 0) !important;
              background-color: rgb(255, 255, 255) !important;
              font-weight: normal !important;
              -webkit-font-smoothing: antialiased !important;
              -moz-osx-font-smoothing: grayscale !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      const gl = glRef.current;
      
      setPageTexture({
        width: pageCanvas.width,
        height: pageCanvas.height
      });

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pageCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // IMPROVED: Use NEAREST filtering to avoid text blurring
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      textureRef.current = texture;

    } catch (error) {
      console.error('❌ Failed to capture:', error);
    }
  }, []);

  const render = useCallback(() => {
    if (!glRef.current || !programRef.current || !textureRef.current || !pageTexture) return;

    const gl = glRef.current;
    const program = programRef.current;

    gl.viewport(0, 0, size, size);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    gl.useProgram(program);
    
    gl.uniform2f(gl.getUniformLocation(program, 'u_pageResolution'), pageTexture.width, pageTexture.height);
    // IMPROVED: Add Y offset to lift the text position
    gl.uniform2f(gl.getUniformLocation(program, 'u_lensPosition'), x, y - 10);
    gl.uniform2f(gl.getUniformLocation(program, 'u_lensSize'), size, size);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [size, x, y, pageTexture]);

  useEffect(() => {
    if (textureRef.current && pageTexture) {
      render();
    }
  }, [x, y, render, pageTexture]);

  useEffect(() => {
    if (!isVisible) return;
    if (initWebGL()) {
      captureAndRender();
    }
  }, [isVisible, initWebGL, captureAndRender]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.left = `${x - size/2}px`;
    canvas.style.top = `${y - size/2}px`;

  }, [x, y, size]);

  if (!isVisible) return null;

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`fixed pointer-events-none z-50 ${className}`}
      style={{
        width: `${Math.max(1, currentSize)}px`,
        height: `${Math.max(1, currentSize)}px`,
        opacity: currentSize > 0 ? 1 : 0,
        transition: 'opacity 0.1s ease',
        transform: `scale(${currentSize / size})`,

      }}
    />
  );
}