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
                                description="Number of simulations to run (default 1000)"
                                min={100}
                                step={100}
                                value={localConfig.mcCycles}
                                onChange={(val) => setLocalConfig({ ...localConfig, mcCycles: Number(val) })}
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
