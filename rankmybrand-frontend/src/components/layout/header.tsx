'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-white/90 dark:bg-neutral-900/90 backdrop-blur-lg shadow-md border-b border-neutral-200 dark:border-neutral-800'
          : 'bg-transparent'
      )}
    >
      <nav
        className="container mx-auto px-4 h-16 flex items-center justify-between"
        aria-label="Main navigation"
      >
        {/* Professional logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-heading font-bold hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-0 focus:ring-offset-2 rounded-lg px-2 py-1"
        >
          <span className="text-neutral-900 dark:text-neutral-0">RankMyBrand</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-0 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-0 focus:ring-offset-2 rounded px-2 py-1"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-0 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-0 focus:ring-offset-2 rounded px-2 py-1"
          >
            Login
          </Link>
          <Link href="/onboarding/company">
            <Button size="sm" className="px-6 font-semibold">
              Start Free Trial →
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-0"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-0 transition-colors font-medium py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-0 focus:ring-offset-2 rounded px-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-0 transition-colors font-medium py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-0 focus:ring-offset-2 rounded px-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Login
            </Link>
            <Link href="/onboarding/company" onClick={() => setIsMobileMenuOpen(false)}>
              <Button size="lg" className="w-full font-semibold">
                Start Free Trial →
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
