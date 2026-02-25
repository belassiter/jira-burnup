import { useState, useEffect } from 'react';
import { Modal, Button, Group, Text, Paper, Stack, Title, Popover, ColorSwatch, ColorPicker } from '@mantine/core';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { IconGripVertical } from '@tabler/icons-react';
import { StatusConfig, StatusCategory } from '../types';

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

const CATEGORIES: { id: StatusCategory; label: string }[] = [
    { id: 'not-started', label: 'Not Started' },
    { id: 'started', label: 'Started' },
    { id: 'done', label: 'Done' }
];

export function StatusManager({ opened, onClose, availableStatuses, statusConfigs, onConfigsChange }: StatusManagerProps) {
    const [localConfigs, setLocalConfigs] = useState<StatusConfig[]>([]);

    useEffect(() => {
        if (!opened) return;

        const existingMap = new Map(statusConfigs.map(c => [c.name, c]));
        const newConfigs: StatusConfig[] = [];

        // 1. Keep existing configs in their current order (this preserves user reordering)
        statusConfigs.forEach(c => {
            newConfigs.push({ ...c });
        });

        // 2. Add any new available statuses that aren't in configs
        availableStatuses.forEach(status => {
            if (!existingMap.has(status)) {
                newConfigs.push({
                    name: status,
                    color: DEFAULT_COLORS[newConfigs.length % DEFAULT_COLORS.length],
                    enabled: true,
                    category: 'not-started'
                });
            }
        });

        // 3. Ensure category valid
        newConfigs.forEach(c => {
            if (!c.category) c.category = 'not-started';
        });

        // Effect is used to sync props to local state when modal opens
        // eslint-disable-next-line
        setLocalConfigs(newConfigs);
    }, [opened, availableStatuses, statusConfigs]);


    const handleDragEnd = (result: any) => {
        const { source, destination } = result;
        
        if (!destination) {
            return;
        }

        const sourceDroppableId = source.droppableId as StatusCategory;
        const destDroppableId = destination.droppableId as StatusCategory;
        const sourceIndex = source.index;
        const destIndex = destination.index;

        // Group by category so we can manage indices per list
        const categories: Record<StatusCategory, StatusConfig[]> = {
            'not-started': localConfigs.filter(c => c.category === 'not-started'),
            'started': localConfigs.filter(c => c.category === 'started'),
            'done': localConfigs.filter(c => c.category === 'done')
        };

        // Source list
        const sourceList = Array.from(categories[sourceDroppableId]);
        // Remove item
        const [movedItem] = sourceList.splice(sourceIndex, 1);
        
        // Update item category
        movedItem.category = destDroppableId;

        // Destination list (could be same as source)
        const destList = sourceDroppableId === destDroppableId ? sourceList : Array.from(categories[destDroppableId]);
        
        // Insert item
        destList.splice(destIndex, 0, movedItem);

        // Update the categories map
        categories[sourceDroppableId] = sourceList;
        categories[destDroppableId] = destList;

        // Flatten back to array (preserving category groups order: Not Started -> Started -> Done)
        const newConfigs = [
            ...categories['not-started'],
            ...categories['started'],
            ...categories['done']
        ];
        
        setLocalConfigs(newConfigs);
    };

    const handleSave = () => {
        onConfigsChange(localConfigs);
        onClose();
    };

    const toggleStatus = (name: string) => {
        setLocalConfigs(prev => prev.map(c => 
            c.name === name ? { ...c, enabled: !c.enabled } : c
        ));
    };

    const updateColor = (name: string, color: string) => {
        setLocalConfigs(prev => prev.map(c => 
            c.name === name ? { ...c, color } : c
        ));
    };

    const getItemsByCategory = (category: StatusCategory) => {
        return localConfigs.filter(c => c.category === category);
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Manage Statuses" size="lg">
            <Text size="sm" mb="md" c="dimmed">
                Drag statuses between sections to categorize them. The order within sections and the sections (Not Started -{'>'} Started -{'>'} Done) determine the stacking order in the chart.
            </Text>

            <DragDropContext onDragEnd={handleDragEnd}>
                <Stack gap="md">
                    {CATEGORIES.map(category => (
                        <Paper key={category.id} p="sm" withBorder bg="gray.0">
                            <Title order={6} mb="sm" tt="uppercase" c="dimmed">{category.label}</Title>
                            <Droppable droppableId={category.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        style={{ 
                                            minHeight: 50,
                                            backgroundColor: snapshot.isDraggingOver ? '#e9ecef' : 'transparent',
                                            padding: 4,
                                            borderRadius: 4
                                        }}
                                    >
                                        <Stack gap="xs">
                                            {getItemsByCategory(category.id).map((config, index) => (
                                                <Draggable key={config.name} draggableId={config.name} index={index}>
                                                    {(provided) => (
                                                        <Paper
                                                            p="xs"
                                                            shadow="xs"
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                                opacity: config.enabled ? 1 : 0.6,
                                                                borderLeft: `4px solid ${config.color}`,
                                                                display: 'flex',
                                                                alignItems: 'center'
                                                            }}
                                                        >
                                                            <Group gap="xs" style={{ flex: 1 }} wrap="nowrap">
                                                                <div 
                                                                    {...provided.dragHandleProps}
                                                                    style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}
                                                                >
                                                                    <IconGripVertical size={14} color="gray" />
                                                                </div>

                                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                                    <Text size="sm" truncate fw={500}>{config.name}</Text>
                                                                </div>

                                                                <Button 
                                                                    variant={config.enabled ? "light" : "subtle"}
                                                                    color={config.enabled ? "blue" : "gray"}
                                                                    size="compact-xs"
                                                                    onClick={() => toggleStatus(config.name)}
                                                                >
                                                                    {config.enabled ? "On" : "Off"}
                                                                </Button>
                                                                
                                                                <Popover position="bottom-end" shadow="md">
                                                                    <Popover.Target>
                                                                        <ColorSwatch 
                                                                            color={config.color} 
                                                                            size={30}
                                                                            component="button"
                                                                            style={{ cursor: 'pointer', border: '1px solid #ddd' }}
                                                                        />
                                                                    </Popover.Target>
                                                                    <Popover.Dropdown>
                                                                        <ColorPicker
                                                                            value={config.color}
                                                                            onChange={(c) => updateColor(config.name, c)}
                                                                        />
                                                                    </Popover.Dropdown>
                                                                </Popover>
                                                            </Group>
                                                        </Paper>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </Stack>
                                    </div>
                                )}
                            </Droppable>
                        </Paper>
                    ))}
                </Stack>
            </DragDropContext>

            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave}>Apply Changes</Button>
            </Group>
        </Modal>
    );
}
