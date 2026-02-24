import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const PT_TIMEZONE = "America/Los_Angeles";

export interface Issue {
    key: string;
    fields: {
        created: string;
        status: { name: string };
        [key: string]: any;
    };
    changelog?: {
        histories: {
            created: string;
            items: {
                field: string;
                fromString: string;
                toString: string;
                from: string;
                to: string;
            }[];
        }[];
    };
}

export function extractAllStatuses(issues: Issue[]): string[] {
    const statuses = new Set<string>();
    issues.forEach(issue => {
        // Current status
        if (issue.fields.status) {
            statuses.add(issue.fields.status.name);
        }
        // Historical statuses
        if (issue.changelog) {
            issue.changelog.histories.forEach(history => {
                history.items.forEach(item => {
                    if (item.field === 'status') {
                        statuses.add(item.fromString);
                        statuses.add(item.toString);
                    }
                });
            });
        }
    });
    return Array.from(statuses).sort();
}

function convertFieldIdToName(fieldKey: string): string {
    if (fieldKey === 'customfield_10006') return 'Story Points';
    return fieldKey;
}

/**
 * Reconstructs the value of a field at a specific point in time using history.
 */
function getFieldValueAtTime(issue: Issue, fieldKey: string, targetTime: dayjs.Dayjs): any {
    const created = dayjs(issue.fields.created);
    if (targetTime.isBefore(created)) {
        return null; // Issue didn't exist yet
    }

    if (fieldKey === 'count') {
        return 1;
    }

    let currentValue: any = null;
    
    if (fieldKey === 'status') {
        currentValue = issue.fields.status?.name;
    } else {
        currentValue = issue.fields[fieldKey];
    }

    // Prepare history
    const histories = issue.changelog?.histories || [];
    if (histories.length === 0) {
        return currentValue;
    }

    // Sort histories in descending order (newest first) to rewind
    const sortedHistory = [...histories].sort((a, b) => 
        new Date(b.created).getTime() - new Date(a.created).getTime()
    );

    for (const history of sortedHistory) {
        const historyTime = dayjs(history.created);
        
        // If this change happened AFTER the target time, we need to undo it
        if (historyTime.isAfter(targetTime)) {
            // Find if our field was changed in this history item
            const changeItem = history.items.find(item => {
                if (fieldKey === 'status') return item.field === 'status';
                // Jira field matching logic
                return item.field === fieldKey || item.field === convertFieldIdToName(fieldKey); 
            });

            if (changeItem) {
                // Revert to 'fromString'
                if (fieldKey === 'status') {
                    currentValue = changeItem.fromString;
                } else {
                    currentValue = changeItem.fromString; // Keeping as string for now, will parse later
                }
            }
        } else {
            // This change is now in the past relative to targetTime, so we stop rewinding.
            break; 
        }
    }

    return currentValue;
}

export function processDailySnapshots(
    issues: Issue[], 
    startDate: Date, 
    endDate: Date, 
    metricField: string, 
    statuses: string[] // List of statuses to track
): any[] {
    const data = [];
    let current = dayjs(startDate).tz(PT_TIMEZONE).startOf('day').add(9, 'hour'); // 9am PT
    const end = dayjs(endDate).tz(PT_TIMEZONE).endOf('day');
    const now = dayjs().tz(PT_TIMEZONE);

    while (current.isBefore(end) || current.isSame(end, 'day')) {
        // Skip weekends? "The x-axis quantization is one day, and only shows weekdays."
        if (current.day() !== 0 && current.day() !== 6) {
            
            const snapshot: any = {
                date: current.format('YYYY-MM-DD'),
            };

            // If we are in the future, we still push the date object (so axis draws), 
            // but we don't calculate values (so no bars draw).
            if (!current.isAfter(now)) {
                // Initialize all statuses to 0
                statuses.forEach(s => snapshot[s] = 0);

                // Tally up issues
                issues.forEach(issue => {
                    const statusAtTime = getFieldValueAtTime(issue, 'status', current);
                    let metricAtTime = getFieldValueAtTime(issue, metricField, current);
                    
                    if (!statusAtTime) return;

                    let val = 0;
                    if (metricField === 'count') {
                        val = 1;
                    } else {
                        if (metricAtTime === null || metricAtTime === undefined) metricAtTime = 0;
                        val = parseFloat(metricAtTime);
                        if (isNaN(val)) val = 0;
                    }

                    if (snapshot[statusAtTime] !== undefined) {
                        snapshot[statusAtTime] += val;
                    } else {
                        // For now, if it's not in our list, we add it to the snapshot anyway so it doesn't disappear
                        snapshot[statusAtTime] = (snapshot[statusAtTime] || 0) + val;
                    }
                });

                // Round values
                for (const key in snapshot) {
                    if (typeof snapshot[key] === 'number') {
                        snapshot[key] = Math.round(snapshot[key] * 100) / 100;
                    }
                }
            } else {
                 // Future: explicit nulls or just don't set keys? 
                 // If we don't set keys, Recharts treats as missing data (good).
            }

            data.push(snapshot);
        }
        current = current.add(1, 'day');
    }

    return data;
}
