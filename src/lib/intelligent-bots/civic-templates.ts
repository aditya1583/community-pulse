/**
 * Civic Templates - Morning Brew Style Civic Announcements
 *
 * Transforms dry civic meeting data into digestible, witty content.
 * School board decisions shouldn't feel like homework.
 *
 * Philosophy: People care about what affects them, they just don't know
 * how to parse 47-page agendas. We do the parsing, add the context,
 * and sprinkle in enough personality to make them actually read it.
 *
 * Voice: Informed friend who went to the meeting so you didn't have to.
 * Not snarky, not preachy - just genuinely helpful with a dash of wit.
 */

import type {
  CivicMeeting,
  CivicDecision,
  CivicTopic,
  CivicDecisionOutcome,
  GeneratedPost,
  PredictionMetadata,
} from "./types";

// ============================================================================
// CONSTANTS
// ============================================================================

/** XP reward for civic predictions (higher than standard 25 XP) */
export const CIVIC_PREDICTION_XP = 50;

/** Entity display names and emojis */
const ENTITY_CONFIG: Record<string, { emoji: string; shortName: string }> = {
  'school_district': { emoji: '🏫', shortName: 'School Board' },
  'city_council': { emoji: '🏛️', shortName: 'City Council' },
  'committee': { emoji: '📋', shortName: 'Committee' },
  'county': { emoji: '🗺️', shortName: 'County' },
  'utility': { emoji: '💡', shortName: 'Utility Board' },
};

/** Decision outcome emojis */
const DECISION_EMOJI: Record<CivicDecisionOutcome, string> = {
  approved: '✅',
  denied: '❌',
  tabled: '📝',
  amended: '✏️',
  withdrawn: '🚫',
  no_action: '⏸️',
};

/** Decision outcome verbs (past tense for summaries) */
const DECISION_VERBS: Record<CivicDecisionOutcome, string> = {
  approved: 'passed',
  denied: 'rejected',
  tabled: 'tabled until next meeting',
  amended: 'passed with amendments',
  withdrawn: 'withdrawn by sponsor',
  no_action: 'no action taken',
};

// ============================================================================
// PRE-MEETING ALERT TEMPLATES
// ============================================================================

/**
 * Pre-meeting alert headers based on stakes and entity type
 */
const PRE_MEETING_HEADERS = {
  school_district: {
    high: [
      "🏫 {entity} Tonight: The Big One",
      "🔥 {entity} Meeting Alert: This Matters",
      "🏫 School Board Showdown Tonight",
      "⚡ {entity}: Decision Time",
    ],
    medium: [
      "🏫 {entity} Tonight @ {time}",
      "📚 School Board Meeting: What's on Deck",
      "🏫 {entity} Agenda: Here's What's Up",
    ],
    low: [
      "🏫 {entity} Meeting Tonight",
      "📋 Quick {entity} Update",
    ],
  },
  city_council: {
    high: [
      "🏛️ City Council Tonight: Major Vote",
      "🔥 {city} Council: This One's Spicy",
      "🏛️ Big Decision Night at Council",
      "⚡ {city} City Council: Stakes Are High",
    ],
    medium: [
      "🏛️ {city} City Council Tonight",
      "🏛️ Council Meeting: The Rundown",
      "📋 What's Up at City Council",
    ],
    low: [
      "🏛️ Council Meeting Tonight",
      "📋 Quick Council Update",
    ],
  },
  default: {
    high: [
      "⚡ {entity} Meeting Tonight: Big Votes Ahead",
      "🔥 {entity}: This One Matters",
    ],
    medium: [
      "📋 {entity} Meeting Tonight",
      "📍 {entity} Update",
    ],
    low: [
      "📋 {entity} Meeting",
    ],
  },
};

/**
 * Topic formatting based on stakes
 */
function formatTopic(topic: CivicTopic, _index: number): string {
  const bullet = topic.stakes === 'high' ? '🔥' : '•';
  const emphasis = topic.stakes === 'high' ? ' (big one)' : '';
  return `${bullet} ${topic.title}${emphasis}`;
}

/**
 * Format the "vibe check" section based on topics
 */
