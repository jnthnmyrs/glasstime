'use client';

import LiquidGlassLens from '../components/LiquidGlassLens';
import HeresToTheCrazyOnes from '../components/HeresToTheCrazyOnes';
import { track } from '@vercel/analytics';
import Image from 'next/image';
export default function Home() {


  return (
    <div className="min-h-screen bg-white">
      <div className="relative w-full min-h-screen p-8 lg:p-16">
        <HeresToTheCrazyOnes />
        <LiquidGlassLens size={200} />
        <a
          href="https://jonathan.now"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-center gap-2 p-2 px-4 mt-4 hover:bg-gray-100 rounded-full w-fit mx-auto"
          onClick={() => track("jonathan.now click")}
        >

          <Image src="/sig.png" alt="Jonathan" width={100} height={100} className="attribution-image" />
          <span className="sr-only">made by Jonathan Myers | Product Designer</span>
        </a>

        <div className="attribution-group">
          {``}
        </div>
      </div>
    </div>
  );
}
