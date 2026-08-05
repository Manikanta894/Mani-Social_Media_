// ============================================================================
// Discord Command Center — Public API
// Unified entry point for the AI Operations Center.
// ============================================================================

export { setupServer, getChannelId, sendToChannel, ensureServer } from './channels'
export { updateDashboard, buildDashboardData, logToChannel, logAutomation, logError } from './dashboard'
export { sendNewsOpportunity, buildNewsRadarEmbed, buildNewsRadarButtons, renderGenerationProgress } from './news-radar'
export { sendDraftToApproval, buildContentPreviewEmbed, buildApprovalButtons, sendPublishResult, sendLinkedInOpportunity } from './approval'
export { sendAnalytics, sendSchedule, sendHealth } from './analytics'
export { handleInteraction, SLASH_COMMANDS } from './handler'
export { registerCommands } from './client'
export { notifyNewsOpportunity, notifyDraft, notifyPublishResult, notifyLinkedInOpportunity, notifyEvent, notifyError, notifyDailyReport, notifyApprovalReminder, notifyCircuitBreaker } from './notify'
