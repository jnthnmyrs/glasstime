'use client';

import LiquidGlassCanvas from '../components/LiquidGlassCanvas';
import { track } from '@vercel/analytics';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* The New Lens™ - renders text directly to canvas with liquid glass effect */}
      <div className="relative mx-auto">
        <LiquidGlassCanvas />
      </div>
      
      {/* Attribution link positioned over the canvas */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <a
          href="https://jonathan.now"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-center gap-2 p-2 px-4 hover:bg-gray-100 rounded-full w-fit mx-auto"
          onClick={() => track("jonathan.now click")}
        >
          <Image src="/sig.png" alt="Jonathan" width={100} height={100} className="attribution-image" />
          <span className="sr-only">made by Jonathan Myers | Product Designer</span>
        </a>
      </div>
    </div>
  );
}
