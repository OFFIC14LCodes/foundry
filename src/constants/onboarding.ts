import { Icons } from "../icons";

export const ONBOARDING_STEPS = [
    { id: "name", cards: false },
    { id: "stage_assessment", cards: true },
    { id: "idea", cards: false },
    { id: "experience", cards: true },
    { id: "budget", cards: true },
    { id: "strategy", cards: true },
    { id: "complete", cards: false },
] as const;

export const STAGE_ASSESSMENT_CARDS = [
    {
        id: "stage_1",
        icon: Icons.onboarding.justIdea,
        label: "Just an idea",
        sub: "I have a concept but haven't validated it with real people yet",
        stage: 1,
    },
    {
        id: "stage_2",
        icon: Icons.stages.plan,
        label: "Validated, building the plan",
        sub: "I've talked to potential customers and I'm working out the business model",
        stage: 2,
    },
    {
        id: "stage_3",
        icon: Icons.stages.legal,
        label: "Planning, need to get legal",
        sub: "I have a solid plan and need to get the business formally set up",
        stage: 3,
    },
    {
        id: "stage_4",
        icon: Icons.stages.finance,
        label: "Set up, working on finances",
        sub: "The business is formed — now I'm building the financial foundation",
        stage: 4,
    },
    {
        id: "stage_5",
        icon: Icons.onboarding.readyToLaunch,
        label: "Ready to launch or just launched",
        sub: "I'm focused on getting the first paying customers",
        stage: 5,
    },
    {
        id: "stage_6",
        icon: Icons.onboarding.alreadyRunning,
        label: "Already have customers — ready to scale",
        sub: "Revenue is coming in and I need to build systems to grow",
        stage: 6,
    },
] as const;

export const EXPERIENCE_CARDS = [
    {
        id: "first",
        icon: Icons.onboarding.firstTime,
        label: "First time",
        sub: "I've never run a business before",
    },
    {
        id: "some_knowledge",
        icon: Icons.onboarding.someKnowledge,
        label: "Some knowledge",
        sub: "I've studied it but haven't done it",
    },
    {
        id: "some_experience",
        icon: Icons.onboarding.someExperience,
        label: "Some experience",
        sub: "I've tried before or run something small",
    },
    {
        id: "experienced",
        icon: Icons.onboarding.experienced,
        label: "Experienced",
        sub: "I've built and run businesses before",
    },
] as const;

export const BUDGET_CARDS = [
    {
        id: "under_1k",
        icon: Icons.onboarding.under1k,
        label: "Under $1,000",
        sub: "Bootstrapping from scratch",
        amount: 800,
    },
    {
        id: "1k_5k",
        icon: Icons.onboarding.oneToFiveK,
        label: "$1,000 – $5,000",
        sub: "Limited but workable",
        amount: 3000,
    },
    {
        id: "5k_20k",
        icon: Icons.onboarding.fiveToTwentyK,
        label: "$5,000 – $20,000",
        sub: "Solid foundation to work with",
        amount: 12000,
    },
    {
        id: "20k_100k",
        icon: Icons.onboarding.twentyToHundredK,
        label: "$20,000 – $100,000",
        sub: "Meaningful capital available",
        amount: 50000,
    },
    {
        id: "100k_plus",
        icon: Icons.onboarding.hundredKPlus,
        label: "$100,000+",
        sub: "Ready to move seriously",
        amount: 100000,
    },
] as const;

export const STRATEGY_CARDS = [
    {
        id: "steady",
        icon: Icons.onboarding.steady,
        label: "Steady",
        desc: "Validate before you spend. Earn before you invest. Build something sustainable that doesn't keep you up at night. Every step is proven before the next one begins.",
    },
    {
        id: "balanced",
        icon: Icons.onboarding.balanced,
        label: "Balanced",
        desc: "Smart risks. Reasonable investment. Real momentum without recklessness. The path most successful founders actually walked.",
    },
    {
        id: "all_in",
        icon: Icons.onboarding.allIn,
        label: "All In",
        desc: "Move fast. Build bold. Invest aggressively in growth. You're not here to play it safe — you're here to build something significant.",
    },
] as const;