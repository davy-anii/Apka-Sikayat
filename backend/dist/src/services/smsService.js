"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = sendSMS;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load env from frontend/.env for consistency if needed
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../frontend/.env') });
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID || 'APKSKT';
// Mock Flow IDs for MSG91
const FLOW_IDS = {
    SUBMITTED: process.env.MSG91_FLOW_SUBMITTED || 'flow_submitted_123',
    ASSIGNED: process.env.MSG91_FLOW_ASSIGNED || 'flow_assigned_123',
    INVESTIGATION: process.env.MSG91_FLOW_INVESTIGATION || 'flow_investigation_123',
    INSPECTION_COMPLETED: process.env.MSG91_FLOW_INSPECTION_COMPLETED || 'flow_inspection_completed_123',
    ACTION_IN_PROGRESS: process.env.MSG91_FLOW_ACTION_IN_PROGRESS || 'flow_action_123',
    RESOLVED: process.env.MSG91_FLOW_RESOLVED || 'flow_resolved_123',
    CLOSED: process.env.MSG91_FLOW_CLOSED || 'flow_closed_123',
};
async function sendSMS(status, params) {
    const { id, category, department = 'Department', phoneNumber } = params;
    let message = '';
    let flowId = '';
    switch (status) {
        case 'Submitted':
            message = `Your grievance has been successfully submitted.\nComplaint ID: ${id}\nCategory: ${category}\nTrack status in the Citizen Portal.`;
            flowId = FLOW_IDS.SUBMITTED;
            break;
        case 'Assigned_Dept':
            message = `Your grievance ${id} has been assigned to ${department}.`;
            flowId = FLOW_IDS.ASSIGNED;
            break;
        case 'Investigation_Started':
            message = `Investigation has started for grievance ${id}.`;
            flowId = FLOW_IDS.INVESTIGATION;
            break;
        case 'Inspection_Completed':
            message = `Field inspection has been completed for grievance ${id}.`;
            flowId = FLOW_IDS.INSPECTION_COMPLETED;
            break;
        case 'Action_In_Progress':
            message = `Work has started on grievance ${id}.`;
            flowId = FLOW_IDS.ACTION_IN_PROGRESS;
            break;
        case 'Resolved':
            message = `Your grievance ${id} has been marked as resolved.`;
            flowId = FLOW_IDS.RESOLVED;
            break;
        case 'Closed':
            message = `Your grievance ${id} has been successfully closed.`;
            flowId = FLOW_IDS.CLOSED;
            break;
        default:
            // Other stages do not require SMS
            return false;
    }
    console.log(`[SMS Queue Worker] Preparing to send SMS to ${phoneNumber} (Status: ${status})`);
    console.log(`[SMS Content]: "${message}"`);
    if (!MSG91_AUTH_KEY) {
        console.log(`[SMS Simulator] [SUCCESS] Simulated SMS delivered to ${phoneNumber} in 1.2s.`);
        return true;
    }
    try {
        // Call MSG91 Flow API
        const response = await fetch('https://api.msg91.com/api/v5/flow/', {
            method: 'POST',
            headers: {
                'authkey': MSG91_AUTH_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                flow_id: flowId,
                sender: MSG91_SENDER_ID,
                recipients: [
                    {
                        mobiles: phoneNumber.replace('+', ''), // MSG91 expects number without plus sign
                        id: id,
                        category: category,
                        department: department,
                    }
                ]
            })
        });
        const data = await response.json();
        if (response.ok && data.type === 'success') {
            console.log(`[SMS Service] MSG91 SMS sent successfully to ${phoneNumber}`);
            return true;
        }
        else {
            console.error(`[SMS Service] MSG91 API error:`, data);
            return false;
        }
    }
    catch (error) {
        console.error(`[SMS Service] Network error sending MSG91 SMS:`, error);
        return false;
    }
}
