import { useState, useEffect } from 'react';
import { Modal, Button, Group, Text, ColorInput, ScrollArea, Paper } from '@mantine/core';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { IconGripVertical } from '@tabler/icons-react';

interface StatusConfig {
    name: string;
    color: string;
    enabled: boolean;
}

interface StatusManagerProps {
    opened: boolean;
    onClose: () => void;
    availableStatuses: string[];
    statusConfigs: StatusConfig[]; 
    onConfigsChange: (configs: StatusConfig[]) => void;
}

const DEFAULT_COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#d0ed57', 
    '#a4de6c', '#8dd1e1', '#83a6ed', '#8e4585', '#cb4335'
];

export function StatusManager({ opened, onClose, availableStatuses, statusConfigs, onConfigsChange }: StatusManagerProps) {
    const [localConfigs, setLocalConfigs] = useState<StatusConfig[]>([]);

    // Sync when opening or when dependencies change
    useEffect(() => {
        // Merge availableStatuses with existing configs
        // If a status is in availableStatuses but not in configs, add it.
        // If a status is in configs but not available? Keep it maybe? Or mark as inactive? 
        // For now, let's ensure all availableStatuses are present.
        
        const newConfigs = [...statusConfigs];
        
        availableStatuses.forEach(status => {
            if (!newConfigs.find(c => c.name === status)) {
                newConfigs.push({
                    name: status,
                    color: DEFAULT_COLORS[newConfigs.length % DEFAULT_COLORS.length],
                    enabled: true
                });
            }
        });

        // Filter out any configs that are no longer in availableStatuses? 
        // Or keep them so settings persist if data is refreshed? 
        // Let's keep them but maybe sort valid ones to top? 
        // The user can reorder them.

        // eslint-disable-next-line
        setLocalConfigs(newConfigs);
    }, [availableStatuses, statusConfigs, opened]);


    const handleDragEnd = (result: any) => {
        if (!result.destination) return;
        
        const items = Array.from(localConfigs);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setLocalConfigs(items);
    };

    const handleSave = () => {
        onConfigsChange(localConfigs);
        onClose();
    };

    const toggleStatus = (index: number) => {
        const newConfigs = [...localConfigs];
        newConfigs[index].enabled = !newConfigs[index].enabled;
        setLocalConfigs(newConfigs);
    };

    const updateColor = (index: number, color: string) => {
        const newConfigs = [...localConfigs];
        newConfigs[index].color = color;
        setLocalConfigs(newConfigs);
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Manage Statuses" size="lg">
            <Text size="sm" mb="md" c="dimmed">
                Drag to reorder stacking. Uncheck to hide. Click color to change.
            </Text>
            
            <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="statuses">
                    {(provided) => (
                        <ScrollArea h={400} {...provided.droppableProps} ref={provided.innerRef}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {localConfigs.map((config, index) => (
                                    <Draggable key={config.name} draggableId={config.name} index={index}>
                                        {(provided) => (
                                            <Paper 
                                                p="xs" 
                                                withBorder 
                                                ref={provided.innerRef}
                                                {...provided.draggableProps} 
                                                style={{ 
                                                    ...provided.draggableProps.style,
                                                    opacity: config.enabled ? 1 : 0.6,
                                                    backgroundColor: config.enabled ? 'transparent' : '#f8f9fa'
                                                }}
                                            >
                                                <Group>
                                                    <div {...provided.dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                                                        <IconGripVertical size={18} color="gray" />
                                                    </div>
                                                    
                                                    <Button 
                                                        variant={config.enabled ? "light" : "subtle"} 
                                                        color={config.enabled ? "blue" : "gray"}
                                                        size="xs"
                                                        onClick={() => toggleStatus(index)}
                                                        w={80}
                                                    >
                                                        {config.enabled ? "Shown" : "Hidden"}
                                                    </Button>

                                                    <Text style={{ flex: 1 }} fw={500}>{config.name}</Text>
                                                    
                                                    <ColorInput 
                                                        value={config.color} 
                                                        onChange={(c) => updateColor(index, c)}
                                                        size="xs"
                                                        w={120}
                                                        disabled={!config.enabled}
                                                    />
                                                </Group>
                                            </Paper>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        </ScrollArea>
                    )}
                </Droppable>
            </DragDropContext>

            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave}>Apply Changes</Button>
            </Group>
        </Modal>
    );
}
