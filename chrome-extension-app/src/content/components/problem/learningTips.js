/**
 * Learning tips utilities
 * Extracted from WhyThisProblem to reduce file size
 */

/**
 * Get learning tip based on reason type
 */
export function getLearningTip(reasonType) {
  switch (reasonType) {
    case "tag_weakness":
      return "Focus on understanding the core concepts and patterns. Take your time to analyze the approach before coding.";
    case "spaced_repetition":
      return "Try to solve this from memory first. If stuck, review your previous approach and identify what you forgot.";
    case "new_tag_introduction":
      return "Take time to understand the new algorithmic concept. Look for patterns you can apply to similar problems.";
    case "difficulty_progression":
      return "This matches your current skill level. Use it to build confidence before tackling harder problems.";
    case "performance_recovery":
      return "Break down the problem step by step. Identify where you struggled before and plan your approach carefully.";
    case "pattern_reinforcement":
      return "Notice how this problem follows patterns you've succeeded with. Reinforce your understanding of these techniques.";
    case "review_problem":
      return "Test your retention. Try to recall your previous solution approach before looking at hints or your past code.";
    case "new_problem":
      return "Approach this systematically. Identify the problem type and apply relevant algorithmic patterns you've learned.";
    case "general":
    default:
      return "Take a structured approach: understand the problem, identify patterns, plan your solution, then implement.";
  }
}

export default getLearningTip;