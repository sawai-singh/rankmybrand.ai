'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@radix-ui/react-slider';
import { formatCurrency } from '@/lib/utils';

export function PricingCalculator() {
  const [traffic, setTraffic] = useState(10000);
  const [conversionRate, setConversionRate] = useState(2);
  
  const aiTrafficIncrease = traffic * 0.15; // 15% increase from AI
  const additionalRevenue = (aiTrafficIncrease * (conversionRate / 100)) * 150; // $150 avg order
  const monthlyCost = 79;
  const roi = ((additionalRevenue - monthlyCost) / monthlyCost) * 100;
  const athenaCost = 295;
  const savings = athenaCost - monthlyCost;

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
      {/* Calculator */}
      <div className="glass rounded-2xl p-8">
        <h3 className="text-2xl font-heading font-bold mb-6">Calculate Your ROI</h3>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Monthly Website Traffic
            </label>
            <div className="space-y-2">
              <Slider
                value={[traffic]}
                onValueChange={([value]) => setTraffic(value)}
                min={1000}
                max={100000}
                step={1000}
                className="relative flex items-center select-none touch-none w-full h-5"
              >
                <div className="relative bg-gray-200 dark:bg-gray-700 rounded-full w-full h-2">
                  <div 
                    className="absolute bg-primary-500 rounded-full h-full"
                    style={{ width: `${(traffic / 100000) * 100}%` }}
                  />
                </div>
                <div 
                  className="block w-5 h-5 bg-white border-2 border-primary-500 rounded-full shadow-lg"
                  style={{ left: `${(traffic / 100000) * 100}%` }}
                />
              </Slider>
              <div className="text-2xl font-mono font-bold">{traffic.toLocaleString()}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Current Conversion Rate (%)
            </label>
            <div className="space-y-2">
              <Slider
                value={[conversionRate]}
                onValueChange={([value]) => setConversionRate(value)}
                min={0.5}
                max={10}
                step={0.5}
                className="relative flex items-center select-none touch-none w-full h-5"
              >
                <div className="relative bg-gray-200 dark:bg-gray-700 rounded-full w-full h-2">
                  <div 
                    className="absolute bg-primary-500 rounded-full h-full"
                    style={{ width: `${(conversionRate / 10) * 100}%` }}
                  />
                </div>
                <div 
                  className="block w-5 h-5 bg-white border-2 border-primary-500 rounded-full shadow-lg"
                  style={{ left: `${(conversionRate / 10) * 100}%` }}
                />
              </Slider>
              <div className="text-2xl font-mono font-bold">{conversionRate}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8"
        >
          <h4 className="text-lg font-heading font-bold mb-4">Your Projected Results</h4>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">AI Traffic Increase</span>
              <span className="text-2xl font-mono font-bold text-green-600">
                +{Math.round(aiTrafficIncrease).toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Additional Revenue</span>
              <span className="text-2xl font-mono font-bold text-green-600">
                {formatCurrency(additionalRevenue)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">RankMyBrand Cost</span>
              <span className="text-xl font-mono">
                {formatCurrency(monthlyCost)}
              </span>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">ROI</span>
                <span className="text-3xl font-mono font-bold gradient-text">
                  {roi.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 border-2 border-primary-500/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">vs AthenaHQ</p>
              <p className="text-2xl font-bold">Save {formatCurrency(savings)}/mo</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </motion.div>

        <button className="w-full btn-primary">
          Start Saving Today →
        </button>
      </div>
    </div>
  );
}