'use client';

import LiquidGlassLens from '../components/LiquidGlassLens';
import HeresToTheCrazyOnes from '../components/HeresToTheCrazyOnes';

export default function Home() {


  return (
    <div className="min-h-screen bg-white">
      <div className="relative w-full min-h-screen p-8 lg:p-16">
        <HeresToTheCrazyOnes />
        <LiquidGlassLens size={200} />
      </div>
    </div>
  );
}
