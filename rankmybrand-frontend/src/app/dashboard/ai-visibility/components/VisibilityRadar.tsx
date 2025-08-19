'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, TrendingUp, TrendingDown } from 'lucide-react';
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

    // Draw grid circles with animation
    const gridCircles = g.selectAll('.grid-circle')
      .data(levelValues)
      .enter()
      .append('circle')
      .attr('class', 'grid-circle')
      .attr('r', 0)
      .style('fill', 'none')
      .style('stroke', '#e5e7eb')
      .style('stroke-width', 1)
      .style('stroke-dasharray', '2,2')
      .style('opacity', 0);

    gridCircles.transition()
      .duration(500)
      .delay((d, i) => i * 100)
      .attr('r', d => rScale(d))
      .style('opacity', 0.5);

    // Grid labels
    g.selectAll('.grid-label')
      .data(levelValues)
      .enter()
      .append('text')
      .attr('class', 'grid-label')
      .attr('x', 5)
      .attr('y', d => -rScale(d))
      .style('font-size', '10px')
      .style('fill', '#9ca3af')
      .style('opacity', 0)
      .text(d => d)
      .transition()
      .duration(500)
      .style('opacity', 1);

    // Draw axes
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
      .style('stroke', '#e5e7eb')
      .style('stroke-width', 1)
      .style('opacity', 0)
      .transition()
      .duration(500)
      .style('opacity', 0.3);

    // Axis labels with icons
    const labels = axis.append('g')
      .attr('transform', (d, i) => {
        const x = rScale(120) * Math.cos(angleSlice * i - Math.PI / 2);
        const y = rScale(120) * Math.sin(angleSlice * i - Math.PI / 2);
        return `translate(${x},${y})`;
      });

    labels.append('text')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('text-anchor', 'middle')
      .style('fill', '#374151')
      .style('opacity', 0)
      .text(d => d.axis)
      .transition()
      .duration(500)
      .delay(500)
      .style('opacity', 1);

    // Draw benchmark area
    const benchmarkLine = d3.lineRadial()
      .curve(d3.curveLinearClosed)
      .radius(d => rScale(d.benchmark))
      .angle((d, i) => i * angleSlice);

    g.append('path')
      .datum(radarData)
      .attr('class', 'benchmark-area')
      .attr('d', benchmarkLine as any)
      .style('fill', '#fbbf24')
      .style('fill-opacity', 0)
      .style('stroke', '#f59e0b')
      .style('stroke-width', 2)
      .style('stroke-dasharray', '5,5')
      .transition()
      .duration(1000)
      .style('fill-opacity', 0.1);

    // Draw data area
    const radarLine = d3.lineRadial()
      .curve(d3.curveLinearClosed)
      .radius(d => rScale(d.value))
      .angle((d, i) => i * angleSlice);

    const dataPath = g.append('path')
      .datum(radarData)
      .attr('class', 'radar-area')
      .attr('d', radarLine as any)
      .style('fill', 'url(#gradient)')
      .style('fill-opacity', 0)
      .style('stroke', '#8b5cf6')
      .style('stroke-width', 2);

    // Create gradient
    const gradient = svg.append('defs')
      .append('radialGradient')
      .attr('id', 'gradient');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#8b5cf6')
      .attr('stop-opacity', 0.6);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#ec4899')
      .attr('stop-opacity', 0.2);

    // Animate data area
    dataPath.transition()
      .duration(1000)
      .delay(500)
      .style('fill-opacity', 0.3);

    // Draw data points
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
      .style('fill', '#8b5cf6')
      .style('stroke', '#fff')
      .style('stroke-width', 2)
      .on('mouseenter', function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 8);
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 5);
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Visibility Radar Analysis</h3>
          <p className="text-sm text-gray-500">Multi-dimensional brand presence assessment</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-gray-400" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Compares your brand visibility across key metrics against industry benchmarks (yellow dashed line)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div ref={containerRef} className="relative">
        <svg ref={svgRef} className="w-full" />
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
            <span className="text-xs text-gray-600">Your Brand</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400 opacity-50" />
            <span className="text-xs text-gray-600">Industry Benchmark</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {radarData.slice(0, 4).map((item, index) => (
            <motion.div
              key={item.axis}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{item.axis}</span>
                {item.trend === 'up' ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : item.trend === 'down' ? (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                ) : null}
              </div>
              <Badge variant={item.value > item.benchmark ? 'default' : 'secondary'} className="text-xs">
                {item.value}%
              </Badge>
            </motion.div>
          ))}
        </div>
      </div>
    </Card>
  );
}