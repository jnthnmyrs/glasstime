export interface LensPosition {
  x: number;
  y: number;
}

export interface LensProps {
  position?: LensPosition;
  size?: number;
  isVisible?: boolean;
  className?: string;
}

export interface WebGLContext {
  gl: WebGLRenderingContext | null;
  program: WebGLProgram | null;
  initialize: () => boolean;
  render: (position: LensPosition, texture: WebGLTexture) => void;
} 