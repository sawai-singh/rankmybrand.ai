'use client';

import { ReactNode } from 'react';
import { AdvancedPageTransition } from '@/components/layout/advanced-page-transition';

interface TransitionProviderProps {
  children: ReactNode;
}

export function TransitionProvider({ children }: TransitionProviderProps) {
  return (
    <AdvancedPageTransition 
      mode="morph" 
      duration={0.6}
      enableSound={false}
      enableViewTransitions={true}
    >
      {children}
    </AdvancedPageTransition>
  );
}