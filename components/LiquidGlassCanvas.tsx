'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

interface LiquidGlassCanvasProps {
  className?: string;
}

export default function LiquidGlassCanvas({ className = '' }: LiquidGlassCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textTextureRef = useRef<WebGLTexture | null>(null);
  
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isReady, setIsReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [showLens, setShowLens] = useState(false);

  // The text content from HeresToTheCrazyOnes
  const textContent = {
    title: "Here's to the crazy ones.",
    paragraphs: [
      "The misfits. The rebels. The troublemakers. The round pegs in the square holes. The ones who see things differently.",
      "They're not fond of rules. And they have no respect for the status quo. You can quote them, disagree with them, glorify or vilify them. About the only thing you can't do is ignore them.",
      "Because they change things. They push the human race forward. And while some may see them as the crazy ones, we see genius.",
      "Because the people who are crazy enough to think they can change the world, are the ones who do."
    ],
    attribution: ["Think Different", "Apple Inc."]
  };

  // Detect mobile and initialize
  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobileViewport = window.innerWidth <= 768;
      setIsMobile(isTouchDevice || isMobileViewport);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize canvas size
  useEffect(() => {
    const updateSize = () => {
      if (typeof window !== 'undefined') {
        setCanvasSize({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // MOBILE & DESKTOP EVENT HANDLING
  useEffect(() => {
    // Mouse events for desktop
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      if (!isMobile) {
        setShowLens(true);
      }
    };

    // Touch events for mobile
    const handleTouchStart = (e: TouchEvent) => {
      if (isMobile && e.touches.length === 1) {
        const touch = e.touches[0];
        setMousePosition({ x: touch.clientX, y: touch.clientY });
        setShowLens(true);
        // Don't prevent default - allow scrolling
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isMobile && e.touches.length === 1 && showLens) {
        const touch = e.touches[0];
        setMousePosition({ x: touch.clientX, y: touch.clientY });
        // Don't prevent default - allow scrolling while lens is active
      }
    };

    const handleTouchEnd = () => {
      if (isMobile) {
        // Keep lens visible for a moment, then hide
        setTimeout(() => setShowLens(false), 1000);
      }
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, showLens]);

  // Create text texture from canvas 2D rendering
  const createTextTexture = useCallback(() => {
    if (!glRef.current) return null;

    // Create a separate canvas for text rendering
    const textCanvas = document.createElement('canvas');
    const ctx = textCanvas.getContext('2d');
    if (!ctx) return null;

    // Set canvas size to match main canvas
    textCanvas.width = canvasSize.width;
    textCanvas.height = canvasSize.height;

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, textCanvas.width, textCanvas.height);

    // Set up text styling - LEFT ALIGNED
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Calculate responsive font sizes
    const titleSize = isMobile ? 32 : 60; // Smaller on mobile
    const contentSize = isMobile ? 14 : 20; // Smaller on mobile

    // Position content - LEFT ALIGNED with proper padding
    const padding = isMobile ? 20 : 64;
    const leftX = padding;
    const startY = Math.max(60, (textCanvas.height - 400) / 2); // Adjusted for mobile
    const maxWidth = Math.min(672, textCanvas.width - padding * 2);

    let currentY = startY;

    // Render title
    ctx.font = `400 ${titleSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`;
    ctx.letterSpacing = '-0.025em';
    
    // Handle title text wrapping
    const titleWords = textContent.title.split(' ');
    let titleLine = '';
    
    for (let i = 0; i < titleWords.length; i++) {
      const testLine = titleLine + titleWords[i] + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(titleLine.trim(), leftX, currentY);
        titleLine = titleWords[i] + ' ';
        currentY += titleSize * 1.25;
      } else {
        titleLine = testLine;
      }
    }
    ctx.fillText(titleLine.trim(), leftX, currentY);
    currentY += titleSize * 1.25 + (isMobile ? 24 : 48);

    // Render content paragraphs
    ctx.font = `400 ${contentSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`;
    ctx.fillStyle = '#374151';
    ctx.letterSpacing = '0';

    textContent.paragraphs.forEach((paragraph, index) => {
      const words = paragraph.split(' ');
      let line = '';
      
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && i > 0) {
          ctx.fillText(line.trim(), leftX, currentY);
          line = words[i] + ' ';
          currentY += contentSize * 1.625;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), leftX, currentY);
      currentY += contentSize * 1.625 + (index < textContent.paragraphs.length - 1 ? 16 : 32);
    });

    // Render attribution
    currentY += 32;
    ctx.font = `400 ${contentSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`;
    
    textContent.attribution.forEach((line) => {
      ctx.fillText(line, leftX, currentY);
      currentY += contentSize * 1.25 + 4;
    });

    // Create WebGL texture from the canvas
    const gl = glRef.current;
    const texture = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return texture;
  }, [canvasSize, textContent, isMobile]);

  // Initialize WebGL with mobile optimizations
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    // Set canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      antialias: !isMobile, // Disable antialiasing on mobile for performance
      powerPreference: isMobile ? 'low-power' : 'high-performance'
    });
    if (!gl) return false;

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader with MOBILE OPTIMIZATIONS
    const fragmentShaderSource = `
      precision ${isMobile ? 'mediump' : 'highp'} float;
      uniform sampler2D u_textTexture;
      uniform vec2 u_resolution;
      uniform vec2 u_mousePosition;
      uniform float u_time;
      uniform bool u_isMobile;
      varying vec2 v_texCoord;
      
      void main() {
        vec2 uv = v_texCoord;
        vec2 mouse = u_mousePosition / u_resolution;
        
        // FIX ASPECT RATIO
        float aspectRatio = u_resolution.x / u_resolution.y;
        vec2 aspectUV = uv;
        vec2 aspectMouse = mouse;
        
        if (aspectRatio > 1.0) {
          aspectUV.x = (uv.x - 0.5) * aspectRatio + 0.5;
          aspectMouse.x = (mouse.x - 0.5) * aspectRatio + 0.5;
        } else {
          aspectUV.y = (uv.y - 0.5) / aspectRatio + 0.5;
          aspectMouse.y = (mouse.y - 0.5) / aspectRatio + 0.5;
        }
        
        float dist = distance(aspectUV, aspectMouse);
        float lensRadius = u_isMobile ? 0.08 : 0.12; // Smaller lens on mobile
        
        if (dist < lensRadius) {
          float normalizedDist = dist / lensRadius;
          
          // Start with the ORIGINAL position
          vec2 sampleUV = uv;
          
          // CLEAR ZONE - minimal distortion
          if (normalizedDist <= 0.6) {
            vec2 offset = (uv - mouse) * 0.03 * normalizedDist; // Reduced for mobile
            sampleUV = uv - offset;
          }
          // MELTING ZONE - simplified for mobile performance
          else {
            float edgeZone = (normalizedDist - 0.6) / 0.4;
            
            // INWARD PULL - simpler calculation for mobile
            vec2 toCenter = mouse - uv;
            float pullStrength = u_isMobile ? 
              pow(edgeZone, 1.2) * 0.04 :  // Gentler on mobile
              pow(edgeZone, 1.5) * 0.08;   // Full effect on desktop
            
            vec2 inwardPull = toCenter * pullStrength;
            
            // Simplified effects for mobile
            if (!u_isMobile) {
              // CURVED FLOW - only on desktop
              float angle = atan(toCenter.y, toCenter.x);
              float curvature = sin(normalizedDist * 3.14159) * edgeZone * 0.3;
              float curvedAngle = angle + curvature;
              vec2 curvedFlow = vec2(cos(curvedAngle), sin(curvedAngle)) * length(inwardPull);
              
              // SWIRLING MOTION - only on desktop
              float swirl = sin(angle * 4.0 + normalizedDist * 6.28 + u_time * 0.8) * edgeZone * 0.02;
              vec2 swirlOffset = vec2(-toCenter.y, toCenter.x) * swirl / length(toCenter);
              
              inwardPull = curvedFlow + swirlOffset;
            }
            
            sampleUV = uv + inwardPull;
          }
          
          // CHROMATIC ABERRATION - reduced on mobile
          if (normalizedDist > 0.75) { // Start later on mobile
            float chromaticStrength = (normalizedDist - 0.75) / 0.25;
            chromaticStrength = pow(chromaticStrength, 1.2);
            
            vec2 flowDirection = normalize(mouse - uv);
            float chromatic = u_isMobile ? 0.004 : 0.008; // Reduced on mobile
            
            vec2 redOffset = flowDirection * chromaticStrength * chromatic;
            vec2 greenOffset = flowDirection * chromaticStrength * chromatic * 0.5;  
            vec2 blueOffset = flowDirection * chromaticStrength * chromatic * 1.5;
            
            float red = texture2D(u_textTexture, sampleUV + redOffset).r;
            float green = texture2D(u_textTexture, sampleUV + greenOffset).g;
            float blue = texture2D(u_textTexture, sampleUV + blueOffset).b;
            
            vec4 color = vec4(red, green, blue, 1.0);
            
            // PRISMATIC EFFECT - only on desktop or very edge on mobile
            if (normalizedDist > (u_isMobile ? 0.9 : 0.85)) {
              float prismStart = u_isMobile ? 0.9 : 0.85;
              float prismRange = u_isMobile ? 0.1 : 0.15;
              float prismIntensity = (normalizedDist - prismStart) / prismRange;
              prismIntensity = pow(prismIntensity, 2.0);
              float prismAngle = atan(flowDirection.y, flowDirection.x);
              
              vec3 spectrum = vec3(
                sin(prismAngle * 3.0 + u_time * 0.5 + 0.0) * 0.5 + 0.5,
                sin(prismAngle * 3.0 + u_time * 0.7 + 2.09) * 0.5 + 0.5,
                sin(prismAngle * 3.0 + u_time * 0.6 + 4.18) * 0.5 + 0.5
              );
              
              float spectrumIntensity = u_isMobile ? 0.2 : 0.4;
              color.rgb = mix(color.rgb, spectrum, prismIntensity * spectrumIntensity);
            }
            
            gl_FragColor = color;
            return;
          }
          
          // Sample the locally distorted content
          vec4 color = texture2D(u_textTexture, sampleUV);
          color.rgb *= vec3(0.995, 0.998, 1.0);
          gl_FragColor = color;
          return;
        }
        
        // Outside lens - normal sampling
        vec4 color = texture2D(u_textTexture, uv);
        gl_FragColor = color;
      }
    `;

    // Create and compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    
    if (!vertexShader || !fragmentShader) return false;

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    // Check compilation
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader));
      return false;
    }
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader));
      return false;
    }

    // Create program
    const program = gl.createProgram();
    if (!program) return false;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking failed:', gl.getProgramInfoLog(program));
      return false;
    }

    // Set up geometry (fullscreen quad)
    const vertices = new Float32Array([
      -1, -1,  0, 1,  // bottom-left
       1, -1,  1, 1,  // bottom-right
      -1,  1,  0, 0,  // top-left
       1,  1,  1, 0   // top-right
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

    glRef.current = gl;
    programRef.current = program;

    return true;
  }, [canvasSize, isMobile]);

  // Render loop with mobile optimizations
  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const texture = textTextureRef.current;
    
    if (!gl || !program || !texture) return;

    gl.viewport(0, 0, canvasSize.width, canvasSize.height);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Set uniforms
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvasSize.width, canvasSize.height);
    gl.uniform2f(gl.getUniformLocation(program, 'u_mousePosition'), mousePosition.x, mousePosition.y);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), Date.now() / 1000);
    gl.uniform1i(gl.getUniformLocation(program, 'u_isMobile'), isMobile ? 1 : 0);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, 'u_textTexture'), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [canvasSize, mousePosition, isMobile]);

  // Initialize everything
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      const success = initWebGL();
      if (success) {
        const texture = createTextTexture();
        if (texture) {
          textTextureRef.current = texture;
          setIsReady(true);
        }
      }
    }
  }, [canvasSize, initWebGL, createTextTexture]);

  // Animation loop - reduced framerate on mobile
  useEffect(() => {
    if (!isReady) return;

    let animationId: number;
    let lastRender = 0;
    const targetFPS = isMobile ? 30 : 60; // Reduced FPS on mobile
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      if (currentTime - lastRender >= frameInterval) {
        render();
        lastRender = currentTime;
      }
      animationId = requestAnimationFrame(animate);
    };

    animate(0);
    return () => cancelAnimationFrame(animationId);
  }, [isReady, render, isMobile]);

  // Only show lens when appropriate
  const shouldShowLens = isMobile ? showLens : true;

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 ${className}`}
      style={{
        width: '100vw',
        height: '100vh',
        cursor: isMobile ? 'default' : 'none',
        pointerEvents: 'none', // CRITICAL: Allows scrolling through the canvas
        opacity: shouldShowLens ? 1 : 1, // Always visible, lens controlled by shader
        touchAction: 'auto' // Allow all touch gestures
      }}
    />
  );
} 