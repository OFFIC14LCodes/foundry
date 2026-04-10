// ─────────────────────────────────────────────────────────────
// DOCUMENT PRODUCTION — CATEGORY AND DOCUMENT LIBRARY
// All 12 categories and their complete document libraries.
// ─────────────────────────────────────────────────────────────

export interface DocItem {
    id: string;
    name: string;
    whenToUse: string;
    isStateAware?: boolean;
    isMostPopular?: boolean;
}

export interface DocCategory {
    id: string;
    name: string;
    description: string;
    icon: string; // Phosphor icon component name
    isStateAware?: boolean;
    documents: DocItem[];
}

export const DOC_CATEGORIES: DocCategory[] = [
    // ── CATEGORY 1 ───────────────────────────────────────────
    {
        id: "business-planning",
        name: "Business Planning",
        description: "Documents that define, communicate, and present your business to the world",
        icon: "ChartLineUp",
        isStateAware: false,
        documents: [
            {
                id: "business-summary",
                name: "Business Summary",
                isMostPopular: true,
                whenToUse: "When you need a comprehensive overview of your business for a bank loan application, investor meeting, or any formal introduction to your company. This is your business on paper — professional, complete, and ready to hand to anyone who needs to understand what you're building and why it will succeed.",
            },
            {
                id: "executive-summary",
                name: "Executive Summary",
                isMostPopular: true,
                whenToUse: "When you need a concise strategic overview of your business that can stand alone or serve as the opening section of a larger business plan. Typically 1–2 pages, this is what busy investors and executives read first to decide if they want to learn more.",
            },
            {
                id: "investor-overview",
                name: "Investor Overview",
                whenToUse: "When you are preparing to approach angel investors, venture capital firms, or any equity investor for the first time. This document presents your business opportunity, market size, traction, team, and funding ask in the format investors expect to see.",
            },
            {
                id: "funding-request",
                name: "Funding Request",
                whenToUse: "When you are applying for a business loan from a bank or SBA, requesting a grant, or making a formal ask for capital from any source. This document specifies exactly how much you need, what you will use it for, and how you will repay or justify it.",
            },
            {
                id: "partnership-proposal",
                name: "Partnership Proposal",
                whenToUse: "When you want to formally propose a strategic partnership, joint venture, or collaboration with another business. Use this when a handshake conversation has gone well and it is time to put the partnership structure on paper for serious consideration.",
            },
            {
                id: "founder-profile",
                name: "Founder Profile",
                whenToUse: "When investors, partners, lenders, or media ask about your background and qualifications. This document presents your relevant experience, skills, and personal story in a professional format that builds credibility and trust with your audience.",
            },
            {
                id: "concept-overview",
                name: "Concept Overview",
                whenToUse: "When you need a single-page pitch document that explains your business idea clearly and compellingly. Perfect for early conversations with potential customers, advisors, or investors when you need something concise and visually clean that communicates the core opportunity.",
            },
            {
                id: "business-model-canvas",
                name: "Business Model Canvas",
                whenToUse: "When you need to map out the nine core components of your business on one page — customer segments, value propositions, channels, customer relationships, revenue streams, key resources, key activities, key partnerships, and cost structure. This is a foundational strategic planning tool used by founders and MBAs worldwide to stress-test a business model before investing heavily in it.",
            },
            {
                id: "competitive-analysis",
                name: "Competitive Analysis Report",
                isMostPopular: true,
                whenToUse: "When you need to formally document your competitive landscape for investors, internal planning, or strategic decision-making. This report identifies your main competitors, analyzes their strengths and weaknesses, and clearly articulates where your business is positioned to win.",
            },
            {
                id: "market-research-summary",
                name: "Market Research Summary",
                whenToUse: "When you need to present data and analysis about your target market, including market size, growth trends, customer demographics, and demand validation. Banks and investors require evidence that a real market exists for your product or service before committing capital.",
            },
            {
                id: "swot-analysis",
                name: "SWOT Analysis",
                whenToUse: "When you need to systematically evaluate your business's Strengths, Weaknesses, Opportunities, and Threats. Use this for strategic planning sessions, board presentations, investor materials, or any time you need an honest assessment of where your business stands and what it faces.",
            },
            {
                id: "value-proposition",
                name: "Value Proposition Statement",
                whenToUse: "When you need to articulate in precise language exactly what your business offers, who it serves, and why customers should choose you over every alternative including doing nothing. This document is the foundation of all your marketing and sales messaging.",
            },
            {
                id: "go-to-market",
                name: "Go-To-Market Strategy",
                whenToUse: "When you are preparing to launch a product or enter a new market and need a documented plan for how you will acquire your first customers, what channels you will use, and how you will scale from initial traction. Investors often request this as part of due diligence.",
            },
            {
                id: "mission-vision",
                name: "Mission and Vision Statement",
                whenToUse: "When you need to formally articulate why your company exists (mission) and what it is ultimately trying to achieve (vision). These foundational statements guide every strategic decision and are required in business plans, investor materials, employee handbooks, and company websites.",
            },
            {
                id: "company-overview",
                name: "Company Overview / About Us",
                whenToUse: "When you need a professionally written company description for your website, pitch deck, partnership proposals, press kit, or any context where someone needs to quickly understand who you are and what you stand for. This is often the most-read section of any company document.",
            },
            {
                id: "custom-bp",
                name: "Custom Document",
                whenToUse: "When none of the templates above match what you need. Describe what you want in the special instructions field and Forge will build it from scratch based on your business context and the audience you are writing for.",
            },
        ],
    },

    // ── CATEGORY 2 ───────────────────────────────────────────
    {
        id: "legal-formation",
        name: "Legal Formation",
        description: "Documents that legally create and protect your business entity",
        icon: "Gavel",
        isStateAware: true,
        documents: [
            {
                id: "articles-of-organization",
                name: "Certificate / Articles of Organization",
                isStateAware: true,
                isMostPopular: true,
                whenToUse: "When you are forming a Limited Liability Company (LLC) for the first time. This is the foundational legal document that officially creates your LLC in the eyes of your state government. Every LLC must file this document with their state before legally operating as an LLC. Filing fees, required language, and processing times vary significantly by state — Forge generates this according to your specific state's current requirements.",
            },
            {
                id: "articles-of-incorporation",
                name: "Articles of Incorporation",
                isStateAware: true,
                whenToUse: "When you are forming a Corporation (C-Corp or S-Corp) rather than an LLC. Required if you plan to raise venture capital, issue stock to employees, or need the specific tax treatment a corporation provides. Forge will ask whether you need C-Corp or S-Corp structure and generate accordingly for your state.",
            },
            {
                id: "operating-agreement",
                name: "Operating Agreement",
                isStateAware: true,
                isMostPopular: true,
                whenToUse: "Immediately after forming your LLC, even if you are the only member. An Operating Agreement defines how your LLC is governed, how profits are distributed, what happens if a member leaves, and how decisions are made. Banks require this document to open a business account. Without it your LLC may be treated as a sole proprietorship in a legal dispute.",
            },
            {
                id: "corporate-bylaws",
                name: "Corporate Bylaws",
                isStateAware: true,
                whenToUse: "Immediately after incorporating a Corporation. Bylaws are the internal rules that govern how your corporation operates — how board meetings work, how officers are elected, how shares are issued, and how major decisions are made. Required for corporations in the same way an Operating Agreement is required for LLCs.",
            },
            {
                id: "registered-agent",
                name: "Registered Agent Designation",
                isStateAware: true,
                whenToUse: "When you need to formally designate a registered agent for your LLC or corporation. A registered agent is the person or service that receives legal documents and official government correspondence on behalf of your business. Required in every state — Forge generates this according to your state's specific requirements and explains your options.",
            },
            {
                id: "statement-of-organizer",
                name: "Statement of Organizer",
                isStateAware: true,
                whenToUse: "In states that require it, when the person filing the LLC formation documents (the organizer) is different from the actual LLC members. Common when an attorney or third party files on behalf of the founders. Forge automatically includes this when required by your state.",
            },
            {
                id: "llc-member-resolution",
                name: "LLC Member Resolution",
                isStateAware: true,
                whenToUse: "When your LLC needs to formally document a major decision made by its members — opening a bank account, entering a significant contract, admitting a new member, or making a major business change. Banks and some partners require a Member Resolution to verify that the LLC officially authorized the action.",
            },
            {
                id: "dba-guide",
                name: "Business Name Registration / DBA Guide",
                isStateAware: true,
                whenToUse: "When you want to operate your business under a name different from your legal LLC or corporation name. Also called a fictitious business name or trade name. Forge generates the filing guide and required forms specific to your state and county.",
            },
            {
                id: "foreign-qualification",
                name: "Foreign Qualification Application",
                isStateAware: true,
                whenToUse: "When your LLC or corporation is registered in one state but you want to legally do business in another state. Most states require foreign qualification before you can operate, open a bank account, or sign contracts there. Forge generates the application according to the requirements of the state you are expanding into.",
            },
            {
                id: "good-standing-request",
                name: "Certificate of Good Standing Request",
                isStateAware: true,
                whenToUse: "When a bank, investor, lender, or business partner asks for proof that your business is legally active and in compliance with state requirements. A Certificate of Good Standing is issued by your state and confirms your business exists and has met all filing obligations. Forge generates the formal request letter and explains the process for your specific state.",
            },
        ],
    },

    // ── CATEGORY 3 ───────────────────────────────────────────
    {
        id: "tax-federal",
        name: "Tax and Federal",
        description: "Documents for IRS compliance, federal filings, and tax planning",
        icon: "CurrencyDollar",
        isStateAware: true,
        documents: [
            {
                id: "ein-guide",
                name: "EIN Application Guide and Summary",
                isMostPopular: true,
                whenToUse: "Before opening a business bank account, hiring employees, filing business taxes, or applying for most business licenses. An Employer Identification Number (EIN) is your business's federal tax ID — the equivalent of a Social Security Number for your company. Forge walks you through the IRS SS-4 form and generates a completed summary ready for submission.",
            },
            {
                id: "s-corp-election",
                name: "S-Corporation Election Letter",
                isStateAware: true,
                whenToUse: "When your LLC or corporation wants to be taxed as an S-Corporation to reduce self-employment taxes. Typically recommended when your business is generating $40,000 or more in annual net profit. Forge generates the IRS Form 2553 preparation document and election letter — your CPA will advise on timing and confirm eligibility.",
            },
            {
                id: "w9",
                name: "W-9 — Taxpayer Identification Request",
                isMostPopular: true,
                whenToUse: "When a client or business partner asks for your tax information before paying you, or when you need to request tax information from a contractor you are paying $600 or more in a year. Every business needs this document ready. Forge generates a completed W-9 using your business information.",
            },
            {
                id: "1099-checklist",
                name: "1099 Preparation Checklist",
                whenToUse: "Every January when you need to issue 1099-NEC forms to independent contractors you paid $600 or more during the previous year. This checklist documents all required information and walks through IRS deadlines and filing requirements so you stay compliant.",
            },
            {
                id: "sales-tax-guide",
                name: "Sales Tax Registration Guide",
                isStateAware: true,
                whenToUse: "Before you make your first taxable sale in any state where you have sales tax nexus. Sales tax requirements vary dramatically by state — some states have no sales tax, others have complex multi-rate systems. After the South Dakota v. Wayfair Supreme Court decision, online businesses may have nexus in multiple states even without a physical presence. Forge generates a state-specific registration guide.",
            },
            {
                id: "quarterly-tax",
                name: "Quarterly Estimated Tax Payment Summary",
                whenToUse: "Every quarter as a self-employed business owner or single-member LLC. The IRS requires quarterly tax payments if you expect to owe $1,000 or more in taxes for the year. Missing these payments results in penalties. Forge generates a payment schedule and summary based on your projected income.",
            },
            {
                id: "expense-policy",
                name: "Business Expense Policy",
                whenToUse: "When you need to document which business expenses are deductible, how to track them, and what records to keep. This internal policy document protects you in an audit by showing systematic expense tracking and helps employees understand what can and cannot be reimbursed.",
            },
            {
                id: "home-office-deduction",
                name: "Home Office Deduction Documentation",
                whenToUse: "When you work from home and want to claim the home office deduction on your business taxes. The IRS has specific requirements for what qualifies as a home office. Forge generates the documentation framework and calculation worksheet your CPA will need.",
            },
        ],
    },

    // ── CATEGORY 4 ───────────────────────────────────────────
    {
        id: "banking-finance",
        name: "Banking and Finance",
        description: "Documents for financial management, banking relationships, and investor-ready financials",
        icon: "Bank",
        isStateAware: false,
        documents: [
            {
                id: "banking-resolution",
                name: "Banking Resolution",
                isMostPopular: true,
                whenToUse: "When opening a business bank account — virtually every bank requires this document. A Banking Resolution is a formal LLC or corporate document that authorizes specific individuals to open accounts, sign checks, apply for loans, and conduct banking on behalf of the business. Without it most banks will not open your account.",
            },
            {
                id: "capital-contribution",
                name: "Initial Capital Contribution Agreement",
                whenToUse: "When one or more founders or members are putting money into the business at formation. This document records who contributed what amount, when, and on what terms — protecting all parties and creating a clear financial record from day one.",
            },
            {
                id: "promissory-note",
                name: "Promissory Note",
                whenToUse: "When money is being loaned between parties — a founder lending money to their LLC, an investor making a debt investment, or the business borrowing from a friend or family member. A Promissory Note documents the loan amount, interest rate, repayment terms, and what happens if the borrower defaults.",
            },
            {
                id: "personal-guarantee",
                name: "Personal Guarantee",
                whenToUse: "When a lender, landlord, or vendor requires the founder to personally guarantee a business obligation. By signing a personal guarantee you agree to be personally responsible for the debt if the business cannot pay. Forge generates this document and clearly explains the implications so you understand what you are agreeing to.",
            },
            {
                id: "financial-projections",
                name: "Financial Projections Summary",
                isMostPopular: true,
                whenToUse: "When applying for a bank loan, approaching investors, or planning your business finances for the next 12 months. This document presents your projected revenue, expenses, and profit in a clear format that demonstrates financial literacy and business viability to any financial stakeholder.",
            },
            {
                id: "cash-flow-statement",
                name: "Cash Flow Statement",
                whenToUse: "When you need to track or present the actual movement of money in and out of your business over time. Unlike a profit and loss statement which shows accounting profit, a cash flow statement shows real cash available — critical for understanding whether you can pay your bills even when you are technically profitable.",
            },
            {
                id: "profit-loss",
                name: "Profit and Loss Statement",
                isMostPopular: true,
                whenToUse: "When a bank, investor, or partner asks for your financials, or when you need to understand whether your business is actually making money. The P&L summarizes revenue, cost of goods sold, gross profit, operating expenses, and net income over a specific period.",
            },
            {
                id: "balance-sheet",
                name: "Balance Sheet",
                whenToUse: "When presenting a complete financial picture of your business at a specific point in time. The balance sheet shows assets, liabilities, and owner equity. Banks require this for loan applications. Investors use it to assess financial health and leverage.",
            },
            {
                id: "break-even",
                name: "Break-Even Analysis",
                whenToUse: "Before launching a product, opening a location, or making a major investment — to understand exactly how much revenue you need to cover all costs and start generating profit. This is one of the most important financial documents for a new business and is frequently required by banks evaluating loan applications.",
            },
            {
                id: "pricing-model",
                name: "Pricing Model Document",
                whenToUse: "When you need to formally document and justify your pricing strategy — for internal planning, investor presentations, or strategic review. This document explains your pricing methodology, competitive positioning, margin analysis, and the reasoning behind your price points.",
            },
            {
                id: "budget-proposal",
                name: "Budget Proposal",
                whenToUse: "When requesting budget approval internally, presenting a spending plan to investors, or planning expenses for a new project, department, or business initiative. A formal budget proposal shows financial discipline and forward planning.",
            },
            {
                id: "loan-package",
                name: "Loan Application Support Package",
                whenToUse: "When applying for an SBA loan, bank business loan, or any formal lending product. This compiled package includes all the financial documents a lender will request — business summary, financial projections, P&L, balance sheet, and personal financial statement framework — organized in the format lenders expect.",
            },
        ],
    },

    // ── CATEGORY 5 ───────────────────────────────────────────
    {
        id: "intellectual-property",
        name: "Intellectual Property",
        description: "Documents that protect what you create, build, and own",
        icon: "ShieldCheck",
        isStateAware: false,
        documents: [
            {
                id: "nda",
                name: "Non-Disclosure Agreement (NDA)",
                isMostPopular: true,
                whenToUse: "Before sharing confidential business information, trade secrets, financial details, or proprietary concepts with anyone outside your company — including potential partners, contractors, investors, employees, or advisors. An NDA creates a legally binding obligation of confidentiality. This is one of the most frequently needed documents for any business at any stage.",
            },
            {
                id: "trademark-assignment",
                name: "Trademark Assignment Agreement",
                whenToUse: "When transferring ownership of a trademark from an individual to your LLC or corporation. Common when founders registered a trademark personally before forming their business entity. Also used when buying a trademark from another party. Ensures your business legally owns its brand assets.",
            },
            {
                id: "copyright-assignment",
                name: "Copyright Assignment Agreement",
                whenToUse: "When transferring ownership of creative work — writing, design, code, photography, music — from its creator to your business. If a freelancer created your logo or a contractor built your website without a proper assignment agreement your business may not legally own that work. This document corrects that.",
            },
            {
                id: "work-for-hire",
                name: "Work for Hire Agreement",
                isMostPopular: true,
                whenToUse: "Before commissioning any creative or technical work from a contractor, freelancer, or agency. A Work for Hire Agreement ensures that anything created for your business belongs to your business from the moment it is created — not to the creator. Use this every single time you hire someone to create something for your company.",
            },
            {
                id: "ip-assignment",
                name: "IP Assignment Agreement",
                whenToUse: "When founders are contributing existing intellectual property — inventions, code, designs, processes — to the newly formed business. This comprehensive assignment transfers all founder IP into the company, which is required by most investors before they will invest. If a founder leaves, the IP stays with the company.",
            },
            {
                id: "trade-secret-policy",
                name: "Trade Secret Policy",
                whenToUse: "When you need to formally document what information your business considers a trade secret and how it should be protected. A documented trade secret policy strengthens your legal position if a competitor steals proprietary information and helps employees understand their confidentiality obligations.",
            },
            {
                id: "digital-asset-assignment",
                name: "Domain and Digital Asset Assignment",
                whenToUse: "When transferring domain names, social media accounts, websites, or other digital assets from personal ownership to your LLC or corporation. Ensures your business legally owns its digital presence and these assets cannot be claimed by a departing founder or partner.",
            },
            {
                id: "brand-guidelines",
                name: "Brand Usage Guidelines",
                whenToUse: "When your brand has grown to the point where partners, licensees, franchisees, or employees need guidance on how to correctly use your logo, colors, fonts, and brand voice. Brand guidelines protect your trademark by ensuring consistent and authorized use.",
            },
        ],
    },

    // ── CATEGORY 6 ───────────────────────────────────────────
    {
        id: "contracts-agreements",
        name: "Contracts and Agreements",
        description: "Documents that govern your relationships with customers, partners, and vendors",
        icon: "Handshake",
        isStateAware: false,
        documents: [
            {
                id: "client-service-agreement",
                name: "Client Service Agreement",
                isMostPopular: true,
                whenToUse: "Before beginning any ongoing work for a client. This agreement defines the scope of services, payment terms, intellectual property ownership, confidentiality obligations, and how disputes are resolved. Without it you have no legal protection if a client refuses to pay or disputes the work.",
            },
            {
                id: "msa",
                name: "Master Services Agreement (MSA)",
                whenToUse: "When you have an ongoing relationship with a client that will involve multiple projects or engagements over time. The MSA establishes the overarching terms that govern all work — each individual project then uses a lightweight Statement of Work rather than a full contract, saving time and legal fees.",
            },
            {
                id: "sow",
                name: "Statement of Work (SOW)",
                whenToUse: "For each specific project under a Master Services Agreement. The SOW defines the specific deliverables, timeline, milestones, and pricing for that particular engagement. Used together with an MSA it creates a clean, scalable contract framework for client relationships.",
            },
            {
                id: "sales-contract",
                name: "Sales Contract",
                whenToUse: "When selling products — physical or digital — to customers or business buyers. A Sales Contract documents what is being sold, the price, delivery terms, warranties, and what happens if something goes wrong. Essential for any product-based business.",
            },
            {
                id: "purchase-agreement",
                name: "Purchase Agreement",
                whenToUse: "When buying or selling a significant asset — equipment, inventory, intellectual property, real estate, or an entire business. A Purchase Agreement protects both buyer and seller by documenting exactly what is being transferred, for what price, and under what conditions.",
            },
            {
                id: "loi",
                name: "Letter of Intent (LOI)",
                whenToUse: "In the early stages of a significant negotiation — a potential acquisition, major partnership, or large contract — when both parties want to document that they are serious and agree on the basic terms before investing in full legal documentation. An LOI is typically non-binding but signals genuine commitment.",
            },
            {
                id: "mou",
                name: "Memorandum of Understanding (MOU)",
                whenToUse: "When two parties want to document a mutual understanding or intention to work together before a formal agreement is ready. Similar to an LOI but typically used for partnerships and collaborations rather than transactions. Non-binding but professionally important.",
            },
            {
                id: "vendor-agreement",
                name: "Vendor Agreement",
                whenToUse: "Before establishing an ongoing relationship with a supplier, manufacturer, or service provider your business depends on. A Vendor Agreement protects you by defining pricing, delivery standards, quality requirements, exclusivity, and what happens if the vendor fails to perform.",
            },
            {
                id: "affiliate-agreement",
                name: "Affiliate Agreement",
                whenToUse: "When you want to establish a referral or affiliate program where partners earn a commission for sending customers to your business. This agreement defines commission rates, payment terms, approved marketing methods, and how the relationship can be terminated.",
            },
            {
                id: "reseller-agreement",
                name: "Reseller Agreement",
                whenToUse: "When allowing another business to sell your products or services under their own brand or through their own channels. Defines territory, pricing minimums, support obligations, and brand usage requirements.",
            },
            {
                id: "joint-venture",
                name: "Joint Venture Agreement",
                whenToUse: "When two or more businesses are combining resources to pursue a specific opportunity together without forming a new permanent legal entity. Defines each party's contributions, responsibilities, profit sharing, and how the venture will be wound down when the project ends.",
            },
            {
                id: "licensing-agreement",
                name: "Licensing Agreement",
                whenToUse: "When granting another party the right to use your intellectual property — software, brand, technology, content, or processes — in exchange for royalties or licensing fees. Also used when licensing someone else's IP for use in your business.",
            },
            {
                id: "subscription-agreement",
                name: "Subscription Agreement",
                whenToUse: "When offering a recurring subscription service to customers. This agreement defines billing terms, what the subscription includes, how it can be cancelled, refund policy, and what happens if payment fails. Essential for any SaaS or subscription business.",
            },
            {
                id: "terms-of-service",
                name: "Terms of Service",
                isMostPopular: true,
                whenToUse: "For any digital product, website, or app that users interact with. Terms of Service define the rules users must agree to, what you are and are not responsible for, how disputes are handled, and your right to terminate accounts. Required before any public launch.",
            },
            {
                id: "refund-policy",
                name: "Refund and Return Policy",
                whenToUse: "Before making your first sale. Every business that accepts payment needs a clear written policy on refunds, returns, and exchanges. Required by payment processors, expected by customers, and legally mandated to be clearly disclosed in many jurisdictions.",
            },
            {
                id: "sla",
                name: "Service Level Agreement (SLA)",
                whenToUse: "When committing to specific performance standards for your service — uptime guarantees, response times, delivery windows. Common in technology, logistics, and professional services. An SLA protects both parties by clearly defining what excellence looks like and what remedies exist when standards are not met.",
            },
            {
                id: "loi-purchase",
                name: "Letter of Intent to Purchase",
                whenToUse: "When you are seriously interested in acquiring another business, significant asset, or property and want to signal your intent and agree on preliminary terms before engaging lawyers for full due diligence and documentation.",
            },
            {
                id: "cease-desist",
                name: "Cease and Desist Letter",
                whenToUse: "When someone is infringing your intellectual property, breaching a contract, defaming your business, or engaging in unfair competition. A Cease and Desist letter is a formal legal warning demanding they stop the specified behavior immediately or face legal action. Often resolves disputes without costly litigation.",
            },
            {
                id: "demand-letter-contracts",
                name: "Demand Letter",
                whenToUse: "When you are owed money or performance that has not been delivered and informal requests have failed. A formal Demand Letter states the specific obligation owed, the amount or action required, and a deadline for compliance before legal action is initiated.",
            },
        ],
    },

    // ── CATEGORY 7 ───────────────────────────────────────────
    {
        id: "employment-hr",
        name: "Employment and HR",
        description: "Documents for hiring, managing, and working with employees and contractors",
        icon: "Users",
        isStateAware: true,
        documents: [
            {
                id: "contractor-agreement",
                name: "Independent Contractor Agreement",
                isMostPopular: true,
                isStateAware: true,
                whenToUse: "Before any contractor, freelancer, or consultant begins work for your business. This agreement legally establishes that the worker is an independent contractor and not an employee — protecting you from IRS misclassification penalties, which can be substantial. Defines scope of work, payment, intellectual property ownership, and confidentiality.",
            },
            {
                id: "offer-letter",
                name: "Offer Letter",
                isMostPopular: true,
                isStateAware: true,
                whenToUse: "When extending a job offer to a new employee. An Offer Letter formally documents the position title, compensation, start date, reporting structure, and key employment terms. While typically not a full employment contract it creates a clear record of what was agreed upon and sets professional expectations from day one.",
            },
            {
                id: "employee-nda",
                name: "Employee Confidentiality Agreement",
                isStateAware: true,
                whenToUse: "When hiring any employee who will have access to sensitive business information, trade secrets, customer lists, financial data, or proprietary processes. This agreement obligates the employee to protect confidential information both during and after employment.",
            },
            {
                id: "employee-ip-assignment",
                name: "IP Assignment Agreement for Employees",
                whenToUse: "When hiring any employee in a role that involves creating, developing, or contributing to products, code, designs, content, or processes. This agreement ensures that everything an employee creates in the course of their employment belongs to the company — not the employee personally.",
            },
            {
                id: "non-compete",
                name: "Non-Compete Agreement",
                isStateAware: true,
                whenToUse: "When you want to prevent a departing employee from immediately working for a direct competitor or starting a competing business. Critical note — enforceability varies dramatically by state. California bans non-competes entirely. Several other states have strong limitations. Forge generates this document with state-specific enforceability warnings so you understand your actual legal position before asking employees to sign.",
            },
            {
                id: "non-solicitation",
                name: "Non-Solicitation Agreement",
                isStateAware: true,
                whenToUse: "When you want to prevent departing employees from recruiting your other employees or soliciting your customers after they leave. More consistently enforceable than non-competes across states. Should be included in most employment agreements for anyone with access to customer relationships or who manages other employees.",
            },
            {
                id: "employee-handbook",
                name: "Employee Handbook Outline",
                isStateAware: true,
                whenToUse: "When you are hiring your first employees and need to establish clear workplace policies. An Employee Handbook covers attendance, conduct, discrimination and harassment policies, benefits, time off, and disciplinary procedures. Forge generates a comprehensive outline that you customize and expand — having one protects you legally and sets clear expectations.",
            },
            {
                id: "pip",
                name: "Performance Improvement Plan (PIP)",
                whenToUse: "When an employee is not meeting performance expectations and you need to formally document the deficiencies, the required improvements, the timeline for improvement, and the consequences if improvement does not occur. A properly documented PIP is essential legal protection before terminating an employee for performance reasons.",
            },
            {
                id: "separation-agreement",
                name: "Separation Agreement",
                isStateAware: true,
                whenToUse: "When an employee is leaving — voluntarily or involuntarily — and you want to formally document the terms of their departure, including any severance, the return of company property, ongoing confidentiality obligations, and a mutual release of claims. Protects both parties and reduces the risk of post-employment disputes.",
            },
            {
                id: "contractor-sow",
                name: "Contractor Statement of Work",
                whenToUse: "For each specific project or engagement with a contractor, defining deliverables, timeline, payment schedule, and acceptance criteria. Works alongside the Independent Contractor Agreement to create a complete framework for contractor relationships.",
            },
            {
                id: "job-description",
                name: "Job Description Template",
                whenToUse: "Before posting any job opening or beginning any hiring process. A clear job description defines the role, responsibilities, required qualifications, and reporting structure — attracting the right candidates and creating a documented basis for hiring decisions that protects against discrimination claims.",
            },
            {
                id: "reference-auth",
                name: "Reference Check Authorization",
                whenToUse: "Before conducting reference checks on a job candidate. This authorization documents the candidate's consent to contact their references and prior employers, protecting you from claims of unauthorized information gathering.",
            },
            {
                id: "background-auth",
                name: "Background Check Authorization",
                isStateAware: true,
                whenToUse: "Before conducting any background check on a job candidate or employee. Federal law (FCRA) requires written authorization before running background checks. Forge generates a compliant authorization form with state-specific additions where required.",
            },
        ],
    },

    // ── CATEGORY 8 ───────────────────────────────────────────
    {
        id: "fundraising-investment",
        name: "Fundraising and Investment",
        description: "Documents for raising capital, managing investors, and building your cap table",
        icon: "TrendUp",
        isStateAware: false,
        documents: [
            {
                id: "safe-agreement",
                name: "SAFE Agreement",
                isMostPopular: true,
                whenToUse: "When raising your first outside investment from angel investors or early backers. A SAFE (Simple Agreement for Future Equity) is the standard early-stage investment instrument used by Y Combinator and most seed investors. It is not a loan and has no interest or maturity date — the investor receives equity when you raise a priced round. Simpler and cheaper than a convertible note for both parties.",
            },
            {
                id: "convertible-note",
                name: "Convertible Note",
                whenToUse: "When raising early investment from investors who prefer debt instruments over SAFEs, or when your investors are more traditional and expect interest and a maturity date. A convertible note is a loan that converts to equity at a future financing round, typically at a discount to reward early investors for their risk.",
            },
            {
                id: "term-sheet",
                name: "Term Sheet",
                whenToUse: "When you have serious investor interest and need to document the proposed terms of an investment before engaging lawyers to draft the full legal documents. A term sheet is typically non-binding but represents a genuine commitment to proceed. Having a clean term sheet ready shows investors you understand the process.",
            },
            {
                id: "cap-table",
                name: "Cap Table",
                isMostPopular: true,
                whenToUse: "From the moment you form your company and issue any equity — to co-founders, employees, advisors, or investors. A Cap Table is the definitive record of who owns what percentage of your company and what type of equity they hold. Investors will request this in every due diligence process. Forge generates a properly structured template you can maintain and update.",
            },
            {
                id: "investor-update",
                name: "Investor Update Template",
                whenToUse: "Monthly or quarterly after you have taken on investors. Regular professional investor updates build trust, keep investors informed, and often generate helpful introductions and support. Forge generates a template that covers the key metrics, highlights, challenges, and asks that sophisticated investors expect to see.",
            },
            {
                id: "pitch-deck-outline",
                name: "Pitch Deck Outline",
                isMostPopular: true,
                whenToUse: "When preparing to present your business to investors in a formal pitch setting. Forge generates a structured outline covering the 10–12 slides that most successful pitch decks include — problem, solution, market size, product, business model, traction, team, competition, financials, and the ask — tailored to your specific business.",
            },
            {
                id: "due-diligence-checklist",
                name: "Due Diligence Checklist",
                whenToUse: "Before entering a due diligence process with an investor so you know exactly what documents and information to prepare. Being organized and responsive during due diligence dramatically increases the probability of closing an investment round. Forge generates a comprehensive checklist based on your stage and business type.",
            },
            {
                id: "board-resolution",
                name: "Board Resolution",
                whenToUse: "When your corporation's board of directors needs to formally approve a significant decision — issuing stock, approving an acquisition, authorizing a major contract, or appointing officers. A Board Resolution documents the decision officially in the corporate records.",
            },
            {
                id: "shareholder-agreement",
                name: "Shareholder Agreement",
                whenToUse: "When you have multiple shareholders in a corporation and need to govern their rights and obligations — including rights of first refusal, drag-along and tag-along rights, transfer restrictions, and what happens when a shareholder wants to sell. Essential for any corporation with more than one shareholder.",
            },
            {
                id: "409a-summary",
                name: "409A Valuation Summary",
                whenToUse: "Before issuing stock options to employees. A 409A valuation establishes the fair market value of your common stock — required by the IRS to set the exercise price of employee stock options. Forge generates a documentation framework and explanation of the process, though the actual valuation must be performed by a qualified third-party appraiser.",
            },
        ],
    },

    // ── CATEGORY 9 ───────────────────────────────────────────
    {
        id: "real-estate-operations",
        name: "Real Estate and Operations",
        description: "Documents for physical locations, operational systems, and business continuity",
        icon: "Buildings",
        isStateAware: false,
        documents: [
            {
                id: "lease-review",
                name: "Commercial Lease Review Summary",
                isMostPopular: true,
                whenToUse: "Before signing any commercial lease for office, retail, warehouse, or production space. Upload your lease document and Forge will analyze it, flagging key terms, unusual clauses, hidden costs, and negotiating opportunities. Understanding what you are signing before you sign it can save thousands of dollars and years of regret.",
            },
            {
                id: "equipment-lease",
                name: "Equipment Lease Agreement",
                whenToUse: "When leasing equipment — machinery, vehicles, technology, medical equipment, restaurant equipment — from a vendor or leasing company. This agreement defines lease term, monthly payments, maintenance responsibilities, and options at the end of the lease period.",
            },
            {
                id: "office-sharing",
                name: "Office Sharing Agreement",
                whenToUse: "When sharing office space with another business or individual, or when subletting a portion of your leased space to another party. Defines shared costs, shared resources, conduct expectations, and termination procedures.",
            },
            {
                id: "vehicle-policy",
                name: "Vehicle Use Policy",
                whenToUse: "When employees use company vehicles or their personal vehicles for business purposes. Documents approved uses, insurance requirements, reimbursement rates, and liability in case of accidents — protecting the business from liability and ensuring IRS compliance for vehicle deductions.",
            },
            {
                id: "insurance-checklist",
                name: "Insurance Requirements Checklist",
                isMostPopular: true,
                whenToUse: "Before launching your business, signing a commercial lease, or taking on your first employee. Forge generates a customized checklist of the insurance coverage your specific business needs — general liability, professional liability, workers compensation, commercial property, business interruption, and others based on your industry and state requirements.",
            },
            {
                id: "business-continuity",
                name: "Business Continuity Plan Outline",
                whenToUse: "When you need to document how your business will continue operating during and after a significant disruption — natural disaster, key employee departure, cyber attack, or public health emergency. Often required by enterprise clients, government contracts, and lenders as evidence of operational resilience.",
            },
            {
                id: "sop-template",
                name: "Standard Operating Procedure Template",
                whenToUse: "When you need to document how a specific business process is performed so it can be done consistently by anyone on your team. SOPs are the foundation of a scalable business — they capture institutional knowledge and allow you to delegate without losing quality.",
            },
        ],
    },

    // ── CATEGORY 10 ──────────────────────────────────────────
    {
        id: "compliance-regulatory",
        name: "Compliance and Regulatory",
        description: "Documents for legal compliance, data protection, and regulatory requirements",
        icon: "Shield",
        isStateAware: true,
        documents: [
            {
                id: "privacy-policy",
                name: "Privacy Policy",
                isMostPopular: true,
                isStateAware: true,
                whenToUse: "Before launching any website, app, or digital product that collects any information from users — including something as basic as an email address. A Privacy Policy is legally required in virtually every jurisdiction and is a condition of using Google OAuth, Apple Sign In, and most payment processors. Forge generates a comprehensive policy based on your specific data practices.",
            },
            {
                id: "cookie-policy",
                name: "Cookie Policy",
                whenToUse: "When your website uses cookies for any purpose — analytics, authentication, advertising, or personalization. Required by GDPR for European users and best practice everywhere. Forge generates a policy that accurately reflects your cookie usage.",
            },
            {
                id: "gdpr-checklist",
                name: "GDPR Compliance Checklist",
                whenToUse: "If you have any users in the European Union or European Economic Area. GDPR applies to any business that processes the personal data of EU residents regardless of where the business is located. This checklist documents your compliance measures and identifies any gaps that need to be addressed.",
            },
            {
                id: "ccpa-checklist",
                name: "CCPA Compliance Checklist",
                isStateAware: true,
                whenToUse: "If you have any users in California or if you are a California-based business. The California Consumer Privacy Act gives California residents specific rights over their personal data. This checklist documents your compliance with CCPA requirements including the right to know, right to delete, and right to opt out of data sale.",
            },
            {
                id: "ada-statement",
                name: "ADA Accessibility Statement",
                whenToUse: "When your website or app needs to document its compliance with accessibility standards. While legally required only for certain businesses, an accessibility statement demonstrates good faith effort and is increasingly expected by enterprise clients, government contractors, and socially conscious users.",
            },
            {
                id: "business-license-guide",
                name: "Business License Application Guide",
                isMostPopular: true,
                isStateAware: true,
                whenToUse: "Before beginning operations in any new location or expanding into a new business activity. Business license requirements vary dramatically by state, county, and city — and by industry. Forge generates a state and industry specific guide to the licenses and permits you need to operate legally.",
            },
            {
                id: "permit-checklist",
                name: "Industry-Specific Permit Checklist",
                isStateAware: true,
                whenToUse: "When your business operates in a regulated industry — food service, healthcare, construction, childcare, financial services, real estate, transportation, and many others. Forge generates a checklist of the specific permits, certifications, and regulatory filings required for your industry and location.",
            },
            {
                id: "compliance-calendar",
                name: "Annual Compliance Calendar",
                isStateAware: true,
                whenToUse: "At the beginning of each year or when you first form your business. This calendar documents every filing deadline, renewal date, tax payment, annual report, and compliance obligation your business faces throughout the year — so nothing slips through the cracks and you never pay a late penalty.",
            },
        ],
    },

    // ── CATEGORY 11 ──────────────────────────────────────────
    {
        id: "communication-marketing",
        name: "Communication and Marketing",
        description: "Professional documents for external communication, sales, and marketing",
        icon: "Megaphone",
        isStateAware: false,
        documents: [
            {
                id: "press-release",
                name: "Press Release",
                isMostPopular: true,
                whenToUse: "When announcing something newsworthy about your business — a product launch, major partnership, funding round, award, or significant milestone. A professionally written press release in the correct journalistic format increases the probability that media outlets will cover your story.",
            },
            {
                id: "media-kit",
                name: "Media Kit",
                whenToUse: "When a journalist, blogger, podcast host, or media outlet asks for information about your company. A Media Kit provides everything they need in one place — company overview, founder bio, product information, key statistics, logo files, and approved quotes. Having one ready signals professionalism and makes coverage more likely.",
            },
            {
                id: "case-study",
                name: "Case Study",
                whenToUse: "When a customer has achieved a meaningful result using your product or service and you want to document it as a marketing asset. Case studies are among the most persuasive sales tools available because they show real results for real customers. Forge structures the case study in the problem-solution-results format that resonates with prospects.",
            },
            {
                id: "testimonial-request",
                name: "Testimonial Request Letter",
                whenToUse: "When asking satisfied customers to provide a written testimonial or online review. A professionally written request letter explains exactly what you are asking for, makes it easy for the customer to say yes, and increases the probability of receiving a detailed and usable testimonial.",
            },
            {
                id: "cold-outreach",
                name: "Cold Outreach Email",
                whenToUse: "When reaching out to potential customers, partners, investors, or media contacts who do not know you yet. Forge generates outreach emails that lead with value, respect the recipient's time, and have a clear and simple call to action — dramatically improving response rates over generic templated messages.",
            },
            {
                id: "follow-up-email",
                name: "Follow-Up Email Templates",
                whenToUse: "After a meeting, pitch, call, or event when you need to continue the conversation professionally. Having polished follow-up templates ready ensures you follow up promptly and consistently — one of the most important and most neglected sales habits.",
            },
            {
                id: "proposal-template",
                name: "Proposal Template",
                whenToUse: "When responding to a request for proposal, pitching a specific project to a client, or presenting a formal business offer that requires more detail than a simple quote. A professional proposal documents the problem, your solution, your approach, timeline, pricing, and why you are the right choice.",
            },
            {
                id: "quote-estimate",
                name: "Quote / Estimate Template",
                whenToUse: "When a potential customer asks what something will cost before committing to a proposal. A clean professional quote documents the scope, pricing, validity period, and payment terms — and signals that you run a professional operation even before the first invoice.",
            },
            {
                id: "invoice-template",
                name: "Invoice Template",
                isMostPopular: true,
                whenToUse: "Every time you are owed payment for work completed or goods delivered. A professional invoice documents what was delivered, the amount owed, payment terms, accepted payment methods, and late payment consequences. Getting invoicing right from the start protects your cash flow.",
            },
            {
                id: "collection-letter",
                name: "Collection Letter",
                whenToUse: "When an invoice is past due and informal reminders have not resulted in payment. A formal Collection Letter escalates the urgency professionally and documents your attempt to collect before taking legal action. Forge generates letters appropriate for 30, 60, and 90 days past due — each progressively more formal.",
            },
            {
                id: "demand-letter-comms",
                name: "Demand Letter",
                whenToUse: "When you are owed money or specific performance that has not been delivered after formal requests have failed. A Demand Letter is a final formal notice before legal action, stating exactly what is owed, by when, and what will happen if the deadline is not met.",
            },
            {
                id: "sponsorship-proposal",
                name: "Sponsorship Proposal",
                whenToUse: "When seeking financial or in-kind sponsorship from businesses for an event, content series, podcast, community, or initiative. A Sponsorship Proposal documents what the sponsor receives in return for their investment — audience reach, brand exposure, and specific deliverables.",
            },
        ],
    },

    // ── CATEGORY 12 ──────────────────────────────────────────
    {
        id: "dissolution-exit",
        name: "Dissolution and Exit",
        description: "Documents for closing, selling, or transitioning your business",
        icon: "Door",
        isStateAware: true,
        documents: [
            {
                id: "articles-of-dissolution",
                name: "Articles of Dissolution",
                isStateAware: true,
                isMostPopular: true,
                whenToUse: "When you have decided to permanently close your LLC or corporation and need to formally end its legal existence with the state. Every state has a specific process and required form for dissolution. Failing to formally dissolve means you continue to owe annual report fees and remain legally liable as the registered entity. Forge generates the dissolution documents according to your state's specific requirements.",
            },
            {
                id: "asset-purchase",
                name: "Asset Purchase Agreement",
                whenToUse: "When selling specific business assets — equipment, inventory, intellectual property, customer lists, brand assets — rather than selling the entire business entity. Common in small business acquisitions. Documents exactly what is being sold, excluded liabilities, and transfer terms.",
            },
            {
                id: "business-sale",
                name: "Business Sale Agreement",
                isMostPopular: true,
                whenToUse: "When selling your entire business — either as an asset sale or a stock sale. This comprehensive agreement covers the purchase price, payment structure, representations and warranties, transition period, non-compete obligations, and what happens after closing. One of the most significant legal documents a founder will ever sign — attorney review is essential.",
            },
            {
                id: "loi-sell",
                name: "Letter of Intent to Sell",
                whenToUse: "When you have a serious buyer interested in your business and both parties want to agree on the basic terms — price, structure, timeline, exclusivity — before investing in full legal documentation and due diligence. Creates a framework for the transaction and demonstrates mutual commitment.",
            },
            {
                id: "transition-plan",
                name: "Transition Plan",
                whenToUse: "When selling your business, bringing on a partner, or planning for operational continuity without the current owner. Documents key relationships, operational processes, vendor contacts, login credentials framework, and institutional knowledge that must be transferred for the business to continue functioning.",
            },
            {
                id: "creditor-notice",
                name: "Final Creditor Notice",
                isStateAware: true,
                whenToUse: "When dissolving a business to formally notify creditors that the business is closing and establish a deadline for submitting claims. Required in many states as part of the formal dissolution process. Protects the founders from claims arising after dissolution is complete.",
            },
            {
                id: "employee-severance",
                name: "Employee Severance Agreement",
                whenToUse: "When laying off or terminating employees as part of a business closure or significant downsizing. A Severance Agreement documents any severance pay, continuation of benefits, return of company property, and a mutual release of claims — protecting both the departing employee and the business from future disputes.",
            },
        ],
    },
];

