'use client';

import React, { useEffect, useRef, ReactNode, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView, MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

// Parallax Container
interface ParallaxContainerProps {
  children: ReactNode;
  speed?: number;
  className?: string;
}

export function ParallaxContainer({ children, speed = 0.5, className }: ParallaxContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${speed * 100}%`]);
  const smoothY = useSpring(y, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      ref={ref}
      style={{ y: smoothY }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Reveal on Scroll
interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
}

export function RevealOnScroll({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.8,
  once = true 
}: RevealOnScrollProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ delay, duration, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Scale on Scroll
interface ScaleOnScrollProps {
  children: ReactNode;
  className?: string;
  minScale?: number;
  maxScale?: number;
}

export function ScaleOnScroll({ 
  children, 
  className, 
  minScale = 0.8, 
  maxScale = 1 
}: ScaleOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [minScale, maxScale, minScale]);
  const smoothScale = useSpring(scale, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      ref={ref}
      style={{ scale: smoothScale }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Rotate on Scroll
interface RotateOnScrollProps {
  children: ReactNode;
  className?: string;
  rotation?: number;
}

export function RotateOnScroll({ children, className, rotation = 360 }: RotateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const rotate = useTransform(scrollYProgress, [0, 1], [0, rotation]);
  const smoothRotate = useSpring(rotate, { stiffness: 50, damping: 20 });

  return (
    <motion.div
      ref={ref}
      style={{ rotate: smoothRotate }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Text Reveal Animation
interface TextRevealProps {
  text: string;
  className?: string;
  stagger?: number;
}

export function TextReveal({ text, className, stagger = 0.05 }: TextRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const words = text.split(' ');

  return (
    <motion.div ref={ref} className={cn('flex flex-wrap gap-1', className)}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: index * stagger, duration: 0.5 }}
          className="inline-block"
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
}

// Sticky Section
interface StickySectionProps {
  children: ReactNode;
  className?: string;
}

export function StickySection({ children, className }: StickySectionProps) {
  return (
    <div className={cn('sticky top-0 min-h-screen flex items-center justify-center', className)}>
      {children}
    </div>
  );
}

// Progress Indicator
export function ScrollProgress() {
  const [mounted, setMounted] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 to-pink-600 z-50"
      style={{ scaleX, transformOrigin: 'left' }}
    />
  );
}

// Magnetic Effect
interface MagneticProps {
  children: ReactNode;
  strength?: number;
}

export function Magnetic({ children, strength = 0.5 }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 150, damping: 15 });
  const y = useSpring(0, { stiffness: 150, damping: 15 });

  const handleMouseMove = (e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = (e.clientX - centerX) * strength;
    const distanceY = (e.clientY - centerY) * strength;
    x.set(distanceX);
    y.set(distanceY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <motion.div ref={ref} style={{ x, y }}>
      {children}
    </motion.div>
  );
}

// Blur on Scroll
interface BlurOnScrollProps {
  children: ReactNode;
  className?: string;
  maxBlur?: number;
}

export function BlurOnScroll({ children, className, maxBlur = 10 }: BlurOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const blur = useTransform(scrollYProgress, [0, 0.5, 1], [0, maxBlur, 0]);
  const smoothBlur = useSpring(blur, { stiffness: 100, damping: 30 });
  const filter = useTransform(smoothBlur, (value) => `blur(${value}px)`);

  return (
    <motion.div
      ref={ref}
      style={{ filter }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Floating Animation
interface FloatingProps {
  children: ReactNode;
  duration?: number;
  delay?: number;
  y?: number;
}

export function Floating({ children, duration = 3, delay = 0, y = 20 }: FloatingProps) {
  return (
    <motion.div
      animate={{
        y: [0, -y, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}

// Advanced Scroll-Triggered Animation
interface ScrollTriggeredProps {
  children: ReactNode;
  className?: string;
  animation?: 'fadeUp' | 'fadeDown' | 'fadeLeft' | 'fadeRight' | 'scale' | 'rotate';
}

export function ScrollTriggered({ children, className, animation = 'fadeUp' }: ScrollTriggeredProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const animations = {
    fadeUp: {
      initial: { opacity: 0, y: 50 },
      animate: { opacity: 1, y: 0 },
    },
    fadeDown: {
      initial: { opacity: 0, y: -50 },
      animate: { opacity: 1, y: 0 },
    },
    fadeLeft: {
      initial: { opacity: 0, x: 50 },
      animate: { opacity: 1, x: 0 },
    },
    fadeRight: {
      initial: { opacity: 0, x: -50 },
      animate: { opacity: 1, x: 0 },
    },
    scale: {
      initial: { opacity: 0, scale: 0.8 },
      animate: { opacity: 1, scale: 1 },
    },
    rotate: {
      initial: { opacity: 0, rotate: -180 },
      animate: { opacity: 1, rotate: 0 },
    },
  };

  const selectedAnimation = animations[animation];

  return (
    <motion.div
      ref={ref}
      initial={selectedAnimation.initial}
      animate={isInView ? selectedAnimation.animate : selectedAnimation.initial}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}