function getVibeCheck(meeting: CivicMeeting): string | null {
  const highStakes = meeting.topics.filter(t => t.stakes === 'high').length;

  if (highStakes >= 2) {
    return "The vibe: Tense. Multiple high-stakes votes tonight.";
  } else if (highStakes === 1) {
    return "The vibe: One big decision could change things.";
  } else if (meeting.meetingType === 'budget') {
    return "The vibe: It's budget season. Prepare for numbers.";
  } else if (meeting.meetingType === 'workshop') {
    return "The vibe: Discussion only, no votes tonight.";
  }
  return null;
}

/**
 * Format meeting time for display
 */
function formatMeetingTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago',
  });
}

/**
 * Check if meeting is today
 */
function isToday(date: Date): boolean {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

/**
 * Check if meeting is tomorrow
 */
function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
}

// ============================================================================
// MAIN GENERATORS
// ============================================================================

/**
 * Generate a pre-meeting alert post
 *
 * Example output:
 * "🏫 LISD Board Meeting Tonight @ 7 PM
 *
 * The Main Event:
 * 🔥 Budget vote - where's the $13M coming from? (big one)
 * • Faubion Elementary's fate (consolidation on the table)
 * • New superintendent contract
 *
 * The vibe: Tense. Parents are mobilizing.
 *
 * [Watch Live] [Full Agenda]"
 */
export function generatePreMeetingAlert(meeting: CivicMeeting): GeneratedPost {
  const entityConfig = ENTITY_CONFIG[meeting.entityType] || ENTITY_CONFIG.committee;
  const highestStakes = meeting.topics.reduce(
    (max, t) => t.stakes === 'high' ? 'high' : (t.stakes === 'medium' && max !== 'high' ? 'medium' : max),
    'low' as 'high' | 'medium' | 'low'
  );

  // Select header template
  const headerTemplates = PRE_MEETING_HEADERS[meeting.entityType as keyof typeof PRE_MEETING_HEADERS]
    || PRE_MEETING_HEADERS.default;
  const templates = headerTemplates[highestStakes] || headerTemplates.medium;
  const headerTemplate = templates[Math.floor(Math.random() * templates.length)];

  // Build header
  const time = formatMeetingTime(meeting.meetingDate);
  let header = headerTemplate
    .replace('{entity}', meeting.entity)
    .replace('{city}', meeting.city)
    .replace('{time}', time);

  // Add time if not already in header
  if (!header.includes(time) && !header.includes('Tonight') && !header.includes('Tomorrow')) {
    header += ` @ ${time}`;
  }

  // Build topics section
  const topicsHeader = highestStakes === 'high' ? "The Main Event:" :
    meeting.topics.length > 3 ? "On the Agenda:" : "What's Up:";

  const topicsFormatted = meeting.topics
    .slice(0, 5) // Max 5 topics
    .map((t, i) => formatTopic(t, i))
    .join('\n');

  // Build vibe check
  const vibeCheck = getVibeCheck(meeting);

  // Build links section
  const links: string[] = [];
  if (meeting.livestreamUrl) links.push('[Watch Live]');
  if (meeting.agendaUrl) links.push('[Full Agenda]');
  const linksSection = links.length > 0 ? `\n\n${links.join(' ')}` : '';

  // Assemble message
  let message = `${header}\n\n${topicsHeader}\n${topicsFormatted}`;
  if (vibeCheck) message += `\n\n${vibeCheck}`;
  message += linksSection;

  return {
    message,
    tag: 'General',
    mood: highestStakes === 'high' ? '🔥' : '📋',
    author: `${meeting.city} civic_pulse_bot ${entityConfig.emoji}`,
    is_bot: true,
    hidden: false,
  };
}

/**
 * Generate a post-meeting summary
 *
 * Example output:
 * "📋 LISD Recap: Here's What Happened
 *
 * ✅ Budget passed (4-3) - property taxes holding steady
 * ❌ Faubion stays open (for now) - tabled until March
 * ✏️ Superintendent gets 3-year extension (with amendments)
 *
 * The drama: Trustee Martinez walked out during the vote.
 *
 * What it means for you: [impact summary if available]"
 */
