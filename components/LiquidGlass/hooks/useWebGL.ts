import { useRef, useCallback } from 'react';
import { WebGLContext, LensPosition } from '../types';

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
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
    
    // Enhanced liquid glass effect
    vec2 lensOffset = (v_texCoord - lensCenter) * u_lensSize;
    lensOffset.y = -lensOffset.y;
    vec2 pageCoord = u_lensPosition + lensOffset;
    
    float normalizedDist = distFromCenter / lensRadius;
    vec2 distortion = vec2(0.0);
    
    if (normalizedDist > 0.6) {
      float edgeZone = (normalizedDist - 0.6) / 0.4;
      vec2 direction = normalize(v_texCoord - lensCenter);
      distortion = direction * pow(edgeZone, 3.0) * 30.0;
    }
    
    vec2 finalCoord = (pageCoord + distortion) / u_resolution;
    vec4 color = texture2D(u_texture, finalCoord);
    
    // Add liquid glass effects
    float edgeIntensity = smoothstep(0.4, 1.0, normalizedDist);
    vec3 glassColor = mix(vec3(1.0), vec3(0.95, 0.98, 1.0), edgeIntensity * 0.3);
    color.rgb *= glassColor;
    
    // Smooth edge falloff
    color.a *= (1.0 - smoothstep(0.8, 1.0, normalizedDist));
    
    gl_FragColor = color;
  }
`;

export function useWebGL(canvasRef: React.RefObject<HTMLCanvasElement | null>): WebGLContext {
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);

  const createShader = useCallback((gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }, []);

  const initialize = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      antialias: true,
    });
    if (!gl) return false;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return false;

    const program = gl.createProgram();
    if (!program) return false;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      return false;
    }

    // Set up attributes and buffers
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

    glRef.current = gl;
    programRef.current = program;

    return true;
  }, [canvasRef, createShader]);

  const render = useCallback((position: LensPosition, texture: WebGLTexture) => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;

    gl.useProgram(program);

    // Update uniforms
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), window.innerWidth, window.innerHeight);
    gl.uniform2f(gl.getUniformLocation(program, 'u_lensPosition'), position.x, position.y);
    gl.uniform2f(gl.getUniformLocation(program, 'u_lensSize'), 200, 200); // We'll make this configurable later

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, []);

  return {
    gl: glRef.current,
    program: programRef.current,
    initialize,
    render
  };
} 