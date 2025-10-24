'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Trophy,
  Target,
  Shield,
  Swords,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Award,
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

    // Enhanced color palette for different competitors
    const competitorColors = [
      '#8b5cf6', // purple (Your Brand - will use gradient)
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
      '#6366f1'  // indigo
    ];

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .append('text')
      .attr('x', width / 2)
      .attr('y', 35)
      .attr('fill', 'black')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Sentiment Score →');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -35)
      .attr('x', -height / 2)
      .attr('fill', 'black')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Market Dominance →');

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

    // Add circles - "Your Brand" bubble is 2x larger with diverse colors
    bubbles.append('circle')
      .attr('r', 0)
      .attr('fill', (d, i) => {
        if (d.name === 'Your Brand') return 'url(#brandGradient)';
        const color = competitorColors[i % competitorColors.length];
        return `${color}66`; // 40% opacity
      })
      .attr('stroke', (d, i) => {
        if (d.name === 'Your Brand') return '#8b5cf6';
        return competitorColors[i % competitorColors.length];
      })
      .attr('stroke-width', d => d.name === 'Your Brand' ? 3 : 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => setSelectedCompetitor(d as Competitor))
      .transition()
      .duration(800)
      .delay((d, i) => i * 100)
      .attr('r', d => d.name === 'Your Brand' ? sizeScale(d.mentionCount) * 2 : sizeScale(d.mentionCount));

    // Add gradient for brand
    const gradient = svg.append('defs')
      .append('radialGradient')
      .attr('id', 'brandGradient');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#8b5cf6')
      .attr('stop-opacity', 0.8);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#ec4899')
      .attr('stop-opacity', 0.4);

    // Add labels
    bubbles.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', d => d.name === 'Your Brand' ? '#8b5cf6' : '#374151')
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
      .style('fill', '#6b7280')
      .style('opacity', 0)
      .text(d => `${d.mentionCount} mentions`)
      .transition()
      .duration(800)
      .delay((d, i) => i * 100 + 400)
      .style('opacity', 1);

    // Add "You're here" annotation for Your Brand
    const yourBrandData = competitorData.find((d: any) => d.name === 'Your Brand');
    if (yourBrandData) {
      const annotation = svg.append('g')
        .attr('class', 'your-brand-annotation')
        .attr('transform', `translate(${(yourBrandData as any).x},${(yourBrandData as any).y})`)
        .style('opacity', 0);

      // Arrow pointing down to the bubble
      annotation.append('path')
        .attr('d', `M 0,${-sizeScale(yourBrandData.mentionCount) * 2 - 40} L -8,${-sizeScale(yourBrandData.mentionCount) * 2 - 25} L 8,${-sizeScale(yourBrandData.mentionCount) * 2 - 25} Z`)
        .attr('fill', '#8b5cf6')
        .attr('opacity', 0.8);

      // Background for text
      annotation.append('rect')
        .attr('x', -45)
        .attr('y', -sizeScale(yourBrandData.mentionCount) * 2 - 70)
        .attr('width', 90)
        .attr('height', 24)
        .attr('rx', 12)
        .attr('fill', '#8b5cf6')
        .attr('opacity', 0.95);

      // "You're here" text
      annotation.append('text')
        .attr('y', -sizeScale(yourBrandData.mentionCount) * 2 - 53)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', 'white')
        .text("👋 You're here");

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

    // Create quadrants
    const quadrantWidth = (width - margin.left - margin.right) / 2;
    const quadrantHeight = (height - margin.top - margin.bottom) / 2;

    const quadrants = [
      { x: margin.left, y: margin.top, label: 'Leaders', color: '#10b981' },
      { x: margin.left + quadrantWidth, y: margin.top, label: 'Challengers', color: '#3b82f6' },
      { x: margin.left, y: margin.top + quadrantHeight, label: 'Niche Players', color: '#f59e0b' },
      { x: margin.left + quadrantWidth, y: margin.top + quadrantHeight, label: 'Visionaries', color: '#8b5cf6' }
    ];

    // Draw quadrant backgrounds with enhanced shading
    quadrants.forEach((q, i) => {
      // Gradient background
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
        .attr('opacity', 0.08);

      // Label background with enhanced styling
      const labelGroup = svg.append('g')
        .style('opacity', 0);

      labelGroup.append('rect')
        .attr('x', q.x + quadrantWidth / 2 - 60)
        .attr('y', q.y + 8)
        .attr('width', 120)
        .attr('height', 28)
        .attr('rx', 14)
        .attr('fill', 'white')
        .attr('stroke', q.color)
        .attr('stroke-width', 2)
        .attr('opacity', 0.95);

      labelGroup.append('text')
        .attr('x', q.x + quadrantWidth / 2)
        .attr('y', q.y + 26)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('font-weight', 'bold')
        .style('fill', q.color)
        .text(q.label);

      labelGroup.transition()
        .duration(500)
        .delay(i * 100 + 200)
        .style('opacity', 1);
    });

    // Add axis labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text('Completeness of Vision →');

    svg.append('text')
      .attr('transform', `rotate(-90)`)
      .attr('x', -height / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#6b7280')
      .text('Ability to Execute →');

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
      .attr('fill', d => d.name === 'Your Brand' ? '#8b5cf6' : '#e5e7eb')
      .attr('stroke', d => d.name === 'Your Brand' ? '#8b5cf6' : '#9ca3af')
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
      .style('font-weight', 'bold')
      .style('fill', d => d.name === 'Your Brand' ? '#8b5cf6' : '#374151')
      .style('opacity', 0)
      .text(d => d.name)
      .transition()
      .duration(500)
      .delay((d, i) => i * 150 + 400)
      .style('opacity', 1);

    // Add "You're here" annotation for Your Brand in matrix view
    const yourBrandData = competitorData.find((d: any) => d.name === 'Your Brand');
    if (yourBrandData) {
      const annotation = svg.append('g')
        .attr('class', 'your-brand-annotation-matrix')
        .attr('transform', `translate(${xScale(yourBrandData.sentiment)},${yScale(yourBrandData.dominance || 50)})`)
        .style('opacity', 0);

      // Arrow pointing down
      annotation.append('path')
        .attr('d', 'M 0,-35 L -6,-22 L 6,-22 Z')
        .attr('fill', '#8b5cf6')
        .attr('opacity', 0.8);

      // Background
      annotation.append('rect')
        .attr('x', -45)
        .attr('y', -58)
        .attr('width', 90)
        .attr('height', 22)
        .attr('rx', 11)
        .attr('fill', '#8b5cf6')
        .attr('opacity', 0.95);

      // Text
      annotation.append('text')
        .attr('y', -43)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', 'white')
        .text("👋 You're here");

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
      className="grid grid-cols-2 gap-4 p-4"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-green-500" />
          <span className="font-semibold text-green-700">Strengths</span>
        </div>
        {(competitor.strengths || []).map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm"
          >
            <ChevronRight className="w-3 h-3 text-green-500" />
            <span>{s}</span>
          </motion.div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="font-semibold text-red-700">Weaknesses</span>
        </div>
        {(competitor.weaknesses || []).map((w, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm"
          >
            <ChevronRight className="w-3 h-3 text-red-500" />
            <span>{w}</span>
          </motion.div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-blue-700">Opportunities</span>
        </div>
        {(competitor.opportunities || []).map((o, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm"
          >
            <ChevronRight className="w-3 h-3 text-blue-500" />
            <span>{o}</span>
          </motion.div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Swords className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-700">Threats</span>
        </div>
        {(competitor.threats || []).map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm"
          >
            <ChevronRight className="w-3 h-3 text-orange-500" />
            <span>{t}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Competitive Landscape
          </h3>
          <p className="text-sm text-gray-500">AI perception of market competitors</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'bubble' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('bubble')}
          >
            Bubble
          </Button>
          <Button
            variant={viewMode === 'matrix' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('matrix')}
          >
            Matrix
          </Button>
          {detailed && (
            <Button
              variant={viewMode === 'swot' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('swot')}
            >
              SWOT
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'swot' ? (
        <Tabs defaultValue={competitorData[0]?.name} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            {competitorData.map(comp => (
              <TabsTrigger key={comp.name} value={comp.name}>
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
                className="mt-4 p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{selectedCompetitor.name}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCompetitor(null)}
                  >
                    ×
                  </Button>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Mentions</p>
                    <p className="text-lg font-bold">{selectedCompetitor.mentionCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Sentiment</p>
                    <p className="text-lg font-bold">{selectedCompetitor.sentiment}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Dominance</p>
                    <p className="text-lg font-bold">{selectedCompetitor.dominance || 50}%</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {!detailed && (
        <div className="mt-4 flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium">Your competitive position:</span>
          </div>
          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
            #2 of 4 competitors
          </Badge>
        </div>
      )}
    </Card>
  );
}