export function generatePostMeetingSummary(
  meeting: CivicMeeting,
  decisions: CivicDecision[]
): GeneratedPost {
  const entityConfig = ENTITY_CONFIG[meeting.entityType] || ENTITY_CONFIG.committee;

  // Header
  const headers = [
    `📋 ${meeting.entity} Recap: Here's What Happened`,
    `📋 What Happened at ${meeting.entity}`,
    `📋 ${meeting.entity} Meeting: The Rundown`,
    `${entityConfig.emoji} ${meeting.entity} Results Are In`,
  ];
  const header = headers[Math.floor(Math.random() * headers.length)];

  // Format each decision
  const decisionLines = decisions.map(d => {
    const emoji = DECISION_EMOJI[d.decision];
    const verb = DECISION_VERBS[d.decision];

    // Include vote count if available
    let voteInfo = '';
    if (d.voteFor !== undefined && d.voteAgainst !== undefined) {
      voteInfo = ` (${d.voteFor}-${d.voteAgainst})`;
    }

    // Include summary if available
    const summary = d.summary ? ` - ${d.summary}` : '';

    return `${emoji} ${d.topicTitle} ${verb}${voteInfo}${summary}`;
  });

  // Find notable moments (the drama section)
  const notableMoments = decisions
    .filter(d => d.notableMoment)
    .map(d => d.notableMoment);

  // Find impact summaries
  const impacts = decisions
    .filter(d => d.impactSummary)
    .map(d => d.impactSummary);

  // Assemble message
  let message = `${header}\n\n${decisionLines.join('\n')}`;

  if (notableMoments.length > 0) {
    message += `\n\nThe drama: ${notableMoments[0]}`;
  }

  if (impacts.length > 0) {
    message += `\n\nWhat it means for you: ${impacts[0]}`;
  }

  return {
    message,
    tag: 'General',
    mood: '📋',
    author: `${meeting.city} civic_recap_bot ${entityConfig.emoji}`,
    is_bot: true,
    hidden: false,
  };
}

/**
 * Generate a civic prediction post for a high-stakes topic
 *
 * Example output:
 * "🔮 Civic Prediction: Will the bond proposal pass?
 *
 * LISD's $120M bond is up for a vote tonight. The school board has been
 * split on this one.
 *
 * What's your read?
 * [Passes] [Gets Tabled]
 *
 * Correct predictors earn 50 XP! Resolution after tonight's meeting."
 */
export function generateCivicPrediction(
  meeting: CivicMeeting,
  topic: CivicTopic
): GeneratedPost {
  const entityConfig = ENTITY_CONFIG[meeting.entityType] || ENTITY_CONFIG.committee;

  // Prediction headers based on topic stakes
  const headers = topic.stakes === 'high' ? [
    `🔮 Civic Prediction: ${topic.title}`,
    `🔮 Make Your Call: ${topic.title}`,
    `🎯 Predict the Outcome: ${topic.title}`,
    `⚡ High-Stakes Vote: ${topic.title}`,
  ] : [
    `🔮 Quick Prediction: ${topic.title}`,
    `🎯 What's Your Read: ${topic.title}`,
  ];
  const header = headers[Math.floor(Math.random() * headers.length)];

  // Context about the vote
  const context = topic.summary
    ? `${topic.summary}\n\n`
    : `${meeting.entity} is voting on this tonight.\n\n`;

  // Determine options based on meeting type
  let optionA = 'Passes';
  let optionB = 'Gets Tabled';

  if (meeting.meetingType === 'budget') {
    optionA = 'Approved as-is';
    optionB = 'Sent back for changes';
  } else if (topic.title.toLowerCase().includes('rezoning') ||
             topic.title.toLowerCase().includes('variance')) {
    optionA = 'Approved';
    optionB = 'Denied';
  }

  // Footer with XP info
  const footer = `\nCorrect predictors earn ${CIVIC_PREDICTION_XP} XP! Resolution after tonight's meeting.`;

  // Assemble message
  const message = `${header}\n\n${context}What's your read?\n\n${footer}`;

  // Build prediction metadata
  const resolvesAt = new Date(meeting.meetingDate);
  resolvesAt.setHours(23, 59, 59); // Resolve at end of meeting day

  const prediction: PredictionMetadata = {
    resolvesAt,
    xpReward: CIVIC_PREDICTION_XP,
    category: 'civic',
    dataSource: 'civic_api',
    resolutionKey: `civic_${meeting.id}_${topic.title.toLowerCase().replace(/\s+/g, '_')}`,
  };

  return {
    message,
    tag: 'General',
    mood: '🔮',
    author: `${meeting.city} civic_oracle_bot ${entityConfig.emoji}`,
    is_bot: true,
    hidden: false,
    options: [optionA, optionB],
    prediction,
  };
}

