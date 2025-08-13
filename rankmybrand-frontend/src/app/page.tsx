import { InstantScoreHero } from '@/components/features/instant-score-hero';
import { ComparisonTable } from '@/components/features/comparison-table';
import { LiveTicker } from '@/components/features/live-ticker';
import { PricingCalculator } from '@/components/features/pricing-calculator';
import { TrustBadges } from '@/components/features/trust-badges';
import { FAQSection } from '@/components/features/faq-section';
import { Sparkles, Zap, Shield, TrendingUp, Users, Clock } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-5" />
        <div className="container mx-auto">
          <InstantScoreHero />
        </div>
      </section>

      {/* Social Proof Ticker */}
      <section className="border-y border-gray-200 dark:border-gray-800 py-4">
        <LiveTicker />
      </section>

      {/* Value Props */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading font-bold mb-4">
              Why RankMyBrand Beats <span className="gradient-text">AthenaHQ</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Better, faster, and 50% cheaper. Here's the proof.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <ValueProp
              icon={<Zap />}
              title="10 Second Results"
              description="Get instant AI visibility scores while AthenaHQ makes you wait 30+ seconds"
              highlight="3x Faster"
            />
            <ValueProp
              icon={<TrendingUp />}
              title="Real-time Updates"
              description="Live tracking across all AI platforms vs batch processing every 24 hours"
              highlight="Always Current"
            />
            <ValueProp
              icon={<Shield />}
              title="$79 vs $295"
              description="Professional plan at 73% less than AthenaHQ with more features"
              highlight="Save $2,592/year"
            />
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading font-bold mb-4">
              See It In Action
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Watch how we analyze your competition in real-time
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <DemoVideo />
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <ComparisonTable />
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary-50/50 to-transparent dark:from-primary-900/10">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading font-bold mb-4">
              Pricing That Makes Sense
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Calculate your ROI and see how much you'll save
            </p>
          </div>
          
          <PricingCalculator />
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-12 px-4 border-t border-gray-200 dark:border-gray-800">
        <div className="container mx-auto">
          <TrustBadges />
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading font-bold mb-4">
              Real Results From Real Brands
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              See how leading companies improved their AI visibility
            </p>
          </div>
          
          <CaseStudies />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="container mx-auto max-w-4xl">
          <FAQSection />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-heading font-bold mb-4">
            Ready to <span className="gradient-text">Dominate</span> AI Search?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Join 1,000+ brands already winning with RankMyBrand
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button className="btn-primary text-lg px-8 py-4">
              Start Free Trial →
            </button>
            <button className="btn-secondary text-lg px-8 py-4">
              Book a Demo
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            No credit card required • 5 free checks • Cancel anytime
          </p>
        </div>
      </section>
    </main>
  );
}

function ValueProp({ 
  icon, 
  title, 
  description, 
  highlight 
}: { 
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight: string;
}) {
  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative glass rounded-2xl p-8 h-full card-hover">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-xl text-primary-600 dark:text-primary-400">
            {icon}
          </div>
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
            {highlight}
          </span>
        </div>
        <h3 className="text-xl font-heading font-bold mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );
}

function DemoVideo() {
  return (
    <div className="relative rounded-2xl overflow-hidden glass p-1">
      <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
          </div>
          <p className="text-white">Interactive Demo Coming Soon</p>
        </div>
      </div>
    </div>
  );
}

function CaseStudies() {
  const studies = [
    {
      company: 'TechCorp',
      logo: '🚀',
      result: '+127% AI visibility',
      timeframe: '30 days',
      quote: 'RankMyBrand helped us appear in ChatGPT responses for 89% of our target queries.',
    },
    {
      company: 'E-Shop Pro',
      logo: '🛍️',
      result: '+3.2x citations',
      timeframe: '45 days',
      quote: 'Our products now show up consistently across all AI platforms.',
    },
    {
      company: 'FinanceHub',
      logo: '💰',
      result: '+$428K revenue',
      timeframe: '90 days',
      quote: 'The ROI was immediate. AI-driven traffic converts 2.3x better.',
    },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-8">
      {studies.map((study, index) => (
        <div key={index} className="glass rounded-2xl p-8 card-hover">
          <div className="text-4xl mb-4">{study.logo}</div>
          <h3 className="text-xl font-heading font-bold mb-2">{study.company}</h3>
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span className="text-green-600 dark:text-green-400 font-bold">
              {study.result}
            </span>
            <span className="text-gray-500">in {study.timeframe}</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 italic">"{study.quote}"</p>
        </div>
      ))}
    </div>
  );
}