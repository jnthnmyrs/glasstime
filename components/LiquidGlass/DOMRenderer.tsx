import { useEffect, useRef, useCallback } from 'react';
import { WebGLContext } from './types';

interface DOMRendererProps {
  gl: WebGLRenderingContext | null;
  onTextureUpdate: () => void;
}

export default function DOMRenderer({ gl, onTextureUpdate }: DOMRendererProps) {
  const observerRef = useRef<MutationObserver | null>(null);

  // Check if an element is in or near the viewport
  const isNearViewport = useCallback((element: Element) => {
    const rect = element.getBoundingClientRect();
    const margin = 100; // Extra margin around viewport
    
    return !(
      rect.bottom < -margin ||
      rect.top > window.innerHeight + margin ||
      rect.right < -margin ||
      rect.left > window.innerWidth + margin
    );
  }, []);

  // Set up DOM observation
  useEffect(() => {
    if (!gl) return;

    // Debounce updates to prevent too frequent renders
    let updateTimeout: NodeJS.Timeout;
    const scheduleUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(onTextureUpdate, 16); // ~60fps max
    };

    // Create mutation observer
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      for (const mutation of mutations) {
        // Check if the mutation is relevant
        const isRelevant = (
          mutation.type === 'attributes' && 
          ['style', 'class'].includes(mutation.attributeName || '') ||
          mutation.type === 'characterData' ||
          mutation.type === 'childList'
        );

        if (isRelevant && isNearViewport(mutation.target as Element)) {
          shouldUpdate = true;
          break;
        }
      }

      if (shouldUpdate) {
        scheduleUpdate();
      }
    });

    // Observe the entire document
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['style', 'class']
    });

    observerRef.current = observer;

    // Clean up
    return () => {
      clearTimeout(updateTimeout);
      observer.disconnect();
    };
  }, [gl, onTextureUpdate, isNearViewport]);

  // Handle scroll events
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(onTextureUpdate, 16);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [onTextureUpdate]);

  return null; // This is a logical component, no rendering needed
} 