// ============================================================================
// QUICK ALERT GENERATORS
// ============================================================================

/**
 * Generate a quick "meeting starting" alert
 */
export function generateMeetingStartingAlert(meeting: CivicMeeting): GeneratedPost {
  const entityConfig = ENTITY_CONFIG[meeting.entityType] || ENTITY_CONFIG.committee;
  const highStakesCount = meeting.topics.filter(t => t.stakes === 'high').length;

  const templates = highStakesCount > 0 ? [
    `🔴 LIVE NOW: ${meeting.entity} meeting starting. ${highStakesCount} big vote${highStakesCount > 1 ? 's' : ''} tonight.`,
    `⚡ ${meeting.entity} is LIVE. Here we go...`,
    `🎬 And we're live. ${meeting.entity} meeting starting now.`,
  ] : [
    `🔴 ${meeting.entity} meeting starting now.`,
    `📺 ${meeting.entity} is live if you want to tune in.`,
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];

  let message = template;
  if (meeting.livestreamUrl) {
    message += '\n\n[Watch Live]';
  }

  return {
    message,
    tag: 'General',
    mood: '🔴',
    author: `${meeting.city} civic_live_bot ${entityConfig.emoji}`,
    is_bot: true,
    hidden: false,
  };
}

/**
 * Generate a "big decision just happened" flash alert
 */
export function generateDecisionFlashAlert(
  meeting: CivicMeeting,
  decision: CivicDecision
): GeneratedPost {
  const entityConfig = ENTITY_CONFIG[meeting.entityType] || ENTITY_CONFIG.committee;
  const emoji = DECISION_EMOJI[decision.decision];
  const verb = DECISION_VERBS[decision.decision];

  let voteInfo = '';
  if (decision.voteFor !== undefined && decision.voteAgainst !== undefined) {
    voteInfo = ` (${decision.voteFor}-${decision.voteAgainst})`;
  }

  const templates = [
    `${emoji} JUST IN: ${decision.topicTitle} ${verb}${voteInfo}`,
    `⚡ Breaking: ${decision.topicTitle} - ${verb}${voteInfo}`,
    `📢 ${meeting.entity} just voted: ${decision.topicTitle} ${verb}${voteInfo}`,
  ];

  let message = templates[Math.floor(Math.random() * templates.length)];

  if (decision.summary) {
    message += `\n\n${decision.summary}`;
  }

  if (decision.notableMoment) {
    message += `\n\n${decision.notableMoment}`;
  }

  return {
    message,
    tag: 'General',
    mood: emoji,
    author: `${meeting.city} civic_breaking_bot ${entityConfig.emoji}`,
    is_bot: true,
    hidden: false,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a meeting should trigger a pre-meeting alert
 * (Same day, meeting hasn't started yet)
 */
export function shouldGeneratePreMeetingAlert(meeting: CivicMeeting): boolean {
  const now = new Date();
  const meetingDate = new Date(meeting.meetingDate);

  // Same day check
  if (meetingDate.toDateString() !== now.toDateString()) {
    return false;
  }

  // Meeting hasn't started yet
  return meetingDate > now;
}

/**
 * Check if a topic is high-stakes enough for a prediction
 */
export function isHighStakesTopic(topic: CivicTopic): boolean {
  return topic.stakes === 'high';
}

/**
 * Get all prediction-worthy topics from a meeting
 */
export function getPredictionWorthyTopics(meeting: CivicMeeting): CivicTopic[] {
  return meeting.topics.filter(t => t.stakes === 'high');
}

/**
 * Format entity name for display
 */
export function formatEntityName(entityType: string, entity: string): string {
  const config = ENTITY_CONFIG[entityType];
  return config ? `${config.emoji} ${entity}` : entity;
}

// ============================================================================
// BOT PERSONAS FOR CIVIC CONTENT
// ============================================================================

export const CIVIC_BOT_PERSONAS = {
  alert: { name: 'civic_pulse_bot', emoji: '🏛️' },
  recap: { name: 'civic_recap_bot', emoji: '📋' },
  prediction: { name: 'civic_oracle_bot', emoji: '🔮' },
  live: { name: 'civic_live_bot', emoji: '🔴' },
  breaking: { name: 'civic_breaking_bot', emoji: '⚡' },
};
