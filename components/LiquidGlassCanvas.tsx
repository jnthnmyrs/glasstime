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

  // Track mouse movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

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

    // Set up text styling to match the original component
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Calculate responsive font sizes
    const isMobile = canvasSize.width <= 768;
    const titleSize = isMobile ? 48 : 60; // 3rem -> 3.75rem on lg
    const contentSize = isMobile ? 18 : 20; // 1.125rem -> 1.25rem on lg

    // Position content in center of canvas
    const centerX = textCanvas.width / 2;
    const startY = Math.max(96, (textCanvas.height - 600) / 2); // pt-24 equivalent
    const maxWidth = Math.min(672, textCanvas.width - 64); // max-w-2xl with padding

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
        ctx.fillText(titleLine.trim(), centerX, currentY);
        titleLine = titleWords[i] + ' ';
        currentY += titleSize * 1.25; // line-height: 1.25
      } else {
        titleLine = testLine;
      }
    }
    ctx.fillText(titleLine.trim(), centerX, currentY);
    currentY += titleSize * 1.25 + 48; // mb-12 equivalent

    // Render content paragraphs
    ctx.font = `400 ${contentSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`;
    ctx.fillStyle = '#374151'; // text-gray-700
    ctx.letterSpacing = '0';

    textContent.paragraphs.forEach((paragraph, index) => {
      const words = paragraph.split(' ');
      let line = '';
      
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && i > 0) {
          ctx.fillText(line.trim(), centerX, currentY);
          line = words[i] + ' ';
          currentY += contentSize * 1.625; // line-height: 1.625
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), centerX, currentY);
      currentY += contentSize * 1.625 + (index < textContent.paragraphs.length - 1 ? 24 : 48); // mb-6 between paragraphs, mb-12 after last
    });

    // Render attribution
    currentY += 48; // pt-12 equivalent
    ctx.font = `400 ${contentSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`;
    
    textContent.attribution.forEach((line, index) => {
      ctx.fillText(line, centerX, currentY);
      currentY += contentSize * 1.25 + 4; // space-y-1
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
  }, [canvasSize, textContent]);

  // Initialize WebGL
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    // Set canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      antialias: true,
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

    // Fragment shader with liquid glass distortion
    const fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_textTexture;
      uniform vec2 u_resolution;
      uniform vec2 u_mousePosition;
      uniform float u_time;
      varying vec2 v_texCoord;
      
      void main() {
        vec2 uv = v_texCoord;
        vec2 mouse = u_mousePosition / u_resolution;
        
        // Calculate distance from mouse
        float dist = distance(uv, mouse);
        float lensRadius = 0.15; // Adjust lens size
        
        // Only apply distortion within lens radius
        if (dist < lensRadius) {
          // Normalize distance within lens
          float normalizedDist = dist / lensRadius;
          vec2 direction = normalize(uv - mouse);
          
          // Liquid glass distortion - stronger at edges
          if (normalizedDist > 0.3) {
            float edgeZone = (normalizedDist - 0.3) / 0.7;
            float distortionStrength = edgeZone * edgeZone * edgeZone;
            
            // Radial distortion - content flows toward edges
            vec2 radialDistortion = direction * distortionStrength * 0.08;
            
            // Swirl effect for liquid behavior
            float angle = atan(direction.y, direction.x);
            float swirl = sin(angle * 3.0 + normalizedDist * 6.28 + u_time * 0.5) * edgeZone * 0.02;
            vec2 swirlOffset = vec2(-direction.y, direction.x) * swirl;
            
            // Apply distortion
            uv += radialDistortion + swirlOffset;
          }
          
          // Chromatic aberration at edges
          if (normalizedDist > 0.6) {
            float chromaticStrength = (normalizedDist - 0.6) / 0.4;
            chromaticStrength = chromaticStrength * chromaticStrength;
            
            // RGB channel separation
            vec2 redOffset = direction * chromaticStrength * 0.008;
            vec2 greenOffset = direction * chromaticStrength * 0.004;
            vec2 blueOffset = direction * chromaticStrength * 0.012;
            
            float red = texture2D(u_textTexture, uv + redOffset).r;
            float green = texture2D(u_textTexture, uv + greenOffset).g;
            float blue = texture2D(u_textTexture, uv + blueOffset).b;
            
            vec4 color = vec4(red, green, blue, 1.0);
            
            // Add prismatic rainbow effect at extreme edges
            if (normalizedDist > 0.8) {
              float prismIntensity = (normalizedDist - 0.8) / 0.2;
              float prismAngle = atan(direction.y, direction.x);
              
              vec3 spectrum = vec3(
                sin(prismAngle * 2.0 + 0.0) * 0.5 + 0.5,
                sin(prismAngle * 2.0 + 2.09) * 0.5 + 0.5,
                sin(prismAngle * 2.0 + 4.18) * 0.5 + 0.5
              );
              
              color.rgb = mix(color.rgb, spectrum, prismIntensity * 0.2);
            }
            
            gl_FragColor = color;
            return;
          }
        }
        
        // Sample the original text texture
        vec4 color = texture2D(u_textTexture, uv);
        
        // Add subtle glass effects within lens area
        if (dist < lensRadius) {
          float normalizedDist = dist / lensRadius;
          
          // Very subtle glass tinting
          color.rgb *= vec3(0.99, 0.995, 1.0);
          
          // Subtle shimmer effect
          if (normalizedDist > 0.5) {
            float shimmer = sin(normalizedDist * 15.0 + u_time) * 0.02;
            color.rgb += vec3(shimmer * 0.3, shimmer * 0.5, shimmer * 0.8);
          }
        }
        
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
  }, [canvasSize]);

  // Render loop
  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const texture = textTextureRef.current;
    
    if (!gl || !program || !texture) return;

    gl.viewport(0, 0, canvasSize.width, canvasSize.height);
    gl.clearColor(1, 1, 1, 1); // White background
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Set uniforms
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvasSize.width, canvasSize.height);
    gl.uniform2f(gl.getUniformLocation(program, 'u_mousePosition'), mousePosition.x, mousePosition.y);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), Date.now() / 1000);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, 'u_textTexture'), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [canvasSize, mousePosition]);

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

  // Animation loop
  useEffect(() => {
    if (!isReady) return;

    let animationId: number;
    const animate = () => {
      render();
      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, [isReady, render]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 ${className}`}
      style={{
        width: '100vw',
        height: '100vh',
        cursor: 'none'
      }}
    />
  );
} 