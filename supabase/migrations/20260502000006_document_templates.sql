create table if not exists public.document_templates (
    id uuid primary key default gen_random_uuid(),
    document_type text not null unique,
    required_fields jsonb not null default '[]'::jsonb,
    clause_guidelines text not null default '',
    jurisdiction_notes text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists document_templates_document_type_idx
    on public.document_templates (lower(document_type));

alter table public.document_templates enable row level security;

drop policy if exists "Authenticated users can read document templates" on public.document_templates;
create policy "Authenticated users can read document templates"
    on public.document_templates
    for select
    to authenticated
    using (auth.uid() is not null);

drop policy if exists "Owners and admins can manage document templates" on public.document_templates;
create policy "Owners and admins can manage document templates"
    on public.document_templates
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.role in ('owner', 'admin')
        )
    )
    with check (
        exists (
            select 1
            from public.profiles
            where profiles.id = auth.uid()
              and profiles.role in ('owner', 'admin')
        )
    );

create or replace function public.set_document_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_document_templates_updated_at on public.document_templates;
create trigger set_document_templates_updated_at
    before update on public.document_templates
    for each row
    execute function public.set_document_templates_updated_at();

insert into public.document_templates (document_type, required_fields, clause_guidelines, jurisdiction_notes)
values
(
    'LLC Operating Agreement',
    '[
        {"name":"legalBusinessName","label":"Legal business name","type":"text","required":true,"placeholder":"Example: Northstar Coffee LLC"},
        {"name":"jurisdictionState","label":"Governing state","type":"select","required":true,"placeholder":"State whose LLC law governs"},
        {"name":"ownersOrMembers","label":"Members and ownership percentages","type":"list","required":true,"placeholder":"Jane Smith - 60%\nAlex Lee - 40%"},
        {"name":"managementStructure","label":"Management structure","type":"select","required":true,"placeholder":"Member-managed or manager-managed"},
        {"name":"profitSplit","label":"Profit and loss allocation","type":"textarea","required":true,"placeholder":"Pro rata by ownership or custom allocation"},
        {"name":"votingRules","label":"Voting and approval rules","type":"textarea","required":true,"placeholder":"Majority, unanimous reserved matters, manager approval"},
        {"name":"memberExitRules","label":"Transfer, withdrawal, and buyout rules","type":"textarea","required":true,"placeholder":"Restrictions, buyout process, valuation method"}
    ]'::jsonb,
    'Include clauses for formation, members, capital contributions, allocations, management, voting, reserved matters, books and records, transfers, withdrawal, dissolution, indemnification, governing law, and signatures. Use numbered legal sections and clear defined terms.',
    'LLC operating agreements are state-specific. Flag state default-rule areas such as fiduciary duties, manager authority, member access to records, dissociation, and dissolution where counsel should confirm enforceability.'
),
(
    'NDA',
    '[
        {"name":"parties","label":"Disclosing and receiving parties","type":"list","required":true,"placeholder":"Company - Disclosing Party\nRecipient - Receiving Party"},
        {"name":"ndaType","label":"NDA type","type":"select","required":true,"placeholder":"Mutual or one-way"},
        {"name":"confidentialInfo","label":"Confidential information covered","type":"textarea","required":true,"placeholder":"Product plans, financials, customer data, source code"},
        {"name":"confidentialityTerm","label":"Confidentiality term","type":"text","required":true,"placeholder":"Example: 3 years; trade secrets until no longer protected"},
        {"name":"governingLaw","label":"Governing law","type":"select","required":true,"placeholder":"State law"}
    ]'::jsonb,
    'Include clauses for purpose, definition of confidential information, exclusions, obligations, permitted disclosures, return or destruction, no license, term, remedies, governing law, and signatures.',
    'NDA enforceability varies by state and industry. Avoid overbroad restrictions, account for trade secret treatment, and call out employee, investor, and California-style restraint concerns where relevant.'
),
(
    'Founder Agreement',
    '[
        {"name":"legalBusinessName","label":"Company legal name","type":"text","required":true,"placeholder":"Example: Northstar Coffee LLC"},
        {"name":"founders","label":"Founders, roles, and equity","type":"list","required":true,"placeholder":"Jane Smith - CEO - 60%\nAlex Lee - CTO - 40%"},
        {"name":"vestingTerms","label":"Vesting terms","type":"textarea","required":true,"placeholder":"4-year vesting, 1-year cliff, acceleration terms"},
        {"name":"ipOwnership","label":"IP ownership approach","type":"textarea","required":true,"placeholder":"Company owns all founder-created IP related to the business"},
        {"name":"decisionRules","label":"Decision-making rules","type":"textarea","required":true,"placeholder":"Ordinary decisions, reserved matters, deadlock process"},
        {"name":"governingLaw","label":"Governing law","type":"select","required":true,"placeholder":"State law"}
    ]'::jsonb,
    'Include clauses for founder roles, contributions, equity, vesting, IP assignment, confidentiality, decision rights, departures, repurchase rights, dispute resolution, governing law, and signatures.',
    'Founder agreements touch securities, tax, employment, and corporate law. Flag areas needing counsel: equity issuance, 83(b) timing, IP chain of title, non-competes, and repurchase rights.'
),
(
    'Consulting Agreement',
    '[
        {"name":"parties","label":"Client and consultant parties","type":"list","required":true,"placeholder":"Company - Client\nJane Smith - Consultant"},
        {"name":"servicesScope","label":"Scope of services","type":"textarea","required":true,"placeholder":"Deliverables, milestones, exclusions"},
        {"name":"compensation","label":"Compensation and expenses","type":"textarea","required":true,"placeholder":"Fees, payment schedule, reimbursable expenses"},
        {"name":"termOrDuration","label":"Term or project duration","type":"text","required":true,"placeholder":"Example: 3 months or until deliverables accepted"},
        {"name":"ipOwnership","label":"Work product and IP ownership","type":"textarea","required":true,"placeholder":"Assignment on payment; retained background IP"},
        {"name":"governingLaw","label":"Governing law","type":"select","required":true,"placeholder":"State law"}
    ]'::jsonb,
    'Include clauses for engagement, services, deliverables, compensation, expenses, independent contractor status, confidentiality, IP ownership, warranties, termination, limitation of liability, governing law, and signatures.',
    'Worker classification and IP assignment rules vary. Flag tax withholding, employment misclassification, state contractor tests, and whether assignment is valid before final payment.'
),
(
    'Terms of Service',
    '[
        {"name":"legalBusinessName","label":"Company legal name","type":"text","required":true,"placeholder":"Example: Northstar Coffee LLC"},
        {"name":"websiteOrAppName","label":"Website or app name/URL","type":"text","required":true,"placeholder":"Example: foundry.example.com"},
        {"name":"serviceDescription","label":"Service description","type":"textarea","required":true,"placeholder":"What users can do with the product"},
        {"name":"paymentTerms","label":"Pricing, billing, or refund terms","type":"textarea","required":true,"placeholder":"Subscription, one-time purchase, refunds, cancellation"},
        {"name":"userRestrictions","label":"User restrictions","type":"textarea","required":true,"placeholder":"Prohibited uses, account rules, content restrictions"},
        {"name":"governingLaw","label":"Governing law","type":"select","required":true,"placeholder":"State law"}
    ]'::jsonb,
    'Include clauses for acceptance, eligibility, accounts, product use, payments, user content, IP, prohibited conduct, disclaimers, limitation of liability, termination, disputes, governing law, and contact information.',
    'Consumer, subscription, privacy, and arbitration rules vary by state and jurisdiction. Flag auto-renewal, refund disclosures, minors, platform rules, and dispute clause enforceability.'
),
(
    'Privacy Policy',
    '[
        {"name":"legalBusinessName","label":"Company legal name","type":"text","required":true,"placeholder":"Example: Northstar Coffee LLC"},
        {"name":"websiteOrAppName","label":"Website or app name/URL","type":"text","required":true,"placeholder":"Example: foundry.example.com"},
        {"name":"dataCollected","label":"Data collected","type":"textarea","required":true,"placeholder":"Account data, payment data, usage analytics, cookies"},
        {"name":"dataUsePurposes","label":"How data is used","type":"textarea","required":true,"placeholder":"Provide services, support, analytics, marketing"},
        {"name":"dataSharing","label":"Third parties data is shared with","type":"textarea","required":true,"placeholder":"Processors, payment providers, analytics vendors"},
        {"name":"contactEmail","label":"Privacy contact email","type":"email","required":true,"placeholder":"privacy@example.com"}
    ]'::jsonb,
    'Include clauses for scope, categories collected, sources, purposes, sharing, cookies, retention, security, user rights, children, international transfers, changes, and contact information.',
    'Privacy laws are jurisdiction-specific. Flag CCPA/CPRA, GDPR, state privacy laws, sensitive data, children, health/financial data, cookie consent, and data processing agreements.'
),
(
    'IP Assignment',
    '[
        {"name":"assignorName","label":"Assignor name","type":"text","required":true,"placeholder":"Person or company assigning IP"},
        {"name":"assigneeName","label":"Assignee name","type":"text","required":true,"placeholder":"Company receiving IP"},
        {"name":"assignedIpDescription","label":"Assigned IP description","type":"textarea","required":true,"placeholder":"Code, designs, inventions, trademarks, content, domains"},
        {"name":"consideration","label":"Consideration","type":"textarea","required":true,"placeholder":"Employment, founder equity, cash, or other consideration"},
        {"name":"effectiveDate","label":"Effective date","type":"date","required":true,"placeholder":"Assignment effective date"},
        {"name":"governingLaw","label":"Governing law","type":"select","required":true,"placeholder":"State law"}
    ]'::jsonb,
    'Include clauses for assignment, further assurances, moral rights waiver where permitted, excluded background IP, representations, consideration, governing law, and signatures.',
    'IP assignment enforceability depends on IP type and state law. Flag prior employer claims, open-source code, moral rights limits, invention assignment statutes, and patent/trademark filing needs.'
),
(
    'Employment Offer Letter',
    '[
        {"name":"legalBusinessName","label":"Employer legal name","type":"text","required":true,"placeholder":"Example: Northstar Coffee LLC"},
        {"name":"employeeOrContractorName","label":"Candidate full name","type":"text","required":true,"placeholder":"First and last legal name"},
        {"name":"roleTitle","label":"Role title","type":"text","required":true,"placeholder":"Example: Operations Manager"},
        {"name":"startDate","label":"Start date","type":"date","required":true,"placeholder":"Expected start date"},
        {"name":"compensation","label":"Compensation and benefits","type":"textarea","required":true,"placeholder":"Salary/hourly rate, bonus, equity, benefits"},
        {"name":"employmentStatus","label":"Employment status","type":"select","required":true,"placeholder":"Full-time, part-time, exempt, non-exempt"},
        {"name":"workLocation","label":"Work location","type":"text","required":true,"placeholder":"Remote, hybrid, office address"}
    ]'::jsonb,
    'Include clauses for position, start date, compensation, benefits, reporting, location, at-will status where applicable, conditions, confidentiality/IP obligations, authorization to work, and acceptance.',
    'Employment terms are highly state-specific. Flag wage/hour classification, at-will language, background checks, equity documents, non-compete limits, and required state notices.'
)
on conflict (document_type) do update
set required_fields = excluded.required_fields,
    clause_guidelines = excluded.clause_guidelines,
    jurisdiction_notes = excluded.jurisdiction_notes,
    updated_at = now();
