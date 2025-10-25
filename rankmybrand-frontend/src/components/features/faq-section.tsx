'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: 'How is RankMyBrand different from other tools?',
    answer: (
      <>
        RankMyBrand provides instant results in under <span className="font-mono tabular-nums">10</span> seconds, offers affordable pricing starting at <span className="font-mono tabular-nums">$79</span>/month, includes real-time updates, and has a free tier with <span className="font-mono tabular-nums">5</span> checks per month. We track all major AI platforms and provide comprehensive competitor analysis.
      </>
    ),
  },
  {
    question: 'Which AI platforms do you track?',
    answer: 'We track ChatGPT, Claude, Perplexity, Gemini, Bing Chat, You.com, Poe, and HuggingChat. We\'re constantly adding new platforms as they emerge.',
  },
  {
    question: 'How accurate is the GEO score?',
    answer: (
      <>
        Our GEO score uses real-time data from actual AI platform responses, not estimates. We validate accuracy through continuous testing and have a <span className="font-mono tabular-nums">98.5%</span> correlation with manual checks.
      </>
    ),
  },
  {
    question: 'Can I track my competitors?',
    answer: 'Yes! You can track unlimited competitors on all paid plans. See their scores, get alerts when they gain visibility, and analyze their content strategies.',
  },
  {
    question: 'Is there a free trial?',
    answer: (
      <>
        Yes, we offer a free tier with <span className="font-mono tabular-nums">5</span> checks per month, no credit card required. Our paid plans also include a <span className="font-mono tabular-nums">14</span>-day money-back guarantee.
      </>
    ),
  },
  {
    question: 'Do you offer API access?',
    answer: 'Yes, all paid plans include API access with generous rate limits. Our API is RESTful, well-documented, and includes SDKs for popular languages.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div>
      <div className="text-center mb-12">
        <div className="section-header mb-3">Knowledge Base</div>
        <h2 className="text-4xl font-heading font-bold text-neutral-900 dark:text-neutral-0">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <span className="font-semibold text-neutral-900 dark:text-neutral-0">{faq.question}</span>
              <motion.div
                animate={{ rotate: openIndex === index ? 45 : 0 }}
                transition={{ duration: 0.2 }}
              >
                {openIndex === index ? (
                  <Minus className="w-5 h-5 text-neutral-900 dark:text-neutral-0" />
                ) : (
                  <Plus className="w-5 h-5 text-neutral-400" />
                )}
              </motion.div>
            </button>

            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="px-6 pb-4 text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800 pt-4">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}