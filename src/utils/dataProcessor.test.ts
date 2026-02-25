import { describe, it, expect } from 'vitest';
import { processDailySnapshots } from './dataProcessor';
import { Issue } from '../types';

describe('processDailySnapshots', () => {
    it('should correctly snapshot status history', () => {
        const issues: Issue[] = [{
            key: 'TEST-1',
            fields: {
                created: '2023-01-01T08:00:00.000-0800',
                status: { name: 'Done' }
            },
            changelog: {
                histories: [
                    {
                        created: '2023-01-03T08:00:00.000-0800',
                        items: [{ field: 'status', fromString: 'In Progress', toString: 'Done', from: '2', to: '3' }] // Done on Jan 3
                    },
                    {
                        created: '2023-01-02T08:00:00.000-0800',
                        items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress', from: '1', to: '2' }] // In Progress on Jan 2
                    }
                ]
            }
        }];

        // Range covers Jan 1 to Jan 4
        // Jan 1: Created, To Do (implied initial state before first transition? Or if no transition found before NOW, use history rollback?)
        // Logic rewinds from Current (Done).
        // Target: Jan 1 9am.
        // History: Jan 3 (Done <- In Progress). Jan 2 (In Progress <- To Do).
        // Rewind Jan 3: Current becomes In Progress.
        // Rewind Jan 2: Current becomes To Do.
        // Result Jan 1: To Do.
        
        // Target: Jan 2 9am.
        // Rewind Jan 3: Current becomes In Progress.
        // Stop.
        // Result Jan 2: In Progress.

        // Target: Jan 3 9am.
        // History Jan 3 is at 8am? No, let's say 8am. 9am is AFTER 8am.
        // So at 9am, the transition HAS happened.
        // Rewind Loop: history time (8am) is Before target (9am).
        // Stop rewinding.
        // Result Jan 3: Done.

        const data = processDailySnapshots(
            issues, 
            new Date('2023-01-01T00:00:00'), 
            new Date('2023-01-04T00:00:00'), 
            'count', 
            ['To Do', 'In Progress', 'Done']
        );

        // Monday Jan 2 (Jan 1 is Sunday, usually skipped if weekdays only? Logic says "current.day() !== 0 (Sun) && current.day() !== 6 (Sat)")
        // Jan 1 2023 is Sunday.
        // So expected data starts Jan 2.
        
        expect(data).toHaveLength(3); // Jan 2 (Mon), Jan 3 (Tue), Jan 4 (Wed)

        // Jan 2: In Progress
        expect(data[0].date).toBe('2023-01-02');
        expect(data[0]['In Progress']).toBe(1);
        expect(data[0]['Done']).toBe(0);

        // Jan 3: Done
        expect(data[1].date).toBe('2023-01-03');
        expect(data[1]['Done']).toBe(1);

        // Jan 4: Done
        expect(data[2].date).toBe('2023-01-04');
        expect(data[2]['Done']).toBe(1);
    });

    it('should span entire requested date range even if issues are empty', () => {
        const issues: Issue[] = [];
        const data = processDailySnapshots(
            issues, 
            new Date('2023-01-02T00:00:00'), // Mon
            new Date('2023-01-04T00:00:00'), // Wed
            'count', 
            ['To Do']
        );
        expect(data).toHaveLength(3);
        expect(data[0].date).toBe('2023-01-02');
        expect(data[2].date).toBe('2023-01-04');
    });

    it('should handle custom metric (Story Points) history', () => {
        const issues: Issue[] = [{
            key: 'TEST-2',
            fields: {
                created: '2023-01-01T08:00:00.000-0800',
                status: { name: 'Done' },
                customfield_10006: 5 // Current SP
            },
            changelog: {
                histories: [
                    {
                        created: '2023-01-03T10:00:00.000-0800',
                        items: [
                            { field: 'Story Points', fromString: '3', toString: '5', from: '', to: '' },
                            { field: 'status', fromString: 'In Progress', toString: 'Done', from: '', to: '' }
                        ] 
                    }
                ]
            }
        }];

        const data = processDailySnapshots(
            issues, 
            new Date('2023-01-02T00:00:00'), // Mon
            new Date('2023-01-03T00:00:00'), // Tue
            'customfield_10006', 
            ['In Progress', 'Done']
        );

        // Jan 2 9am: Before change (Jan 3). 
        // Rewind Jan 3 changes. SP becomes 3. Status becomes In Progress.
        expect(data[0].date).toBe('2023-01-02');
        expect(data[0]['In Progress']).toBe(3);

        // Jan 3 9am: Before change (Jan 3 10am).
        // Rewind Jan 3 change. SP becomes 3. Status becomes In Progress.
        expect(data[1].date).toBe('2023-01-03');
        expect(data[1]['In Progress']).toBe(3);
    });
});
