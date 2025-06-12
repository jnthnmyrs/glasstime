'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import React from 'react';

interface LiquidGlassLensProps {
  x?: number;
  y?: number;
  isVisible?: boolean;
  size?: number;
  intensity?: number;
  className?: string;
  allowScrollOnMobile?: boolean;
}

export default React.memo(function LiquidGlassLens({ 
  x: propX,
  y: propY,
  isVisible = true,
  size = 200, 
  // intensity = 1,
  className = '',
  allowScrollOnMobile = false
}: LiquidGlassLensProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const lastCaptureTimeRef = useRef<number>(0);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [pageTexture, setPageTexture] = useState<{ width: number; height: number } | null>(null);
  const [isWebGLReady, setIsWebGLReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  
  // Track position
  const [pointerPos, setPointerPos] = useState({ 
    x: propX || 0, 
    y: propY || 0 
  });

  // Add a state to track if lens is active
  const [isLensActive, setIsLensActive] = useState(true);

  // Check if device is mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkMobile = () => {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobileViewport = window.innerWidth <= 768;
        setIsMobile(isTouchDevice && isMobileViewport);
        
        // Adjust size for mobile
        if (isTouchDevice && isMobileViewport) {
          // Use smaller lens size on mobile for better performance
          const mobileSize = Math.min(window.innerWidth * 0.5, 150);
          return mobileSize;
        }
        return size;
      };
      
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, [size]);

  // Initialize center position on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !propX && !propY) {
      setPointerPos({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
    }
  }, [propX, propY]);

  // First define captureTexture
  const captureTexture = useCallback(async () => {
    if (!glRef.current || !programRef.current || !canvasRef.current) return;
    
    // Throttle texture captures (especially on mobile)
    const now = Date.now();
    const minCaptureInterval = isMobile ? 2000 : 1000; // Longer interval to reduce flashing
    
    if (now - lastCaptureTimeRef.current < minCaptureInterval) {
      return;
    }
    
    lastCaptureTimeRef.current = now;
    
    try {
      // Store current canvas position to restore it exactly
      const canvasEl = canvasRef.current;
      const originalVisibility = canvasEl.style.visibility;
      
      // Instead of hiding, move offscreen to avoid flash
      canvasEl.style.visibility = 'hidden';
      
      // Mobile-optimized settings
      const captureScale = isMobile ? 0.5 : 1;
      const scrollOffset = isMobile ? 0 : 35;
      
      const pageCanvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        scale: captureScale,
        width: window.innerWidth,
        height: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY + scrollOffset,
        ignoreElements: (element) => element === canvasRef.current,
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

      // Restore canvas visibility
      canvasEl.style.visibility = originalVisibility;

      const gl = glRef.current;
      
      // Don't update state if component is unmounting
      if (!gl) return;
      
      setPageTexture({
        width: pageCanvas.width,
        height: pageCanvas.height
      });

      // Reuse texture if possible
      let texture = textureRef.current;
      if (!texture) {
        texture = gl.createTexture();
        textureRef.current = texture;
      }
      
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pageCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    } catch (error) {
      console.error('❌ Failed to capture:', error);
      // Make sure canvas is visible even if capture fails
      if (canvasRef.current) {
        canvasRef.current.style.visibility = 'visible';
      }
    }
  }, [isMobile]);

  // Then define resetInteractionTimeout which uses captureTexture
  const resetInteractionTimeout = useCallback(() => {
    setIsInteracting(true);
    
    // Clear existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    
    // Set a new timeout
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
      captureTexture();
    }, 500);
  }, [captureTexture]);

  // Then use both in the event handlers useEffect
  useEffect(() => {
    // Create handlers for both mouse and touch events
    const handleMouseMove = (e: MouseEvent) => {
      setPointerPos({ x: e.clientX, y: e.clientY });
      resetInteractionTimeout();
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only prevent default when lens is active
      if (isLensActive) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        setPointerPos({ x: touch.clientX, y: touch.clientY });
        resetInteractionTimeout();
      }
    };
    
    const handleTouchStart = (e: TouchEvent) => {
      // Only prevent default when lens is active
      if (isLensActive) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        setPointerPos({ x: touch.clientX, y: touch.clientY });
        setIsInteracting(true);
        resetInteractionTimeout();
      }
    };

    // Add event listeners directly to document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchstart', handleTouchStart);
      
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [isLensActive, resetInteractionTimeout]);

  // Use pointer position or props
  const x = propX !== undefined ? propX : pointerPos.x;
  const y = propY !== undefined ? propY : pointerPos.y;

  const initWebGL = useCallback(() => {
    // Add a flag to prevent multiple initializations
    if (glRef.current) {
      console.log('🔄 WebGL already initialized, skipping');
      return true;
    }
    
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

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) return false;

    // Use simpler shader for mobile to improve performance
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

    console.log('✅ WebGL initialized successfully');
    return true;
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
    // Adjust offset for mobile vs desktop
    const yOffset = isMobile ? 0 : -10;
    gl.uniform2f(gl.getUniformLocation(program, 'u_lensPosition'), x, y + yOffset);
    gl.uniform2f(gl.getUniformLocation(program, 'u_lensSize'), size, size);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [size, x, y, pageTexture, isMobile]);

  // Initialize WebGL when component mounts
  useEffect(() => {
    if (isVisible && canvasRef.current) {
      const success = initWebGL();
      setIsWebGLReady(success);
      if (success) {
        captureTexture();
      }
    }
  }, [isVisible, initWebGL, captureTexture]);

  // Recapture texture periodically when not interacting
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout | null = null;
    
    // Only do periodic updates when not actively interacting
    if (isWebGLReady && !isInteracting) {
      refreshInterval = setInterval(() => {
        // Only capture if enough time has passed since last capture
        const now = Date.now();
        if (now - lastCaptureTimeRef.current > (isMobile ? 3000 : 2000)) {
          captureTexture();
        }
      }, isMobile ? 5000 : 3000); // Less frequent updates to reduce flashing
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isWebGLReady, isInteracting, captureTexture, isMobile]);

  // Render when position changes
  useEffect(() => {
    if (isWebGLReady && textureRef.current) {
      render();
      
      // For mobile: capture texture occasionally during interaction
      if (isMobile && isInteracting) {
        const now = Date.now();
        if (now - lastCaptureTimeRef.current > 1000) { // 1 second
          captureTexture();
        }
      }
    }
  }, [render, isWebGLReady, x, y, isMobile, isInteracting, captureTexture]);

  // Handle canvas positioning
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = size;
    canvas.height = size;
    canvas.style.left = `${x - size/2}px`;
    canvas.style.top = `${y - size/2}px`;
    
    // Add smooth transition on mobile
    if (isMobile) {
      canvas.style.transition = 'left 0.1s, top 0.1s';
    } else {
      canvas.style.transition = '';
    }
  }, [x, y, size, isMobile]);

  // Add this near the other useEffects to implement a toggle button
  useEffect(() => {
    if (isMobile) {
      // Create a toggle button
      const toggleButton = document.createElement('button');
      toggleButton.innerText = isLensActive ? '🔍 Disable Lens' : '🔍 Enable Lens';
      toggleButton.style.position = 'fixed';
      toggleButton.style.bottom = '20px';
      toggleButton.style.right = '20px';
      toggleButton.style.padding = '10px';
      toggleButton.style.zIndex = '100';
      toggleButton.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      toggleButton.style.borderRadius = '20px';
      toggleButton.style.border = '1px solid rgba(0, 0, 0, 0.2)';
      toggleButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
      
      toggleButton.addEventListener('click', () => {
        setIsLensActive(!isLensActive);
      });
      
      document.body.appendChild(toggleButton);
      
      return () => {
        document.body.removeChild(toggleButton);
      };
    }
  }, [isMobile, isLensActive]);

  // Modify the visibility condition to also check if lens is active
  if (!isVisible || (isMobile && !isLensActive)) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`fixed pointer-events-auto z-50 ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        willChange: 'transform', // Optimize for animations
        touchAction: 'none', // Prevent browser handling of touches
      }}
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.size === nextProps.size
  );
});