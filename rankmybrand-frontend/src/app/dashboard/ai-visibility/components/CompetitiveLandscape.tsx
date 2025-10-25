'use client';

/**
 * CompetitiveLandscape - Professional B2B Market Analysis
 * Design System: Monochrome + Semantic Colors
 * - Neutral D3 visualizations (grayscale bubbles)
 * - Semantic colors for data only (sentiment indicators)
 * - Professional typography and trust signals
 * - Bloomberg Terminal aesthetic
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BarChart3,
  Target,
  Shield,
  Swords,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Building2,
  Users,
  Zap
} from 'lucide-react';
import { validateCompetitorData } from '@/lib/dashboard-utils';

interface Competitor {
  name: string;
  mentionCount: number;
  sentiment: number;
  dominance?: number;
  strengths?: string[];
  weaknesses?: string[];
  threats?: string[];
  opportunities?: string[];
}

interface CompetitiveLandscapeProps {
  competitors?: Competitor[];
  detailed?: boolean;
}

export default function CompetitiveLandscape({ competitors = [], detailed = false }: CompetitiveLandscapeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [viewMode, setViewMode] = useState<'bubble' | 'matrix' | 'swot'>('bubble');

  // Validate and sanitize competitor data to prevent D3 crashes
  const rawCompetitors = competitors.length > 0 ? competitors : [
    {
      name: 'Your Brand',
      mentionCount: 145,
      sentiment: 78,
      dominance: 32,
      strengths: ['Innovation', 'Customer Service', 'Pricing'],
      weaknesses: ['Market Reach', 'Brand Awareness'],
      threats: ['New Entrants', 'Tech Changes'],
      opportunities: ['Partnerships', 'New Markets']
    },
    {
      name: 'Competitor A',
      mentionCount: 230,
      sentiment: 72,
      dominance: 45,
      strengths: ['Market Leader', 'Brand Recognition'],
      weaknesses: ['Pricing', 'Innovation Speed'],
      threats: ['Regulatory Changes'],
      opportunities: ['Digital Transformation']
    },
    {
      name: 'Competitor B',
      mentionCount: 180,
      sentiment: 65,
      dominance: 28,
      strengths: ['Technology', 'Patents'],
      weaknesses: ['Customer Support', 'UI/UX'],
      threats: ['Market Saturation'],
      opportunities: ['Global Expansion']
    },
    {
      name: 'Competitor C',
      mentionCount: 95,
      sentiment: 82,
      dominance: 15,
      strengths: ['Niche Focus', 'Quality'],
      weaknesses: ['Scale', 'Resources'],
      threats: ['Acquisition Risk'],
      opportunities: ['Strategic Alliances']
    }
  ];

  // Apply safe validation to all competitor data
  const competitorData = validateCompetitorData(rawCompetitors);

  const drawBubbleChart = () => {
    if (!svgRef.current) return;

    const width = 600;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, 100])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);

    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(competitorData, d => d.mentionCount) || 250])
      .range([10, 50]);

    // Professional neutral grayscale palette
    const competitorColors = [
      '#171717', // neutral-900 (Your Brand - darkest)
      '#404040', // neutral-700
      '#525252', // neutral-600
      '#737373', // neutral-500
      '#a3a3a3', // neutral-400
      '#d4d4d4', // neutral-300
      '#e5e5e5', // neutral-200
      '#f5f5f5'  // neutral-100
    ];

    // Add axes - Professional neutral styling
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .append('text')
      .attr('x', width / 2)
      .attr('y', 35)
      .attr('fill', '#525252') // neutral-600
      .style('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.05em')
      .text('SENTIMENT SCORE →');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -35)
      .attr('x', -height / 2)
      .attr('fill', '#525252') // neutral-600
      .style('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.05em')
      .text('MARKET DOMINANCE →');

    // Add grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale)
        .tickSize(-height + margin.top + margin.bottom)
        .tickFormat(() => ''))
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.3);

    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale)
        .tickSize(-width + margin.left + margin.right)
        .tickFormat(() => ''))
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.3);

    // Create force simulation - Account for 2x larger "Your Brand" bubble
    const simulation = d3.forceSimulation(competitorData as any)
      .force('x', d3.forceX((d: any) => xScale(d.sentiment)).strength(1))
      .force('y', d3.forceY((d: any) => yScale(d.dominance || 50)).strength(1))
      .force('collide', d3.forceCollide((d: any) =>
        (d.name === 'Your Brand' ? sizeScale(d.mentionCount) * 2 : sizeScale(d.mentionCount)) + 2
      ))
      .stop();

    // Run simulation
    for (let i = 0; i < 120; ++i) simulation.tick();

    // Draw bubbles
    const bubbles = svg.selectAll('.bubble')
      .data(competitorData)
      .enter()
      .append('g')
      .attr('class', 'bubble')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    // Add circles - Professional neutral palette, "Your Brand" is 2x larger with darker shade
    bubbles.append('circle')
      .attr('r', 0)
      .attr('fill', (d, i) => {
        const color = competitorColors[i % competitorColors.length];
        // "Your Brand" uses darkest neutral, others use lighter neutrals with transparency
        if (d.name === 'Your Brand') return `${color}40`; // 25% opacity for subtle fill
        return `${color}20`; // 12% opacity for competitors
      })
      .attr('stroke', (d, i) => {
        return competitorColors[i % competitorColors.length];
      })
      .attr('stroke-width', d => d.name === 'Your Brand' ? 3 : 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => setSelectedCompetitor(d as Competitor))
      .transition()
      .duration(800)
      .delay((d, i) => i * 100)
      .attr('r', d => d.name === 'Your Brand' ? sizeScale(d.mentionCount) * 2 : sizeScale(d.mentionCount));

    // Note: Removed gradient - using neutral colors only for professional B2B design

    // Add labels - Professional neutral typography
    bubbles.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .style('fill', '#171717') // neutral-900 - all labels same color for consistency
      .style('opacity', 0)
      .text(d => d.name)
      .transition()
      .duration(800)
      .delay((d, i) => i * 100 + 400)
      .style('opacity', 1);

    bubbles.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .style('font-size', '10px')
      .style('font-weight', '500')
      .style('font-family', 'JetBrains Mono, Monaco, monospace')
      .style('font-variant-numeric', 'tabular-nums')
      .style('fill', '#737373') // neutral-500
      .style('opacity', 0)
      .text(d => `${d.mentionCount} mentions`)
      .transition()
      .duration(800)
      .delay((d, i) => i * 100 + 400)
      .style('opacity', 1);

    // Add professional "Your Position" annotation - neutral design
    const yourBrandData = competitorData.find((d: any) => d.name === 'Your Brand');
    if (yourBrandData) {
      const annotation = svg.append('g')
        .attr('class', 'your-brand-annotation')
        .attr('transform', `translate(${(yourBrandData as any).x},${(yourBrandData as any).y})`)
        .style('opacity', 0);

      // Arrow pointing down - neutral
      annotation.append('path')
        .attr('d', `M 0,${-sizeScale(yourBrandData.mentionCount) * 2 - 40} L -6,${-sizeScale(yourBrandData.mentionCount) * 2 - 28} L 6,${-sizeScale(yourBrandData.mentionCount) * 2 - 28} Z`)
        .attr('fill', '#171717') // neutral-900
        .attr('opacity', 0.9);

      // Background for text - neutral border
      annotation.append('rect')
        .attr('x', -48)
        .attr('y', -sizeScale(yourBrandData.mentionCount) * 2 - 70)
        .attr('width', 96)
        .attr('height', 24)
        .attr('rx', 4)
        .attr('fill', '#ffffff')
        .attr('stroke', '#171717') // neutral-900
        .attr('stroke-width', 2)
        .attr('opacity', 1);

      // Professional "Your Position" text
      annotation.append('text')
        .attr('y', -sizeScale(yourBrandData.mentionCount) * 2 - 53)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .style('letter-spacing', '0.05em')
        .style('fill', '#171717') // neutral-900
        .text('YOUR POSITION');

      // Animate annotation
      annotation.transition()
        .duration(600)
        .delay(1200)
        .style('opacity', 1);
    }
  };

  const drawMatrixView = () => {
    if (!svgRef.current) return;

    const width = 600;
    const height = 400;
    const margin = { top: 80, right: 80, bottom: 80, left: 80 };

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create quadrants - Professional neutral palette
    const quadrantWidth = (width - margin.left - margin.right) / 2;
    const quadrantHeight = (height - margin.top - margin.bottom) / 2;

    const quadrants = [
      { x: margin.left, y: margin.top, label: 'Leaders', color: '#171717' }, // neutral-900
      { x: margin.left + quadrantWidth, y: margin.top, label: 'Challengers', color: '#404040' }, // neutral-700
      { x: margin.left, y: margin.top + quadrantHeight, label: 'Niche Players', color: '#737373' }, // neutral-500
      { x: margin.left + quadrantWidth, y: margin.top + quadrantHeight, label: 'Visionaries', color: '#525252' } // neutral-600
    ];

    // Draw quadrant backgrounds - Professional neutral styling
    quadrants.forEach((q, i) => {
      // Subtle neutral background
      svg.append('rect')
        .attr('x', q.x)
        .attr('y', q.y)
        .attr('width', quadrantWidth)
        .attr('height', quadrantHeight)
        .attr('fill', q.color)
        .attr('opacity', 0)
        .transition()
        .duration(500)
        .delay(i * 100)
        .attr('opacity', 0.03); // Very subtle background

      // Professional label styling
      const labelGroup = svg.append('g')
        .style('opacity', 0);

      labelGroup.append('rect')
        .attr('x', q.x + quadrantWidth / 2 - 60)
        .attr('y', q.y + 8)
        .attr('width', 120)
        .attr('height', 24)
        .attr('rx', 4) // Smaller radius for professional look
        .attr('fill', 'white')
        .attr('stroke', '#d4d4d4') // neutral-300 - consistent border
        .attr('stroke-width', 1.5);

      labelGroup.append('text')
        .attr('x', q.x + quadrantWidth / 2)
        .attr('y', q.y + 24)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .style('letter-spacing', '0.05em')
        .style('fill', '#525252') // neutral-600 - all labels same color
        .text(q.label.toUpperCase());

      labelGroup.transition()
        .duration(500)
        .delay(i * 100 + 200)
        .style('opacity', 1);
    });

    // Add axis labels - Professional neutral styling
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.05em')
      .style('fill', '#525252') // neutral-600
      .text('COMPLETENESS OF VISION →');

    svg.append('text')
      .attr('transform', `rotate(-90)`)
      .attr('x', -height / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.05em')
      .style('fill', '#525252') // neutral-600
      .text('ABILITY TO EXECUTE →');

    // Plot competitors
    const xScale = d3.scaleLinear()
      .domain([0, 100])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);

    const dots = svg.selectAll('.competitor-dot')
      .data(competitorData)
      .enter()
      .append('g')
      .attr('class', 'competitor-dot')
      .attr('transform', d => `translate(${xScale(d.sentiment)},${yScale(d.dominance || 50)})`);

    dots.append('circle')
      .attr('r', 0)
      .attr('fill', d => d.name === 'Your Brand' ? '#171717' : '#f5f5f5') // neutral-900 or neutral-100
      .attr('stroke', d => d.name === 'Your Brand' ? '#171717' : '#d4d4d4') // neutral-900 or neutral-300
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => setSelectedCompetitor(d as Competitor))
      .transition()
      .duration(800)
      .delay((d, i) => i * 150)
      .attr('r', 8);

    dots.append('text')
      .attr('dy', -15)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', '700')
      .style('fill', '#171717') // neutral-900 - consistent for all
      .style('opacity', 0)
      .text(d => d.name)
      .transition()
      .duration(500)
      .delay((d, i) => i * 150 + 400)
      .style('opacity', 1);

    // Add professional "Your Position" annotation for matrix view
    const yourBrandData = competitorData.find((d: any) => d.name === 'Your Brand');
    if (yourBrandData) {
      const annotation = svg.append('g')
        .attr('class', 'your-brand-annotation-matrix')
        .attr('transform', `translate(${xScale(yourBrandData.sentiment)},${yScale(yourBrandData.dominance || 50)})`)
        .style('opacity', 0);

      // Arrow pointing down - neutral
      annotation.append('path')
        .attr('d', 'M 0,-35 L -6,-24 L 6,-24 Z')
        .attr('fill', '#171717') // neutral-900
        .attr('opacity', 0.9);

      // Background - neutral border
      annotation.append('rect')
        .attr('x', -48)
        .attr('y', -56)
        .attr('width', 96)
        .attr('height', 20)
        .attr('rx', 4)
        .attr('fill', '#ffffff')
        .attr('stroke', '#171717') // neutral-900
        .attr('stroke-width', 2);

      // Professional text
      annotation.append('text')
        .attr('y', -42)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .style('letter-spacing', '0.05em')
        .style('fill', '#171717') // neutral-900
        .text('YOUR POSITION');

      // Animate
      annotation.transition()
        .duration(600)
        .delay(1000)
        .style('opacity', 1);
    }
  };

  useEffect(() => {
    if (viewMode === 'bubble') {
      drawBubbleChart();
    } else if (viewMode === 'matrix') {
      drawMatrixView();
    }
  }, [viewMode, competitorData]);

  const SwotAnalysis = ({ competitor }: { competitor: Competitor }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 gap-6 p-6"
    >
      {/* Strengths - Semantic Green */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-success-600" />
          <span className="section-header text-success-700 dark:text-success-500">Strengths</span>
        </div>
        {(competitor.strengths || []).map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300"
          >
            <ChevronRight className="w-3 h-3 text-success-600 flex-shrink-0" />
            <span>{s}</span>
          </motion.div>
        ))}
      </div>

      {/* Weaknesses - Semantic Red */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-danger-600" />
          <span className="section-header text-danger-700 dark:text-danger-500">Weaknesses</span>
        </div>
        {(competitor.weaknesses || []).map((w, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300"
          >
            <ChevronRight className="w-3 h-3 text-danger-600 flex-shrink-0" />
            <span>{w}</span>
          </motion.div>
        ))}
      </div>

      {/* Opportunities - Semantic Interactive Blue */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-interactive-600" />
          <span className="section-header text-interactive-700 dark:text-interactive-500">Opportunities</span>
        </div>
        {(competitor.opportunities || []).map((o, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300"
          >
            <ChevronRight className="w-3 h-3 text-interactive-600 flex-shrink-0" />
            <span>{o}</span>
          </motion.div>
        ))}
      </div>

      {/* Threats - Semantic Warning */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="w-4 h-4 text-warning-600" />
          <span className="section-header text-warning-700 dark:text-warning-500">Threats</span>
        </div>
        {(competitor.threats || []).map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300"
          >
            <ChevronRight className="w-3 h-3 text-warning-600 flex-shrink-0" />
            <span>{t}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  return (
    <Card className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
      <div className="border-b border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="section-header mb-2">Market Intelligence</div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-0 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-neutral-600" />
              Competitive Landscape
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">AI perception analysis across {competitorData.length} competitors</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'bubble' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('bubble')}
              className="text-xs font-semibold"
            >
              Bubble View
            </Button>
            <Button
              variant={viewMode === 'matrix' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('matrix')}
              className="text-xs font-semibold"
            >
              Matrix View
            </Button>
            {detailed && (
              <Button
                variant={viewMode === 'swot' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('swot')}
                className="text-xs font-semibold"
              >
                SWOT Analysis
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {viewMode === 'swot' ? (
          <Tabs defaultValue={competitorData[0]?.name} className="w-full">
            <TabsList className="grid grid-cols-4 w-full mb-6">
              {competitorData.map(comp => (
                <TabsTrigger key={comp.name} value={comp.name} className="text-xs font-semibold">
                  {comp.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {competitorData.map(comp => (
              <TabsContent key={comp.name} value={comp.name}>
                <SwotAnalysis competitor={comp} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <>
            <svg ref={svgRef} className="w-full" />
          
          <AnimatePresence>
            {selectedCompetitor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-6 bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700 rounded-md"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-0">{selectedCompetitor.name}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCompetitor(null)}
                    className="text-neutral-500 hover:text-neutral-900"
                  >
                    ×
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="section-header mb-2">AI Mentions</p>
                    <p className="font-mono tabular-nums text-2xl font-bold text-neutral-900 dark:text-neutral-0">{selectedCompetitor.mentionCount}</p>
                  </div>
                  <div>
                    <p className="section-header mb-2">Sentiment</p>
                    <p className="font-mono tabular-nums text-2xl font-bold text-neutral-900 dark:text-neutral-0">{selectedCompetitor.sentiment}%</p>
                  </div>
                  <div>
                    <p className="section-header mb-2">Market Share</p>
                    <p className="font-mono tabular-nums text-2xl font-bold text-neutral-900 dark:text-neutral-0">{selectedCompetitor.dominance || 50}%</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

        {!detailed && (
          <div className="mt-6 flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700 rounded-md">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-neutral-600" />
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Your Competitive Position</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums text-xl font-bold text-neutral-900 dark:text-neutral-0">#2</span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">of {competitorData.length}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}