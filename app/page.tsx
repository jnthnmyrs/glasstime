'use client';

import LiquidGlassLens from '../components/LiquidGlassLens';
import HeresToTheCrazyOnes from '../components/HeresToTheCrazyOnes';
import { useEffect, useState } from 'react';



export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {

    // add event listeners for mouse down and up
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        setIsPressed(true);
        setIsVisible(true);
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        setIsPressed(false);
        setIsVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };

  }, []);


  return (
    <div className="min-h-screen bg-white">
      <div className="relative w-full min-h-screen p-8 lg:p-16">
        <HeresToTheCrazyOnes />
        <LiquidGlassLens size={200} isVisible={isVisible}  />
      </div>
    </div>
  );
}
