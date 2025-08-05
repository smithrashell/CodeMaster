import { initializePatternLaddersForOnboarding } from "./problemladderService.js";
import { buildTagRelationships } from "../db/tag_relationships.js";
import { insertStandardProblems } from "../db/standard_problems.js"; // assuming this is where seeding is
import { buildProblemRelationships } from "../services/relationshipService.js";

import { getAllFromStore } from "../db/common.js";
export async function onboardUserIfNeeded() {
  console.log("... onboarding started");

  const [
    problemRelationships,
    standardProblems,
    userProblems,
    tagMastery,
    tagRelationships,
  ] = await Promise.all([
    getAllFromStore("problem_relationships"),
    getAllFromStore("standard_problems"),
    getAllFromStore("problems"),
    getAllFromStore("tag_mastery"),
    getAllFromStore("tag_relationships"),
  ]);

  const isMissingStandardData =
    standardProblems.length === 0 ||
    tagRelationships.length === 0 ||
    problemRelationships.length === 0;
  const isMissingUserData =
    userProblems.length === 0 || tagMastery.length === 0;

  if (!isMissingStandardData && !isMissingUserData) {
    console.log("✅ Onboarding skipped — all data present.");
    return;
  }

  if (isMissingStandardData) {
    await seedStandardData();
  }

  if (isMissingUserData) {
    await seedUserData();
  }

  console.log("... onboarding completed");
}

async function seedStandardData() {
  console.log("📦 Seeding standard problems and tag relationships...");
  await seedStandardProblems();
  await seedTagRelationships();
  await seedProblemRelationships();
}

async function seedUserData() {
  console.log("🆕 Initializing user mastery data...");
  await initializePatternLaddersForOnboarding();
}

async function seedStandardProblems() {
  console.log("📦 Inserting standard problems...");
  await insertStandardProblems();
}

async function seedTagRelationships() {
  console.log("🔗 Building tag relationships...");
  await buildTagRelationships();
}

async function seedProblemRelationships() {
  console.log("🔁 Building problem relationships...");
  await buildProblemRelationships();
}
