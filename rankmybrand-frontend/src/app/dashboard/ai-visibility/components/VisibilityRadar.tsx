'use client';

/**
 * VisibilityRadar - Professional B2B Radar Chart
 * Design System: Monochrome + Semantic Colors
 * - Neutral D3 radar visualization (grayscale only)
 * - Semantic colors for trend indicators (green/red)
 * - Professional typography and trust signals
 * - Bloomberg Terminal aesthetic
 */

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RadarDataPoint {
  axis: string;
  value: number;
  benchmark: number;
  description: string;
  trend: 'up' | 'down' | 'stable';
  improvement: string;
}

interface VisibilityRadarProps {
  data: any;
}

export default function VisibilityRadar({ data }: VisibilityRadarProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const radarData: RadarDataPoint[] = useMemo(() => [
    {
      axis: 'Brand Mentions',
      value: data?.brandMentionRate || 0,
      benchmark: 65,
      description: 'How often your brand appears in AI responses',
      trend: 'up',
      improvement: 'Increase content marketing and PR efforts'
    },
    {
      axis: 'Sentiment Quality',
      value: data?.scores?.sentiment || 0,
      benchmark: 70,
      description: 'Positive sentiment in brand mentions',
      trend: 'stable',
      improvement: 'Address negative feedback points'
    },
    {
      axis: 'Recommendation Rate',
      value: data?.scores?.recommendation || 0,
      benchmark: 60,
      description: 'How often AI recommends your brand',
      trend: 'up',
      improvement: 'Improve product differentiation'
    },
    {
      axis: 'Feature Coverage',
      value: data?.scores?.features || 0,
      benchmark: 75,
      description: 'Key features mentioned by AI',
      trend: 'down',
      improvement: 'Update product documentation'
    },
    {
      axis: 'Competitive Position',
      value: data?.competitivePosition ? (100 - (data.competitivePosition * 20)) : 0,
      benchmark: 55,
      description: 'Position relative to competitors',
      trend: 'up',
      improvement: 'Highlight unique value propositions'
    },
    {
      axis: 'SEO Alignment',
      value: data?.scores?.seo || 0,
      benchmark: 80,
      description: 'Optimization for AI search features',
      trend: 'stable',
      improvement: 'Optimize for featured snippets'
    }
  ], [data]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 400;
    const margin = { top: 50, right: 80, bottom: 50, left: 80 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Scales
    const angleSlice = Math.PI * 2 / radarData.length;
    const rScale = d3.scaleLinear()
      .range([0, radius])
      .domain([0, 100]);

    // Grid circles
    const levels = 5;
    const levelValues = d3.range(1, levels + 1).map(d => (d / levels) * 100);

    // Draw grid circles with animation - Professional neutral styling
    const gridCircles = g.selectAll('.grid-circle')
      .data(levelValues)
      .enter()
      .append('circle')
      .attr('class', 'grid-circle')
      .attr('r', 0)
      .style('fill', 'none')
      .style('stroke', '#d4d4d4') // neutral-300
      .style('stroke-width', 1)
      .style('stroke-dasharray', '2,2')
      .style('opacity', 0);

    gridCircles.transition()
      .duration(500)
      .delay((d, i) => i * 100)
      .attr('r', d => rScale(d))
      .style('opacity', 0.4);

    // Grid labels - Professional monospace
    g.selectAll('.grid-label')
      .data(levelValues)
      .enter()
      .append('text')
      .attr('class', 'grid-label')
      .attr('x', 5)
      .attr('y', d => -rScale(d))
      .style('font-size', '10px')
      .style('font-family', 'JetBrains Mono, Monaco, monospace')
      .style('font-variant-numeric', 'tabular-nums')
      .style('fill', '#737373') // neutral-500
      .style('opacity', 0)
      .text(d => d)
      .transition()
      .duration(500)
      .style('opacity', 1);

    // Draw axes - Professional neutral styling
    const axis = g.selectAll('.axis')
      .data(radarData)
      .enter()
      .append('g')
      .attr('class', 'axis');

    axis.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', (d, i) => rScale(100) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('y2', (d, i) => rScale(100) * Math.sin(angleSlice * i - Math.PI / 2))
      .style('stroke', '#d4d4d4') // neutral-300
      .style('stroke-width', 1)
      .style('opacity', 0)
      .transition()
      .duration(500)
      .style('opacity', 0.4);

    // Axis labels - Professional typography
    const labels = axis.append('g')
      .attr('transform', (d, i) => {
        const x = rScale(120) * Math.cos(angleSlice * i - Math.PI / 2);
        const y = rScale(120) * Math.sin(angleSlice * i - Math.PI / 2);
        return `translate(${x},${y})`;
      });

    labels.append('text')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('text-anchor', 'middle')
      .style('letter-spacing', '0.02em')
      .style('fill', '#525252') // neutral-600
      .style('opacity', 0)
      .text(d => d.axis)
      .transition()
      .duration(500)
      .delay(500)
      .style('opacity', 1);

    // Draw benchmark area - Professional neutral styling
    const benchmarkLine = d3.lineRadial()
      .curve(d3.curveLinearClosed)
      .radius(d => rScale(d.benchmark))
      .angle((d, i) => i * angleSlice);

    g.append('path')
      .datum(radarData)
      .attr('class', 'benchmark-area')
      .attr('d', benchmarkLine as any)
      .style('fill', '#a3a3a3') // neutral-400
      .style('fill-opacity', 0)
      .style('stroke', '#737373') // neutral-500
      .style('stroke-width', 2)
      .style('stroke-dasharray', '5,5')
      .transition()
      .duration(1000)
      .style('fill-opacity', 0.06); // Very subtle background

    // Draw data area - Professional neutral styling (no gradient)
    const radarLine = d3.lineRadial()
      .curve(d3.curveLinearClosed)
      .radius(d => rScale(d.value))
      .angle((d, i) => i * angleSlice);

    const dataPath = g.append('path')
      .datum(radarData)
      .attr('class', 'radar-area')
      .attr('d', radarLine as any)
      .style('fill', '#171717') // neutral-900 - darkest for your data
      .style('fill-opacity', 0)
      .style('stroke', '#171717') // neutral-900
      .style('stroke-width', 2.5);

    // Animate data area
    dataPath.transition()
      .duration(1000)
      .delay(500)
      .style('fill-opacity', 0.12); // Subtle fill

    // Draw data points - Professional neutral styling
    const points = g.selectAll('.radar-point')
      .data(radarData)
      .enter()
      .append('g')
      .attr('class', 'radar-point')
      .attr('transform', (d, i) => {
        const x = rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2);
        const y = rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2);
        return `translate(${x},${y})`;
      });

    points.append('circle')
      .attr('r', 0)
      .style('fill', '#171717') // neutral-900
      .style('stroke', '#fff')
      .style('stroke-width', 2)
      .on('mouseenter', function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 7)
          .style('fill', '#404040'); // neutral-700 on hover
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 5)
          .style('fill', '#171717'); // neutral-900
      })
      .transition()
      .duration(1000)
      .delay((d, i) => 1000 + i * 100)
      .attr('r', 5);

    // Cleanup
    return () => {
      d3.select(svgRef.current).selectAll('*').remove();
    };
  }, [data, radarData]);

  return (
    <Card className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
      <div className="border-b border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="section-header mb-2">Multi-Dimensional Analysis</div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-0 flex items-center gap-2">
              <Activity className="w-5 h-5 text-neutral-600" />
              Visibility Radar
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">Brand performance across {radarData.length} key metrics</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-md transition-colors">
                <Activity className="w-4 h-4 text-neutral-500" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">Compares your brand visibility across key metrics against industry benchmarks (dashed line)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div ref={containerRef} className="relative">
        <svg ref={svgRef} className="w-full" />
      </div>

      <div className="p-6 space-y-4">
        {/* Professional Legend */}
        <div className="flex items-center gap-6 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-neutral-900 dark:bg-neutral-0" />
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Your Brand</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 border-t-2 border-neutral-500 border-dashed" />
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Industry Benchmark</span>
          </div>
        </div>

        {/* Professional Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {radarData.slice(0, 4).map((item, index) => (
            <motion.div
              key={item.axis}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700 rounded-md"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{item.axis}</span>
                {item.trend === 'up' ? (
                  <TrendingUp className="w-3 h-3 text-success-600" />
                ) : item.trend === 'down' ? (
                  <TrendingDown className="w-3 h-3 text-danger-600" />
                ) : (
                  <Minus className="w-3 h-3 text-neutral-400" />
                )}
              </div>
              <span className="font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-neutral-0">
                {item.value}%
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </Card>
  );
}