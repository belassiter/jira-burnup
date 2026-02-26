import { useState } from 'react';
import { Modal, Button, Group, Switch, NumberInput, Stack } from '@mantine/core';
import { ForecastConfig } from '../types';

interface ForecastModalProps {
    opened: boolean;
    onClose: () => void;
    config: ForecastConfig;
    onSave: (config: ForecastConfig) => void;
}

export function ForecastModal({ opened, onClose, config, onSave }: ForecastModalProps) {
    const [localConfig, setLocalConfig] = useState<ForecastConfig>(config);

    const handleSave = () => {
        onSave(localConfig);
        onClose();
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Forecast Configuration" centered>
            <Stack>
                <Switch 
                    label="Enable Forecast" 
                    checked={localConfig.enabled}
                    onChange={(event) => setLocalConfig({ ...localConfig, enabled: event.currentTarget.checked })}
                />
                
                {localConfig.enabled && (
                    <>
                        <NumberInput
                            label="Datapoints to Average"
                            description="Number of past intervals to use for velocity calculation"
                            min={1}
                            value={localConfig.avgDatapoints}
                            onChange={(val) => setLocalConfig({ ...localConfig, avgDatapoints: Number(val) })}
                        />
                        
                        <Switch
                            label="Show Confidence Intervals (95%)"
                            checked={localConfig.showConfidence}
                            onChange={(event) => setLocalConfig({ ...localConfig, showConfidence: event.currentTarget.checked })}
                        />
                        
                        {localConfig.showConfidence && (
                            <NumberInput
                                label="Monte Carlo Cycles"
                                description="Runs - Use ↑/↓ for x10/÷10"
                                min={100}
                                max={100000}
                                step={1000}
                                value={localConfig.mcCycles}
                                onChange={(val) => setLocalConfig({ ...localConfig, mcCycles: Number(val) })}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        const current = Number(localConfig.mcCycles) || 1000;
                                        const next = current * 10;
                                        setLocalConfig({ ...localConfig, mcCycles: next > 100000 ? 100000 : next });
                                    }
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        const current = Number(localConfig.mcCycles) || 1000;
                                        const next = current / 10;
                                        setLocalConfig({ ...localConfig, mcCycles: next < 100 ? 100 : Math.floor(next) });
                                    }
                                }}
                            />
                        )}
                    </>
                )}

                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </Group>
            </Stack>
        </Modal>
    );
}
