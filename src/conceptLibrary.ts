// ─────────────────────────────────────────────────────────────
// CONCEPT LIBRARY
// ─────────────────────────────────────────────────────────────
// Each entry is a named business concept with deep educational content.
// To add a new concept: add an entry to CONCEPT_LIBRARY. No other changes needed.

export interface ConceptEntry {
    name: string;
    stage: number;
    whatItIs: string;
    thePrinciple: string;
    inPractice: string;
    withoutIt: string;
    theMistake: string;
    sitWithThis: string;
    related: string[];
}

export const CONCEPT_LIBRARY: Record<string, ConceptEntry> = {

    // ─── STAGE 1 ─────────────────────────────────────────────

    "product-market fit": {
        name: "product-market fit",
        stage: 1,
        whatItIs: "The degree to which your product satisfies a strong market demand. Not a milestone you hit — a signal the market sends you. Users pulling the product out of your hands, retention curves flattening at a high level, word of mouth happening without you manufacturing it.",
        thePrinciple: "Most products fail not because they were badly built but because they were built for a problem that wasn't painful enough, or for customers who weren't the right ones, or at a price point that didn't match the perceived value. Product-market fit is the alignment of all three. When it exists the business feels like it's being pulled forward. When it doesn't every step feels like pushing uphill.",
        inPractice: "You know you have it when you can barely keep up with demand without trying very hard to create it. When customers are angry at the idea of losing the product. When your retention numbers show people forming a habit around it. Slack knew they had it when beta users were begging to pay before a pricing model even existed.",
        withoutIt: "Growth tactics don't work. Marketing can't fix a product that doesn't fit its market. Paid acquisition loses money at scale. The business requires constant energy to keep moving because nothing is pulling it forward on its own. Most startup failures happen here — not from bad execution but from scaling before fit exists.",
        theMistake: "Confusing usage with fit. People using your free product does not mean they have product-market fit. The test is whether they would be genuinely disappointed — not just inconvenienced — if it disappeared. Disappoint is the word. Not annoyed. Not inconvenienced. Disappointed.",
        sitWithThis: "If you shut down tomorrow with no warning, which specific customers would be angry enough to tell other people — and why exactly would they be angry?",
        related: ["willingness to pay", "customer discovery", "problem-solution fit"],
    },

    "willingness to pay": {
        name: "willingness to pay",
        stage: 1,
        whatItIs: "Whether a specific person will actually hand over money for your solution — not whether they say they would, but whether they do. The most important single signal in early validation and the one most founders avoid testing directly.",
        thePrinciple: "Human beings are extraordinarily optimistic about their future behavior when asked hypothetically. \"Would you pay for this?\" produces almost universally positive answers from people who want to be encouraging and avoid awkward conversations. Actual payment behavior is completely different. The gap between stated willingness and actual willingness to pay is where most business ideas go to die.",
        inPractice: "The only real test is a real transaction or a real commitment of money. A pre-order. A deposit. A signed letter of intent with a price attached. Someone pulling out their credit card or their checkbook. Everything short of that is hypothesis — useful for direction, dangerous if treated as confirmation.",
        withoutIt: "You build a product for an audience that turns out to be enthusiastic in conversation and completely absent at checkout. The validation process feels successful — people liked the idea, they said they'd use it, some even signed up for the waitlist — and then launch day arrives and the conversion numbers are brutal.",
        theMistake: "Treating positive feedback as validation. Someone saying \"I love this idea\" or \"I would definitely use that\" is not signal. It is politeness. The Mom Test by Rob Fitzpatrick was written specifically because this mistake is so universal and so costly. Ask about their life, their current behavior, their existing spending. Never ask if they like your idea.",
        sitWithThis: "What is the earliest moment in your current plan where a customer gives you real money — and what would it take to move that moment to this week?",
        related: ["product-market fit", "customer discovery", "grand slam offer"],
    },

    "customer discovery": {
        name: "customer discovery",
        stage: 1,
        whatItIs: "The systematic process of learning directly from potential customers whether a problem is real, how painful it is, and whether your proposed solution addresses what they actually need — before you build anything significant.",
        thePrinciple: "Every business starts as a set of assumptions about who has a problem, how much it costs them, and what would solve it. Customer discovery is the process of testing those assumptions against reality as cheaply and quickly as possible. The goal is not to sell. The goal is to learn. Those are completely different conversations and confusing them produces useless data.",
        inPractice: "Real customer discovery looks like conversations where you spend most of the time listening. You ask about past behavior not future intentions. You ask what they currently do to solve the problem — what they're already spending time and money on. You look for the emotional signal — the thing they say with a slightly different energy that tells you this problem actually costs them something.",
        withoutIt: "You build based on your own assumptions about what customers need. Those assumptions are almost always partially wrong in ways that matter. The founders who skip discovery and build first almost always end up rebuilding — sometimes the product, sometimes the business model, sometimes both.",
        theMistake: "Turning discovery conversations into pitch conversations. The moment you start explaining your solution you have stopped learning and started selling. And the moment you start selling, your customer stops telling you the truth because they don't want to disappoint you. Keep the solution out of the conversation for as long as possible.",
        sitWithThis: "In your last customer conversation, what percentage of the time were you talking versus listening — and what did the listening reveal that the talking didn't?",
        related: ["willingness to pay", "problem-solution fit", "jobs to be done"],
    },

    "problem-solution fit": {
        name: "problem-solution fit",
        stage: 1,
        whatItIs: "The confirmation that a specific problem is real and painful enough that people are actively looking for a solution — and that your proposed solution addresses that problem in a way that resonates with the people who have it.",
        thePrinciple: "Problem-solution fit comes before product-market fit. It is the earlier and often skipped validation step. You need to know that the problem is real and that your solution concept addresses it before you invest in building. Many founders skip directly to building and testing product-market fit without ever properly confirming they understand the problem they're solving.",
        inPractice: "You have problem-solution fit when the people who have the problem respond to your solution concept with recognition and interest rather than confusion or polite curiosity. When they say \"yes, that is exactly the problem\" and \"yes, that approach makes sense.\" Not enthusiasm — recognition. Enthusiasm can be manufactured. Recognition cannot.",
        withoutIt: "You build a solution to a problem that either doesn't exist as you imagine it, isn't painful enough to warrant a paid solution, or is already adequately solved by something the customer already uses. All three lead to the same place — a product nobody pays for.",
        theMistake: "Validating the solution before deeply understanding the problem. Founders who fall in love with their solution before confirming the problem often unconsciously lead their customer discovery conversations toward confirming what they already believe. The result is validation that feels real but isn't.",
        sitWithThis: "Can you describe the problem you're solving in one sentence — not your solution, the actual problem — and would the people who have it recognize themselves in that description immediately?",
        related: ["customer discovery", "product-market fit", "jobs to be done"],
    },

    "jobs to be done": {
        name: "jobs to be done",
        stage: 1,
        whatItIs: "A framework for understanding why customers really buy products — not based on their demographics or stated preferences but based on the specific progress they are trying to make in a specific circumstance. People don't buy products. They hire products to do a job.",
        thePrinciple: "Clayton Christensen developed this framework after studying why products succeed and fail. The core insight is that customers have jobs they need done — functional, emotional, and social — and they hire products that help them make progress on those jobs. Understanding the job tells you far more about what to build and how to position it than any demographic analysis.",
        inPractice: "McDonald's famously discovered through this framework that their milkshakes were being hired as a morning commute companion — to give commuters something to do with one hand, that would last the whole drive, and keep them full until lunch. Not as a dessert. Not as a treat. As a commute solution. That insight would never have emerged from demographic data. It required asking what job the milkshake was being hired to do.",
        withoutIt: "You optimize your product for the wrong things. You compete on dimensions that don't matter to customers. You miss the real competitors — which are often not obvious alternatives but anything else the customer might hire to do the same job, including doing nothing.",
        theMistake: "Asking customers what they want instead of observing what they do. Customers are notoriously bad at articulating the job. They'll tell you features they want. They won't tell you what progress they're trying to make. You have to infer the job from behavior — from what they actually do before and after using your product, and from what they used before you existed.",
        sitWithThis: "What is the specific moment of struggle that sends someone looking for what you offer — and what does that moment feel like for them?",
        related: ["customer discovery", "problem-solution fit", "value proposition"],
    },

    // ─── STAGE 2 ─────────────────────────────────────────────

    "unit economics": {
        name: "unit economics",
        stage: 2,
        whatItIs: "The revenue and costs associated with a single unit of your business — one customer, one transaction, one subscription. The financial health of the smallest repeatable piece of your business model before you scale it.",
        thePrinciple: "If the unit economics are broken — if acquiring and serving one customer costs more than that customer pays you — growth makes the problem worse, not better. Every new customer accelerates the loss. This is why investors obsess over unit economics before anything else. Scale amplifies whatever is already true at the unit level. Fix the unit before you scale it.",
        inPractice: "For a subscription business the key unit economics are CAC (what it costs to acquire one customer), LTV (what that customer pays you over their lifetime), and the ratio between them. For a product business it is gross margin per unit. For a marketplace it is the economics of a single transaction. Every business model has a different unit but the question is always the same — does this unit make money?",
        withoutIt: "You can have spectacular revenue growth and be getting poorer with every sale. Businesses with broken unit economics require constant capital infusion just to maintain operations. They can't self-fund. They can't survive a funding gap. Alex Hormozi built his entire framework around creating unit economics so strong that customer acquisition feels free.",
        theMistake: "Confusing revenue growth with business health. A business growing 30% month over month with broken unit economics is a business that is accelerating toward a wall. Revenue is the top line. Unit economics tell you what happens below it.",
        sitWithThis: "If you acquired 100 customers next month using your current plan, would you be more profitable or less profitable than you are today — and do you actually know the answer to that?",
        related: ["business model", "burn rate", "gross margin"],
    },

    "business model": {
        name: "business model",
        stage: 2,
        whatItIs: "The system by which your company creates value, delivers it to customers, and captures a portion of that value as revenue. Not just how you make money — but who you serve, what you give them, how you reach them, and what makes the whole system sustainable.",
        thePrinciple: "A great product with the wrong business model fails. The business model determines whether you can build a sustainable company at all. Two businesses can offer nearly identical products and have completely different fates based solely on how they've structured their model. Gillette and the razor-and-blades model, Spotify and streaming subscriptions, Airbnb and the marketplace take-rate — the model shapes everything downstream.",
        inPractice: "Your business model answers five questions: Who are your customers? What do you give them that they value? How do you reach them? How do you make money? And what makes you hard to copy? If you can't answer all five clearly and specifically your business model isn't finished yet.",
        withoutIt: "You have an idea, not a business. Ideas without business models are hobbies. The model is what turns solving a problem into building a sustainable company.",
        theMistake: "Assuming the obvious monetization model is the right one. The first answer to \"how do we make money\" is almost never the most interesting one. The businesses that build the strongest models usually arrived at them by questioning the default — asking whether there's a way to charge that creates more value alignment, more lock-in, or better unit economics than the obvious approach.",
        sitWithThis: "Is there a business model in your space that would let you acquire customers at dramatically lower cost or serve them at dramatically higher margin than your current model — and why haven't you tried it?",
        related: ["unit economics", "competitive advantage", "value proposition"],
    },

    "competitive advantage": {
        name: "competitive advantage",
        stage: 2,
        whatItIs: "What you do better, differently, or cheaper than every alternative in ways that matter enough to your specific customer that they choose you — and that competitors cannot easily replicate even if they want to.",
        thePrinciple: "Being slightly better than your competition is not a competitive advantage. It is a temporary lead. Real competitive advantage is structural — it comes from something in your business that gets harder to compete with over time, not easier. Network effects, switching costs, proprietary data, brand trust, economies of scale, unique access. These are moats. \"We have better customer service\" is not a moat.",
        inPractice: "Southwest Airlines had a competitive advantage that incumbents literally could not copy — their operational model and culture produced dramatically lower costs than legacy carriers, and any attempt by legacy carriers to replicate it would destroy their existing business model. That is structural advantage. Amazon's competitive advantage in AWS is data at scale and infrastructure investment that takes years and billions to replicate.",
        withoutIt: "You compete on price. A race to the bottom where the winner is the one who loses money most slowly. Or you compete on features, which produces temporary leads that get copied within months. Neither is a business strategy. Both are roads to a commodity.",
        theMistake: "Describing your advantage in terms of what you do rather than why competitors can't do it. \"We have a great team\" and \"we provide excellent service\" describe inputs, not advantages. The question is not what makes you good — it is what makes you hard to copy.",
        sitWithThis: "If a well-funded competitor decided to build exactly what you're building starting tomorrow, what specifically would make it hard for them — and is that thing something you're actually building or something you're planning to build eventually?",
        related: ["business model", "value proposition", "unit economics"],
    },

    "value proposition": {
        name: "value proposition",
        stage: 2,
        whatItIs: "The specific reason a customer chooses you over every alternative including doing nothing. Not your product's features. The outcome they get and the cost — in money, time, effort, and risk — they pay to get it.",
        thePrinciple: "Customers don't buy products. They buy outcomes. The value proposition is the bridge between what you offer and the outcome the customer actually cares about. If you can't state it in one clear sentence that the customer themselves would recognize as describing their own situation, you don't have a value proposition yet — you have a product description.",
        inPractice: "FedEx's original value proposition was ruthlessly clear — when it absolutely positively has to be there overnight. Not \"reliable shipping\" or \"express delivery.\" A specific outcome for a specific person in a specific situation. The clarity of that proposition told customers exactly when to think of FedEx and exactly what they were paying for.",
        withoutIt: "Your marketing is vague. Your sales conversations take longer than they should. Customers can't easily explain to someone else why they use you. Word of mouth is weak because there's no crisp story to tell. Everything costs more because you're spending energy overcoming confusion that a clear value proposition would have prevented.",
        theMistake: "Writing the value proposition from your perspective rather than the customer's. \"We provide innovative AI-powered solutions\" describes what you have. A value proposition describes what the customer gets. Those are different documents and most founders write the first one thinking it's the second.",
        sitWithThis: "Can you write your value proposition in the exact words your best customer would use to describe why they chose you — not marketing language, their words — and would they recognize it immediately?",
        related: ["competitive advantage", "business model", "customer discovery"],
    },

    // ─── STAGE 3 ─────────────────────────────────────────────

    "limited liability": {
        name: "limited liability",
        stage: 3,
        whatItIs: "The legal protection that separates your personal assets from your business's liabilities. When a business has limited liability — as an LLC or corporation does — creditors and plaintiffs can generally only go after the business's assets, not the owner's personal assets.",
        thePrinciple: "Limited liability exists because society recognized that entrepreneurship produces economic value but requires people to take risks they wouldn't take if personal ruin were the cost of failure. It is a legal structure that makes risk-taking rational. Without it, most businesses would never be started because the personal downside would be too catastrophic.",
        inPractice: "A sole proprietor who gets sued for a business dispute can lose their house, their savings, and their personal property. An LLC member in the same situation generally cannot — the liability stops at the business. This protection is not automatic or unconditional. You have to maintain the separation between personal and business finances, sign contracts as the business not as yourself, and operate the LLC as a real separate entity.",
        withoutIt: "Every business decision carries personal financial exposure. A contract dispute, a customer injury, a vendor claim — any of these can reach your personal assets. Most business owners don't realize how exposed they are until they're in a dispute.",
        theMistake: "Forming the LLC and then operating as though nothing changed. The protection is only as strong as the separation you maintain. Commingling personal and business funds, signing contracts personally instead of as the LLC, failing to document major decisions — these can all lead to what lawyers call piercing the corporate veil, which removes the protection entirely.",
        sitWithThis: "If your biggest customer dispute became a lawsuit tomorrow, what personal assets would be at risk — and is that exposure acceptable?",
        related: ["business entity", "operating agreement"],
    },

    // ─── STAGE 4 ─────────────────────────────────────────────

    "burn rate": {
        name: "burn rate",
        stage: 4,
        whatItIs: "How much money your business spends each month. Gross burn is total monthly spending. Net burn subtracts monthly revenue. Net burn is the number that actually tells you how long you have.",
        thePrinciple: "Burn rate and runway are the two most important numbers for any pre-profitable business. Every decision — hiring, marketing spend, product investment — changes one or both of them. A founder who doesn't know their burn rate to the dollar is flying without instruments.",
        inPractice: "A business with $150,000 in the bank and $25,000 monthly net burn has six months of runway. That is not an abstraction — it is a deadline. Every dollar of new revenue extends it. Every new hire compresses it. Knowing this number changes how you make every spending decision.",
        withoutIt: "Founders run out of money with surprise. Not because the numbers weren't there — they always were — but because nobody was watching them closely enough to see the wall coming. The single most common cause of startup death is not product failure or market failure. It is running out of cash before finding a model that works.",
        theMistake: "Confusing gross burn with net burn. A business doing $50,000 in monthly revenue and $70,000 in monthly expenses has a net burn of $20,000 — not $70,000. Many founders either track only the spending side or only the revenue side. Both numbers matter. The gap between them is what's actually being consumed.",
        sitWithThis: "At your current net burn rate, what is the specific date you run out of money — and what has to be true before that date for the business to survive?",
        related: ["runway", "unit economics", "cash flow"],
    },

    "runway": {
        name: "runway",
        stage: 4,
        whatItIs: "How long your business can survive at its current net burn rate before running out of money. Calculated by dividing cash on hand by monthly net burn. Not a soft metric — a clock.",
        thePrinciple: "Runway is your most important resource because it is the one you cannot get more of without either raising money, cutting spending, or generating revenue. Everything else can be rebuilt. When runway hits zero the business stops. This is why every decision a pre-profitable founder makes should be evaluated against its effect on runway first.",
        inPractice: "When Airbnb was near-broke in 2009 with weeks of runway left, knowing their exact number forced a creative solution — selling novelty cereal boxes to keep the company alive long enough to get into Y Combinator. The specificity of their runway forced the specificity of their response. Vague awareness of \"we're running low\" produces vague responses. Knowing you have 47 days produces urgency and creativity.",
        withoutIt: "Decisions get made without the context that would change them. You hire when you shouldn't. You spend on marketing before the model works. You extend a product build that should have been cut. Runway awareness doesn't prevent all of these mistakes but it forces the right questions before they become expensive.",
        theMistake: "Calculating runway based on current cash without accounting for upcoming large expenses — a tax payment, a contract renewal, a planned hire. Real runway accounts for the irregular expenses that appear on the calendar even if they don't appear in the monthly burn number.",
        sitWithThis: "What is the one decision you're currently delaying that your runway number should be forcing you to make right now?",
        related: ["burn rate", "unit economics", "financial projections"],
    },

    // ─── STAGE 5 ─────────────────────────────────────────────

    "grand slam offer": {
        name: "grand slam offer",
        stage: 5,
        whatItIs: "An offer so loaded with value — at a price that seems almost unreasonably low given everything included — that the prospect feels it would be a mistake to say no. A concept developed by Alex Hormozi that reframes the sales conversation from price to value.",
        thePrinciple: "Most businesses compete on price because they never figured out how to compete on value. The Grand Slam Offer escapes the commodity trap entirely by increasing the perceived value of the offer to the point where price becomes almost irrelevant. This isn't about discounting — it's about stacking genuine value until the ratio of what the customer gets to what they pay becomes undeniable.",
        inPractice: "Hormozi turned a $49 per month gym membership into a $999 transformation program by stacking guarantees, adding done-with-you components, removing risk for the customer, and creating a specific outcome promise. Same gym. Same equipment. Completely different offer. The price went up by 20x and sales went up because the value was so obvious.",
        withoutIt: "You compete on who charges less. You train customers to wait for discounts. You attract price-sensitive customers who leave for the next cheaper option. The business model requires constant volume to survive because margin is thin.",
        theMistake: "Thinking the Grand Slam Offer means lowering your price. It means raising your value stack until your price feels low by comparison. The offer should make the prospect think \"how can they afford to offer all of this at this price\" — not \"how can I get them to lower the price.\"",
        sitWithThis: "What would you need to add to your current offer — guarantees, support, outcomes, speed, convenience — to make the price feel like an obvious yes rather than something that requires convincing?",
        related: ["value proposition", "willingness to pay", "unit economics"],
    },

    // ─── STAGE 6 ─────────────────────────────────────────────

    "founder's mentality": {
        name: "founder's mentality",
        stage: 6,
        whatItIs: "The set of behaviors that characterize companies that scale successfully — insurgent mission, front-line obsession, and owner's mindset. A framework developed by Chris Zook and James Allen at Bain after studying why some companies maintain startup energy at scale while most lose it.",
        thePrinciple: "Most growth failures at scale are caused by internal factors — complexity, bureaucracy, loss of the original mission clarity — not by external competition. Companies that preserve what made them great in the first place dramatically outperform those that professionalize their way into mediocrity. The founder's mentality is the thing that gets lost and the thing that needs to be deliberately preserved.",
        inPractice: "Amazon has obsessively preserved founder's mentality — Bezos famously kept an empty chair in meetings to represent the customer, maintained Day 1 culture as a core principle, and structured the company to fight the institutional instincts that kill startup energy. The result is a company that has maintained insurgent speed and customer obsession at trillion-dollar scale.",
        withoutIt: "The company that was dangerous and fast becomes slow and cautious. Decision-making moves up the hierarchy. Customers become abstractions. The original insight that made the business work gets buried under process. Zook and Allen found that companies that lose founder's mentality deliver roughly one-third the shareholder returns of those that preserve it.",
        theMistake: "Thinking that professional management naturally replaces founder's mentality without cost. The professionalization of a startup is necessary and also dangerous — it solves the chaos problems and creates the culture problems simultaneously. The founders who navigate this best are the ones who are intentional about what they're preserving even as they add structure.",
        sitWithThis: "What specific behavior or decision pattern from your early days are you in danger of losing as you add people and process — and what would it take to protect it deliberately?",
        related: ["competitive advantage", "business model", "unit economics"],
    },

};

// Normalize a concept name for library lookup
export function normalizeConceptName(name: string): string {
    return name.toLowerCase().trim();
}

// Look up a concept, returning null if not found
export function getConceptEntry(name: string): ConceptEntry | null {
    return CONCEPT_LIBRARY[normalizeConceptName(name)] || null;
}