// ─────────────────────────────────────────────────────────────
// SMART PROMPT SUGGESTIONS
// Document-type-specific prompt suggestions for the configure screen.
// ─────────────────────────────────────────────────────────────
export const SMART_PROMPTS: Record<string, string[]> = {
    "business-summary": [
        "Focus on our traction and early customer results",
        "Emphasize the market opportunity and timing",
        "Include a strong competitive differentiation section",
        "Write for a traditional bank lending officer",
    ],
    "executive-summary": [
        "Keep it to one page — lead with the problem we solve",
        "Lead with our unique insight about the market",
        "Emphasize the team's relevant experience",
        "Focus on revenue model and path to profitability",
    ],
    "investor-overview": [
        "Emphasize market size and our defensible position",
        "Focus on traction metrics and growth trajectory",
        "Highlight the team's domain expertise",
        "Frame for a seed-stage angel investor audience",
    ],
    "funding-request": [
        "Write for an SBA loan application — include use of funds breakdown",
        "Include a detailed repayment timeline",
        "Frame for a community bank relationship manager",
        "Emphasize our collateral and personal assets",
    ],
    "pitch-deck-outline": [
        "Investor-led Series A pitch — emphasize scalability",
        "Angel round pitch — emphasize founder story and market insight",
        "Include a demo slide section and product screenshots",
        "Emphasize network effects and defensibility",
    ],
    "safe-agreement": [
        "Use a valuation cap of [amount] with no discount",
        "Include MFN (Most Favored Nation) provision",
        "Use post-money SAFE structure per YC standard",
        "Structure for multiple investors at different caps",
    ],
    "operating-agreement": [
        "Single-member LLC — simple governance structure",
        "Two equal partners — include deadlock resolution provisions",
        "Include manager-managed structure, not member-managed",
        "Add buy-sell agreement provisions for member exit",
    ],
    "nda": [
        "Mutual NDA for exploring a partnership",
        "One-way NDA — protect our information shared with a vendor",
        "Include specific carve-outs for publicly available information",
        "Make it time-limited to 2 years",
    ],
    "client-service-agreement": [
        "For a retainer engagement with a monthly flat fee",
        "Project-based with milestone payments and acceptance criteria",
        "Include IP ownership assignment and work-for-hire clause",
        "Add a clear kill fee for early termination by client",
    ],
    "contractor-agreement": [
        "For a software developer working remotely on a project basis",
        "For a marketing consultant on a monthly retainer",
        "Include strict IP assignment and non-disclosure provisions",
        "For a creative agency producing content and design assets",
    ],
    "privacy-policy": [
        "For a SaaS app — we collect email, usage data, and payment info",
        "For an e-commerce site — include third-party sharing for fulfillment",
        "Include CCPA and GDPR compliance language",
        "For a B2B platform — no personal consumer data, only business contacts",
    ],
    "terms-of-service": [
        "For a SaaS subscription product with monthly and annual plans",
        "For a marketplace platform connecting buyers and sellers",
        "Include strong limitation of liability and warranty disclaimers",
        "For a mobile app distributed through the App Store",
    ],
    "financial-projections": [
        "12-month monthly projection — pre-revenue startup",
        "3-year projection showing path to profitability for bank",
        "Include break-even analysis and key assumptions section",
        "Show investor-friendly revenue bridge with growth rates",
    ],
    "banking-resolution": [
        "Single authorized signer — just me as the sole member",
        "Two authorized signers with joint approval above $5,000",
        "Opening a business savings account and checking account",
        "Authorizing online banking and debit card access",
    ],
    "offer-letter": [
        "Full-time salaried role with equity options",
        "Part-time hourly position with no benefits",
        "Include 90-day probationary period language",
        "For a senior hire — include signing bonus and relocation",
    ],
    "press-release": [
        "Product launch announcement targeting tech media",
        "Funding round announcement — seed round just closed",
        "Partnership announcement with a recognized brand",
        "Award or recognition received — include quote from founder",
    ],
    "invoice-template": [
        "For a consulting engagement — hourly rate",
        "For a project with multiple deliverable milestones",
        "Include net-30 payment terms and 1.5% monthly late fee",
        "For recurring monthly retainer services",
    ],
    "articles-of-dissolution": [
        "Voluntary dissolution — business is winding down operations",
        "Include statement that all known debts have been paid",
        "We have no employees — simple dissolution",
        "Include certificate of tax clearance requirement",
    ],
    "business-sale": [
        "Asset purchase structure — not selling the entity itself",
        "Include 2-year non-compete and non-solicitation for seller",
        "Seller financing — part of purchase price paid over time",
        "Include transition period where I stay on as a consultant",
    ],
};

// Default suggestions used when no document-specific prompts exist
export const DEFAULT_SMART_PROMPTS = [
    "Keep it concise and direct — one page maximum",
    "Write for a non-technical reader",
    "Include specific numbers and projections where relevant",
    "Make the tone match a Fortune 500 company's style",
    "Add a clear call to action at the end",
];

export const US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
    "Washington", "West Virginia", "Wisconsin", "Wyoming",
];
