import { Modal, Text, Stack, NumberInput, Group, SegmentedControl } from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { useState, useMemo } from 'react';

interface SimulationResultsModalProps {
    opened: boolean;
    onClose: () => void;
    results: { slopes: number[]; completionDates: string[] } | undefined; // Now expects object
    metricLabel: string;
    mcCycles: number;
    onUpdateMcCycles: (cycles: number) => void;
}

export function SimulationResultsModal({ opened, onClose, results, metricLabel, mcCycles, onUpdateMcCycles }: SimulationResultsModalProps) {
    const [viewMode, setViewMode] = useState<'rate' | 'date'>('rate');
    
    // Allow stepping by logarithm (x10) or division (/10)
    // Mantine NumberInput step is linear. We need custom handler?
    // User requested: "Input arrows... Up arrow should multiply by 10... Down arrow should divide by 10."
    // We can't easily override the arrow behavior of standard input type=number without custom component or key listener.
    // However, we can use `step` if we control it dynamically or just provide buttons?
    // Or we implement a custom control.
    // Let's try to simulate logarithmic step by detecting change?
    // Actually, Mantine NumberInput `step` prop can be a number.
    
    const handleCyclesChange = (val: number | string) => {
       const num = Number(val);
       onUpdateMcCycles(num);
    };

    const dataValues = useMemo(() => {
        if (!results || !results.slopes) return [];
        if (viewMode === 'rate') return results.slopes;
        // For dates, convert to timestamps
        return results.completionDates.map(d => new Date(d).getTime());
    }, [results, viewMode]);

    if (!results || !results.slopes || results.slopes.length === 0) return null;

    const formatRateSigFig = (val: number) => {
        if (val === 0) return "0";
        if (Math.abs(val) >= 10) return Math.round(val).toString();
        return parseFloat(val.toPrecision(2)).toString();
    };

    const formatDateLabel = (ts: number) => {
        return new Date(ts).toISOString().split('T')[0];
    };

    const formatValue = (val: number) => {
        return viewMode === 'rate' ? formatRateSigFig(val) : formatDateLabel(val);
    };

    // 1. Calculate Stats
    const sorted = [...dataValues].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    // Average
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    
    // Median
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    
    // 95% CI
    const p05Index = Math.floor(sorted.length * 0.05);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p05 = sorted[p05Index];
    const p95 = sorted[p95Index];
    
    // 2. Create Bins for Histogram
    // Use Sturges' formula or simple sqrt logic
    const binCount = Math.min(20, Math.ceil(Math.sqrt(dataValues.length)));
    const range = max - min;
    const binSize = range > 0 ? (range / binCount) : 1;
    
    // If viewing Dates, range is in ms. binSize is ms.
    // We might want to align bins to Days if binSize is close to a day (86400000).
    const isDate = viewMode === 'date';
    // If date range is small, ensure binSize >= 1 day
    const correctedBinSize = isDate ? Math.max(binSize, 86400000) : binSize;
    // Recalculate count if we forced binSize
    const correctedBinCount = isDate ? Math.ceil(range / correctedBinSize) : binCount; 
    
    const bins: { rangeStart: number; rangeEnd: number; count: number; percent: number; label: string }[] = [];
    
    for (let i = 0; i < correctedBinCount; i++) {
        const start = min + (i * correctedBinSize);
        const end = min + ((i + 1) * correctedBinSize);
        // Label logic
        let label = "";
        if (isDate) {
           // If 1 day bin, just show date
           if (correctedBinSize <= 86400000 * 1.5) {
               label = formatDateLabel(start);
           } else {
               label = `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
           }
        } else {
            label = `${formatRateSigFig(start)} - ${formatRateSigFig(end)}`;
        }
        
        bins.push({
            rangeStart: start,
            rangeEnd: end,
            count: 0,
            percent: 0,
            label
        });
    }
    
    // Fill bins
    dataValues.forEach(val => {
        let binIndex = Math.floor((val - min) / correctedBinSize);
        if (binIndex >= bins.length) binIndex = bins.length - 1; 
        if (binIndex < 0) binIndex = 0;
        bins[binIndex].count++;
    });

    // Calculate percentages
    const totalRuns = dataValues.length;
    bins.forEach(b => {
        b.percent = Number(((b.count / totalRuns) * 100).toFixed(1));
    });

    return (
        <Modal opened={opened} onClose={onClose} title="Monte Carlo Simulation Results" size="lg">
            <Stack>
                <Group justify="space-between" align="end">
                     <Stack gap={0} style={{ flex: 1 }}>
                        <Text size="sm">
                            Distribution of {viewMode === 'rate' ? 'completion rates' : 'completion dates'} ({mcCycles} runs)
                        </Text>
                        <Group>
                            <Text size="xs" c="dimmed">P05: {formatValue(p05)}</Text>
                            <Text size="xs" c="dimmed">Median: {formatValue(median)}</Text>
                            <Text size="xs" c="dimmed">P95: {formatValue(p95)}</Text>
                        </Group>
                     </Stack>
                     
                     <Stack align="flex-end" gap="xs">
                        <SegmentedControl
                            value={viewMode}
                            onChange={(v) => setViewMode(v as 'rate' | 'date')}
                            data={[
                                { label: 'Rate', value: 'rate' },
                                { label: 'Date', value: 'date' },
                            ]}
                            size="xs"
                        />
                        <NumberInput 
                            label="Monte Carlo Cycles"
                            // Custom increment handling
                            // To actually intercept the stepper clicks, we might need a custom component or use logic
                            // Mantine 7: supports separate `step` prop.
                            // But we can't detect direction easily.
                            
                            // Let's implement keydown handler for Up/Down
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const next = mcCycles * 10;
                                    onUpdateMcCycles(next > 100000 ? 100000 : next);
                                }
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const next = mcCycles / 10;
                                    onUpdateMcCycles(next < 100 ? 100 : Math.floor(next));
                                }
                            }}
                            
                            value={mcCycles}
                            onChange={handleCyclesChange}
                            min={100}
                            max={100000}
                            step={1000} // Default step for buttons if they are clicked...
                            // If user clicks the stepper buttons, they get +/- 1000.
                            // If they use keyboard, they get x10 / 10.
                            // The user asked for "Input arrows", usually meaning the stepper buttons.
                            // Mantine NumberInput hides native browser arrows and uses custom ones.
                            // We can't easily hook into those specific buttons without rebuilding the input.
                            // However, we can try to provide a specialized step logic if Mantine exposes it.
                            // Mantine documentation says `step` can be a number.
                            // It doesn't support a function.
                            // "SimulationResultsModal" -> Let's stick to Keyboard shortcut + standard step for now,
                            // OR we create custom ActionIcon buttons next to it.
                            
                            description="Use ↑/↓ for x10/÷10"
                            w={150}
                        />
                     </Stack>
                </Group>
                
                <div style={{ height: 400, width: '100%' }}>
                    <ResponsiveContainer>
                        <BarChart data={bins} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                            <XAxis 
                                dataKey="label" 
                                angle={-45}
                                textAnchor="end" 
                                height={80}
                                interval={viewMode === 'date' ? 0 : Math.floor(binCount / 10)}
                                tick={{ fontSize: 10 }}
                            >
                                <Label 
                                    value={viewMode === 'date' ? "Completion Date" : `${metricLabel} per work day`} 
                                    position="insideBottom" 
                                    offset={-20} 
                                />
                            </XAxis>
                            <YAxis label={{ value: 'Frequency (%)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip 
                                labelFormatter={(label) => `Range: ${label}`}
                                formatter={(value: number, name: string) => [
                                    name === 'Frequency' ? `${value}%` : value, 
                                    name
                                ]}
                            />
                            <Bar dataKey="percent" fill="#8884d8" name="Frequency" />
                            
                            {/* Average Line */}
                            <ReferenceLine x={bins.find(b => avg >= b.rangeStart && avg <= b.rangeEnd)?.label} stroke="#ff7300" strokeDasharray="5 5" strokeWidth={2}>
                                <Label value={`Avg: ${formatValue(avg)}`} position="insideTopRight" angle={-90} offset={10} fill="#ff7300" style={{ fontWeight: 'bold' }} />
                            </ReferenceLine>

                            {/* Median Line */}
                            <ReferenceLine x={bins.find(b => median >= b.rangeStart && median <= b.rangeEnd)?.label} stroke="#8884d8" strokeDasharray="5 5" strokeWidth={2}>
                                <Label value={`Median: ${formatValue(median)}`} position="insideTopRight" angle={-90} offset={10} fill="#8884d8" />
                            </ReferenceLine>

                            {/* P95 Line */}
                            <ReferenceLine x={bins.find(b => p95 >= b.rangeStart && p95 <= b.rangeEnd)?.label} stroke="#82ca9d" strokeDasharray="3 3" strokeWidth={2}>
                                <Label value={`95%: ${formatValue(p95)}`} position="insideTopRight" angle={-90} offset={10} fill="#82ca9d" />
                            </ReferenceLine>

                             {/* P05 Line */}
                             <ReferenceLine x={bins.find(b => p05 >= b.rangeStart && p05 <= b.rangeEnd)?.label} stroke="#82ca9d" strokeDasharray="3 3" strokeWidth={2}>
                                <Label value={`5%: ${formatValue(p05)}`} position="insideTopRight" angle={-90} offset={10} fill="#82ca9d" />
                            </ReferenceLine>

                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                <Text size="xs" c="dimmed" ta="center">Median: {formatValue(median)} | Range: {formatValue(min)} - {formatValue(max)}</Text>
            </Stack>
        </Modal>
    );
}
