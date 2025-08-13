'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    question: 'How is RankMyBrand different from AthenaHQ?',
    answer: 'RankMyBrand provides instant results in 10 seconds vs 30+ seconds, costs 73% less ($79 vs $295), offers real-time updates instead of batch processing, and includes a free tier with 5 checks per month. We also support 8+ AI platforms compared to their 5.',
  },
  {
    question: 'Which AI platforms do you track?',
    answer: 'We track ChatGPT, Claude, Perplexity, Gemini, Bing Chat, You.com, Poe, and HuggingChat. We\'re constantly adding new platforms as they emerge.',
  },
  {
    question: 'How accurate is the GEO score?',
    answer: 'Our GEO score uses real-time data from actual AI platform responses, not estimates. We validate accuracy through continuous testing and have a 98.5% correlation with manual checks.',
  },
  {
    question: 'Can I track my competitors?',
    answer: 'Yes! You can track unlimited competitors on all paid plans. See their scores, get alerts when they gain visibility, and analyze their content strategies.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes, we offer a free tier with 5 checks per month, no credit card required. Our paid plans also include a 14-day money-back guarantee.',
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
      <h2 className="text-4xl font-heading font-bold text-center mb-12">
        Frequently Asked Questions
      </h2>
      
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors"
            >
              <span className="font-medium">{faq.question}</span>
              <motion.div
                animate={{ rotate: openIndex === index ? 45 : 0 }}
                transition={{ duration: 0.2 }}
              >
                {openIndex === index ? (
                  <Minus className="w-5 h-5 text-primary-500" />
                ) : (
                  <Plus className="w-5 h-5 text-gray-400" />
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
                  <div className="px-6 pb-4 text-gray-600 dark:text-gray-400">
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