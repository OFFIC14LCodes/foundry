import {
    Lightbulb,
    ClipboardList,
    Scale,
    DollarSign,
    Rocket,
    TrendingUp,
    Target,
    CheckCircle2,
    Check,
    LibraryBig,
    Split,
    Banknote,
    FileSymlink,
    CandlestickChart,
    Users,
    Tag,
    BookOpen,
    Pencil,
    Store,
    Sprout,
    Zap,
    Building2,
    Coins,
    Wallet,
    Landmark,
    Vault,
    Turtle,
    Flame,
    ArrowRight,
} from "lucide-react";

import {
    Notebook,
    Briefcase,
    Microphone,
    List,
    ChatsCircle,
    UserSound,
} from "@phosphor-icons/react";

export const Icons = {
    stages: {
        idea: Lightbulb,
        plan: ClipboardList,
        legal: Scale,
        finance: DollarSign,
        launch: Rocket,
        grow: TrendingUp,
    },

    sidebar: {
        journal: Notebook,
        briefings: Briefcase,
        pitchPractice: UserSound,
        menu: List,
        voice: Microphone,
        export: FileSymlink,
        marketIntel: CandlestickChart,
        cofounder: Users,
    },

    hub: {
        budget: Banknote,
        decisions: Split,
        glossary: LibraryBig,
    },

    forge: {
        chat: ChatsCircle,
        goals: Target,
        complete: CheckCircle2,
        check: Check,
        advance: ArrowRight,
    },

    glossary: {
        tag: Tag,
        book: BookOpen,
    },

    onboarding: {
        justIdea: Lightbulb,
        earlyPlanning: Pencil,
        readyToLaunch: Rocket,
        alreadyRunning: Store,

        firstTime: Sprout,
        someKnowledge: BookOpen,
        someExperience: Zap,
        experienced: Building2,

        under1k: Coins,
        oneToFiveK: Wallet,
        fiveToTwentyK: DollarSign,
        twentyToHundredK: Landmark,
        hundredKPlus: Vault,

        steady: Turtle,
        balanced: Scale,
        allIn: Flame,
    },
};