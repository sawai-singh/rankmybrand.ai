/**
 * Onboarding Layout - Authentic AI Experience
 * [40:Semantic HTML] Proper landmarks and structure
 * [79:Theming] Dark/light mode support
 * [45:Skip link] Accessibility navigation
 */

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* [45:Skip link] Accessibility navigation */}
      <a 
        href="#onboarding-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-md z-50 focus:ring-2 focus:ring-offset-2"
      >
        Skip to onboarding content
      </a>
      
      {/* [40:Semantic HTML] Main landmark with proper structure */}
      <main className="min-h-screen relative">
        {/* [11:Aesthetic-Usability] Futuristic gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-primary-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-primary-950/20" />
        
        {/* [11:Aesthetic-Usability] Subtle grid pattern overlay */}
        <div className="fixed inset-0 grid-pattern opacity-[0.02] dark:opacity-[0.01]" />
        
        {/* [15:Whitespace] Content container with generous padding */}
        <div id="onboarding-content" className="relative z-10">
          {children}
        </div>
        
        {/* [11:Aesthetic-Usability] Subtle glow effects */}
        <div className="fixed top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl opacity-20 dark:opacity-10 pointer-events-none" />
        <div className="fixed bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl opacity-20 dark:opacity-10 pointer-events-none" />
      </main>
    </>
  );
}